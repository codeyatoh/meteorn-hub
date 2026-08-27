import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

import PostalMime from 'postal-mime';

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

    // Reset expires_at on activity only if less than 5 minutes remaining
    let currentExpiry = session.expires_at;
    const msRemaining = new Date(currentExpiry).getTime() - Date.now();
    
    if (msRemaining < 5 * 60 * 1000) {
      currentExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await supabase
        .from('temp_mail_sessions')
        .update({ expires_at: currentExpiry })
        .eq('user_id', user.id);
    }

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

    const parser = new PostalMime();
    const parsedMessages = await Promise.all((msgs || []).map(async (m) => {
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
        seen: false, // Could be derived if we add a seen column later
        intro: (parsed.text || m.body || '').substring(0, 100).replace(/\s+/g, ' '),
      };
    }));

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
