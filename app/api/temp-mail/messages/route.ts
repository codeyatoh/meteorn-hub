import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import PostalMime from 'postal-mime';
import { ImapFlow } from 'imapflow';
import { decrypt } from '@/lib/utils/encryption';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get session from Supabase
    const { data: session, error: sessionError } = await supabase
      .from('temp_mail_sessions')
      .select('*, user_gmail_connections(gmail_address, app_password_encrypted, iv, auth_tag)')
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'No active temp mail session.' }, { status: 404 });
    }

    const isByoe = session.mailtm_account_id === 'byoe_gmail';

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      // Cleanup for BYOE (non-blocking)
      if (isByoe && session.user_gmail_connections) {
        (async () => {
          try {
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
              socketTimeout: 15000,
              connectionTimeout: 15000,
            });
            await client.connect();

            await client.mailboxOpen('INBOX');
            let msgs = await client.search({ to: session.address }, { uid: true });
            if (Array.isArray(msgs) && msgs.length > 0) {
              await client.messageDelete(msgs, { uid: true });
            }
            await client.mailboxClose();

            try {
              await client.mailboxOpen('[Gmail]/Spam');
              msgs = await client.search({ to: session.address }, { uid: true });
              if (Array.isArray(msgs) && msgs.length > 0) {
                await client.messageDelete(msgs, { uid: true });
              }
              await client.mailboxClose();
            } catch {
              // Ignore if spam folder fails
            }

            await client.logout();
          } catch (err) {
            console.error('Failed to cleanup expired BYOE session:', err);
          }
        })();
      }
      
      await supabase.from('temp_mail_sessions').delete().eq('user_id', user.id);
      return NextResponse.json({ error: 'Session expired. Please generate a new address.' }, { status: 410 });
    }

    const currentExpiry = session.expires_at;
    const parser = new PostalMime();
    let parsedMessages: Record<string, unknown>[] = [];

    if (isByoe && session.user_gmail_connections) {
      // Fetch from Gmail IMAP
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
        socketTimeout: 15000,
        connectionTimeout: 15000,
      });

      try {
        await client.connect();

        const fetchMailbox = async (mailboxPath: string) => {
          try {
            const mailboxInfo = await client.mailboxOpen(mailboxPath);
            if (mailboxInfo.exists === 0) {
              await client.mailboxClose();
              return;
            }

            // Try UID-based search first (fast path)
            let uids = await client.search({ to: session.address }, { uid: true });
            
            // Fallback: search recent messages and filter by headers (crucial for OTPs)
            if ((!Array.isArray(uids) || uids.length === 0) && mailboxInfo.exists > 0) {
              const recent = Math.max(1, mailboxInfo.exists - 49); // fetch last 50
              const allUids = await client.search({ seq: `${recent}:*` }, { uid: true });
              if (Array.isArray(allUids)) uids = allUids;
            }

            if (Array.isArray(uids)) {
              for (const uid of uids) {
                const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
                if (msg && msg.source) {
                  const raw = msg.source.toString();
                  const addressLower = session.address.toLowerCase();
                  
                  // Parse and verify the address is in any recipient header
                  // For OTPs, Delivered-To is the most reliable header in Gmail.
                  const inHeaders = ['to:', 'delivered-to:', 'x-original-to:'].some(h => {
                    const idx = raw.toLowerCase().indexOf(h);
                    if (idx === -1) return false;
                    const line = raw.slice(idx, idx + 200).toLowerCase();
                    return line.includes(addressLower);
                  });
                  
                  // If we used the fallback and it's not in the headers, skip it
                  // We only skip if uids > 10 (meaning it's likely a fallback search)
                  if (!inHeaders && Array.isArray(uids) && uids.length > 10) continue; 
                  
                  const parsed = await parser.parse(msg.source);
                  parsedMessages.push({
                    id: Buffer.from(`${uid}:${mailboxPath}`).toString('base64url'),
                    subject: parsed.subject || '(No subject)',
                    from: parsed.from ? { address: parsed.from.address, name: parsed.from.name } : { address: '', name: '' },
                    createdAt: msg.envelope && msg.envelope.date ? msg.envelope.date.toISOString() : new Date().toISOString(),
                    seen: false,
                    intro: (parsed.text || '').substring(0, 100).replace(/\s+/g, ' '),
                    // Keep full text/html for detail view
                    text: parsed.text,
                    html: [parsed.html]
                  });
                }
              }
            }
            await client.mailboxClose();
          } catch (e) {
            console.error(`Failed to fetch from ${mailboxPath}:`, e);
          }
        };

        // Fetch from both INBOX and Spam
        await fetchMailbox('INBOX');
        await fetchMailbox('[Gmail]/Spam');

        await client.logout();
      } catch (err) {
        console.error('BYOE IMAP fetch error:', err);
        return NextResponse.json({ error: 'Failed to fetch messages from Gmail.' }, { status: 500 });
      }

      // Sort by newest first
      parsedMessages.sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());

    } else {
      // Fetch from Supabase yatmail_messages (Public Temp Mail)
      const { data: msgs, error: msgsError } = await supabase
        .from('yatmail_messages')
        .select('*')
        .eq('mail_to', session.address)
        .order('received_at', { ascending: false })
        .limit(100);

      if (msgsError) {
        return NextResponse.json({ error: 'Failed to fetch messages.' }, { status: 500 });
      }

      parsedMessages = await Promise.all((msgs || []).map(async (m) => {
        let parsed;
        try {
          parsed = await parser.parse(m.body || '');
        } catch {
          parsed = { subject: '', from: { address: '', name: '' }, text: '' };
        }
        return {
          id: m.id.toString(),
          subject: parsed.subject || m.subject || '(No subject)',
          from: parsed.from ? { address: parsed.from.address, name: parsed.from.name } : { address: m.mail_from, name: '' },
          createdAt: m.received_at,
          seen: false,
          intro: (parsed.text || m.body || '').substring(0, 100).replace(/\s+/g, ' '),
        };
      })) as Record<string, unknown>[];
    }

    return NextResponse.json({
      address: session.address,
      expires_at: currentExpiry,
      messages: parsedMessages,
    });
  } catch (err) {
    console.error('messages error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
