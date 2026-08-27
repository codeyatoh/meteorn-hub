import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Custom domains use Cloudflare Email Routing → Worker → Supabase.
// No external API calls needed — just store the session address.

/**
 * POST /api/temp-mail/create
 * Body: { username: string, domain: string }
 *
 * Creates a temp mail session for a custom domain (e.g. yatmail.lat).
 * Emails are received automatically via Cloudflare Worker → Supabase.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { username, domain } = body as { username: string; domain: string };

    // Validate username
    if (!username || !/^[a-z0-9._-]{3,30}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username must be 3–30 characters, lowercase letters, numbers, dots, or dashes only.' },
        { status: 400 }
      );
    }

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required.' }, { status: 400 });
    }

    const address = `${username}@${domain}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // +10 min

    // Upsert session in Supabase (no external API call needed)
    const { error: upsertError } = await supabase
      .from('temp_mail_sessions')
      .upsert(
        {
          user_id: user.id,
          mailtm_account_id: 'custom',
          address,
          mailtm_token: 'custom',
          expires_at: expiresAt,
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
 */
export async function DELETE() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await supabase.from('temp_mail_sessions').delete().eq('user_id', user.id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
