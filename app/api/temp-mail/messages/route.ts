import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/temp-mail/messages
 * Fetches the inbox from Supabase yatmail_messages table.
 * All custom domains use Cloudflare Email Routing → Worker → Supabase.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get session from Supabase
    const { data: session, error: sessionError } = await supabase
      .from('temp_mail_sessions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'No active temp mail session.' }, { status: 404 });
    }

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      await supabase.from('temp_mail_sessions').delete().eq('user_id', user.id);
      return NextResponse.json({ error: 'Session expired. Please generate a new address.' }, { status: 410 });
    }

    // Reset expires_at on activity
    const newExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await supabase
      .from('temp_mail_sessions')
      .update({ expires_at: newExpiry })
      .eq('user_id', user.id);

    // Read from Supabase yatmail_messages table
    const { data: msgs, error: msgsError } = await supabase
      .from('yatmail_messages')
      .select('*')
      .eq('mail_to', session.address)
      .order('received_at', { ascending: false })
      .limit(100);

    if (msgsError) {
      return NextResponse.json({ error: 'Failed to fetch messages.' }, { status: 500 });
    }

    return NextResponse.json({
      address: session.address,
      expires_at: newExpiry,
      messages: (msgs || []).map((m) => ({
        id: m.id.toString(),
        subject: m.subject || '(No subject)',
        from: { address: m.mail_from, name: '' },
        createdAt: m.received_at,
        seen: false,
        intro: '',
      })),
    });
  } catch (err) {
    console.error('messages error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
