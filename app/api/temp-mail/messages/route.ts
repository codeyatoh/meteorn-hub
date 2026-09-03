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
            let appPassword: string;
            try {
              appPassword = decrypt({
                encrypted: conn.app_password_encrypted,
                iv: conn.iv,
                authTag: conn.auth_tag,
              });
            } catch (decryptErr: unknown) {
              const errMsg = decryptErr instanceof Error ? decryptErr.message : String(decryptErr);
              if (errMsg.includes('Unsupported state') || errMsg.includes('authenticate data')) {
                console.warn(`Encryption key mismatch for user ${user.id} during cleanup. Deleting corrupted connection.`);
                await supabase.from('user_gmail_connections').delete().eq('id', conn.id);
              }
              throw decryptErr;
            }

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
      let appPassword: string;
      try {
        appPassword = decrypt({
          encrypted: conn.app_password_encrypted,
          iv: conn.iv,
          authTag: conn.auth_tag,
        });
      } catch (decryptErr: unknown) {
        const errMsg = decryptErr instanceof Error ? decryptErr.message : String(decryptErr);
        if (errMsg.includes('Unsupported state') || errMsg.includes('authenticate data')) {
          // Encryption key mismatch! Auto-recover by deleting the corrupted connection
          console.warn(`Encryption key mismatch for user ${user.id}. Deleting corrupted connection.`);
          await supabase.from('user_gmail_connections').delete().eq('id', conn.id);
          return NextResponse.json({ error: 'Connection encryption key changed. Please re-authenticate your Gmail.' }, { status: 401 });
        }
        throw decryptErr;
      }

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

            const addressLower = session.address.toLowerCase();
            let baseAddress = addressLower;
            if (addressLower.includes('+')) {
              const [name, domain] = addressLower.split('@');
              baseAddress = `${name.split('+')[0]}@${domain}`;
            }

            // Multi-stage server-side search (no per-message looping)
            let uids: number[] = [];

            // Stage 1: Exact To: match (fast path, works when To: header has full alias)
            try {
              const exact = await client.search({ to: session.address }, { uid: true });
              if (Array.isArray(exact) && exact.length > 0) uids = exact;
            } catch { /* ignore search errors */ }

            // Stage 2: Gmail X-GM-RAW search (catches stripped +suffix via Delivered-To)
            if (uids.length === 0) {
              try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const gmRaw = await client.search({ rawBytes: Buffer.from(`X-GM-RAW "deliveredto:${baseAddress}"`) } as any, { uid: true });
                if (Array.isArray(gmRaw) && gmRaw.length > 0) uids = gmRaw;
              } catch {
                // X-GM-RAW not supported or search failed, try standard fallback
              }
            }

            // Stage 3: Standard IMAP OR search with base address (non-Gmail fallback)
            if (uids.length === 0 && baseAddress !== addressLower) {
              try {
                const orSearch = await client.search({ to: baseAddress }, { uid: true });
                if (Array.isArray(orSearch) && orSearch.length > 0) uids = orSearch;
              } catch { /* ignore */ }
            }

            // Stage 4: Last resort — search recent messages by sequence, limit to 10
            if (uids.length === 0 && mailboxInfo.exists > 0) {
              try {
                const recent = Math.max(1, mailboxInfo.exists - 9);
                const allUids = await client.search({ seq: `${recent}:*` }, { uid: true });
                if (Array.isArray(allUids)) uids = allUids;
              } catch { /* ignore */ }
            }

            // Fetch only matched messages (typically 1-5, not 50)
            if (Array.isArray(uids)) {
              for (const uid of uids) {
                try {
                  const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
                  if (msg && msg.source) {
                    const parser = new PostalMime();
                    const parsed = await parser.parse(msg.source);

                    // Verify recipient match (dot-insensitive, suffix-insensitive)
                    const normalize = (s: string) => s.toLowerCase().replace(/\./g, '');
                    const toAddrs = parsed.to?.map(t => t.address?.toLowerCase() || '') || [];
                    const delivTo = parsed.deliveredTo?.toLowerCase() || '';
                    const allRecip = [...toAddrs, delivTo].join(' ');
                    const matched = normalize(allRecip).includes(normalize(addressLower)) ||
                                    normalize(allRecip).includes(normalize(baseAddress));

                    // Skip non-matching messages only if we came from Stage 4 (last resort)
                    if (!matched && uids.length > 5) continue;

                    parsedMessages.push({
                      id: Buffer.from(`${uid}:${mailboxPath}`).toString('base64url'),
                      subject: parsed.subject || '(No subject)',
                      from: parsed.from ? { address: parsed.from.address, name: parsed.from.name } : { address: '', name: '' },
                      createdAt: msg.envelope && msg.envelope.date ? msg.envelope.date.toISOString() : new Date().toISOString(),
                      seen: false,
                      intro: (parsed.text || '').substring(0, 100).replace(/\s+/g, ' '),
                      text: parsed.text,
                      html: [parsed.html]
                    });
                  }
                } catch (err) {
                  console.error(`Failed to process message UID ${uid}:`, err);
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
      } catch (err: unknown) {
        console.error('BYOE IMAP fetch error:', err);
        const errMsg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Failed to fetch messages from Gmail: ${errMsg}` }, { status: 500 });
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
  } catch (err: unknown) {
    console.error('messages error:', err);
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Internal server error: ${errMsg}` }, { status: 500 });
  }
}
