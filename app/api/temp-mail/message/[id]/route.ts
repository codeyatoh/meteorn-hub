import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import PostalMime from 'postal-mime';
import { ImapFlow } from 'imapflow';
import { decrypt } from '@/lib/utils/encryption';

/**
 * GET /api/temp-mail/message/[id]
 * Fetches the full body of a specific email.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get session
    const { data: session } = await supabase
      .from('temp_mail_sessions')
      .select('*, user_gmail_connections(gmail_address, app_password_encrypted, iv, auth_tag)')
      .eq('user_id', user.id)
      .single();

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'No active session.' }, { status: 404 });
    }

    const parser = new PostalMime();

    // BYOE Gmail mode
    if (session.mailtm_account_id === 'byoe_gmail' && session.user_gmail_connections) {
      const [uid, mailboxPath] = id.split('-');
      if (!uid || !mailboxPath) {
        return NextResponse.json({ error: 'Invalid message ID.' }, { status: 400 });
      }

      const conn = session.user_gmail_connections;
      const appPassword = decrypt({
        encrypted: conn.app_password_encrypted,
        iv: conn.iv,
        authTag: conn.auth_tag,
      });

      const client = new ImapFlow({
        host: 'imap.gmail.com',
        port: 993,
        secure: true,
        auth: { user: conn.gmail_address, pass: appPassword },
        logger: false,
      });

      try {
        await client.connect();
        await client.mailboxOpen(mailboxPath);
        const msg = await client.fetchOne(uid, { source: true, envelope: true });
        
        if (!msg || !msg.source) {
          await client.logout();
          return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
        }

        const parsedEmail = await parser.parse(msg.source);
        await client.logout();

        return NextResponse.json({
          id,
          subject: parsedEmail.subject || '(No subject)',
          from: parsedEmail.from ? { address: parsedEmail.from.address, name: parsedEmail.from.name } : { address: '', name: '' },
          to: parsedEmail.to && parsedEmail.to.length > 0 ? parsedEmail.to.map(t => ({ address: t.address })) : [{ address: session.address }],
          createdAt: msg.envelope && msg.envelope.date ? msg.envelope.date.toISOString() : new Date().toISOString(),
          text: parsedEmail.text || '',
          html: parsedEmail.html ? [parsedEmail.html] : [],
          seen: true,
        });

      } catch (err) {
        console.error('BYOE IMAP detail fetch error:', err);
        return NextResponse.json({ error: 'Failed to fetch message details.' }, { status: 500 });
      }
    }

    // Public Custom Domain mode (yatmail_messages)
    const { data: msg, error } = await supabase
      .from('yatmail_messages')
      .select('*')
      .eq('id', parseInt(id))
      .eq('mail_to', session.address)
      .single();

    if (error || !msg) {
      return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
    }

    const parsedEmail = await parser.parse(msg.body || '');

    return NextResponse.json({
      id: msg.id.toString(),
      subject: parsedEmail.subject || msg.subject || '(No subject)',
      from: parsedEmail.from ? { address: parsedEmail.from.address, name: parsedEmail.from.name } : { address: msg.mail_from, name: '' },
      to: parsedEmail.to && parsedEmail.to.length > 0 ? parsedEmail.to.map(t => ({ address: t.address })) : [{ address: msg.mail_to }],
      createdAt: msg.received_at,
      text: parsedEmail.text || '',
      html: parsedEmail.html ? [parsedEmail.html] : [],
      seen: true,
    });
  } catch (err) {
    console.error('message detail error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
