import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ImapFlow } from 'imapflow';
import { decrypt } from '@/lib/utils/encryption';

/**
 * POST /api/temp-mail/create
 * Body: { username: string, domain: string, byoe_gmail_id?: string, suffix?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { username, domain, byoe_gmail_id } = body;

    // --- Atomic Access & Rate Limit Check ---
    const { data: allowed, error: rpcError } = await supabase
      .rpc('check_and_increment_temp_mail_quota', { target_user_id: user.id });

    if (rpcError || !allowed) {
      return NextResponse.json(
        { error: 'Access denied or daily limit reached for your tier.' }, 
        { status: 429 }
      );
    }
    // ---------------------------------

    let address = '';
    let mailtmAccountId = 'custom';
    let byoeConnectionId = null;

function generateDotTrickEmail(baseName: string, index: number): string {
  // Remove any existing dots to get the pure base name
  const cleanBase = baseName.replace(/\./g, '');
  if (cleanBase.length <= 1) return cleanBase;
  
  const numSlots = cleanBase.length - 1;
  const maxVariations = Math.pow(2, numSlots);
  
  if (index >= maxVariations) {
    throw new Error('All possible dot trick variations exhausted.');
  }

  let result = cleanBase[0];
  for (let i = 0; i < numSlots; i++) {
    if ((index & (1 << i)) !== 0) {
      result += '.';
    }
    result += cleanBase[i + 1];
  }
  return result;
}

function generateRandomSuffix(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

    if (byoe_gmail_id) {
      // BYOE Mode
      // Fetch the connection with its dot_trick_index
      const { data: connection, error: connError } = await supabase
        .from('user_gmail_connections')
        .select('gmail_address, id, dot_trick_index')
        .eq('id', byoe_gmail_id)
        .eq('user_id', user.id)
        .single();

      if (connError || !connection) {
        return NextResponse.json({ error: 'BYOE connection not found.' }, { status: 404 });
      }

      const baseName = connection.gmail_address.split('@')[0];
      let currentIndex = connection.dot_trick_index || 0;
      if (currentIndex === 0) {
        currentIndex = 1; // Skip base email (0 dots)
      }
      
      // Alternate between gmail.com and googlemail.com to double the variations
      const domain = (currentIndex % 2 === 0) ? 'googlemail.com' : 'gmail.com';
      const dotIndex = Math.floor((currentIndex + 1) / 2);
      
      try {
        const dottedName = generateDotTrickEmail(baseName, dotIndex);
        const randomSuffix = generateRandomSuffix(10);
        address = `${dottedName}+${randomSuffix}@${domain}`;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: errMsg }, { status: 400 });
      }

      // Increment index for the next time
      const { error: updateError } = await supabase
        .from('user_gmail_connections')
        .update({ dot_trick_index: currentIndex + 1 })
        .eq('id', connection.id);
        
      if (updateError) {
        console.error('Failed to update dot trick index:', updateError);
      }

      mailtmAccountId = 'byoe_gmail';
      byoeConnectionId = connection.id;

    } else {
      // Public Custom Domain Mode
      if (!username || !/^[a-z0-9._-]{3,30}$/.test(username)) {
        return NextResponse.json(
          { error: 'Username must be 3–30 characters, lowercase letters, numbers, dots, or dashes only.' },
          { status: 400 }
        );
      }
      if (!domain) {
        return NextResponse.json({ error: 'Domain is required.' }, { status: 400 });
      }
      address = `${username}@${domain}`;
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // +10 min

    // Upsert session
    const { error: upsertError } = await supabase
      .from('temp_mail_sessions')
      .upsert(
        {
          user_id: user.id,
          mailtm_account_id: mailtmAccountId,
          address,
          mailtm_token: 'custom',
          expires_at: expiresAt,
          byoe_connection_id: byoeConnectionId
        },
        { onConflict: 'user_id' }
      );

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
      return NextResponse.json({ error: 'Failed to save session.' }, { status: 500 });
    }

    return NextResponse.json({ address, expires_at: expiresAt });
  } catch (err) {
    console.error('create temp mail error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/temp-mail/create
 * Destroys the current session for the logged-in user.
 * If it's a BYOE session, connects to IMAP and deletes emails to that address.
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch the session before deleting
    const { data: session } = await supabase
      .from('temp_mail_sessions')
      .select('*, user_gmail_connections(gmail_address, app_password_encrypted, iv, auth_tag)')
      .eq('user_id', user.id)
      .single();

    if (session) {
      // If BYOE, we delete emails in Gmail
      if (session.mailtm_account_id === 'byoe_gmail' && session.user_gmail_connections) {
        try {
          const conn = session.user_gmail_connections;
          let appPassword: string;
          try {
            appPassword = decrypt({
              encrypted: conn.app_password_encrypted,
              iv: conn.iv,
              authTag: conn.auth_tag
            });
          } catch (decryptErr: unknown) {
            const errMsg = decryptErr instanceof Error ? decryptErr.message : String(decryptErr);
            if (errMsg.includes('Unsupported state') || errMsg.includes('authenticate data')) {
              console.warn(`Encryption key mismatch for user ${user.id} during session delete. Deleting corrupted connection.`);
              await supabase.from('user_gmail_connections').delete().eq('id', conn.id);
            }
            throw decryptErr; // Rethrow to skip IMAP deletion, session will still be deleted in finally block
          }

          const client = new ImapFlow({
            host: 'imap.gmail.com',
            port: 993,
            secure: true,
            auth: {
              user: conn.gmail_address,
              pass: appPassword
            },
            logger: false,
            socketTimeout: 15000,
            connectionTimeout: 15000,
          });

          await client.connect();
          
          // Delete from INBOX
          await client.mailboxOpen('INBOX');
          const inboxMessages = await client.search({ to: session.address }, { uid: true });
          if (Array.isArray(inboxMessages) && inboxMessages.length > 0) {
            await client.messageDelete(inboxMessages, { uid: true });
          }
          await client.mailboxClose();

          // Delete from Spam
          try {
            await client.mailboxOpen('[Gmail]/Spam');
            const spamMessages = await client.search({ to: session.address }, { uid: true });
            if (Array.isArray(spamMessages) && spamMessages.length > 0) {
              await client.messageDelete(spamMessages, { uid: true });
            }
            await client.mailboxClose();
          } catch {
            // Ignore if spam folder fails
          }

          await client.logout();
        } catch (imapErr) {
          console.error('Failed to delete emails in IMAP during session destroy:', imapErr);
          // Don't fail the session deletion, just log it.
        }
      }

      await supabase.from('temp_mail_sessions').delete().eq('user_id', user.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Destroy session error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
