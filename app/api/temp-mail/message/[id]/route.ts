import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import PostalMime from 'postal-mime';

/**
 * GET /api/temp-mail/message/[id]
 * Fetches the full body of a specific email from Supabase yatmail_messages.
 * All custom domains use Cloudflare Email Routing → Worker → Supabase.
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
      .select('address, expires_at')
      .eq('user_id', user.id)
      .single();

    if (!session || new Date(session.expires_at) < new Date()) {
      return NextResponse.json({ error: 'No active session.' }, { status: 404 });
    }

    // Read from Supabase yatmail_messages table
    const { data: msg, error } = await supabase
      .from('yatmail_messages')
      .select('*')
      .eq('id', parseInt(id))
      .eq('mail_to', session.address)
      .single();

    if (error || !msg) {
      return NextResponse.json({ error: 'Message not found.' }, { status: 404 });
    }

    const parser = new PostalMime();
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
