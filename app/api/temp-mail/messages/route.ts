import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import PostalMime from 'postal-mime';

export const dynamic = 'force-dynamic';

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

    const currentExpiry = session.expires_at;
    const parser = new PostalMime();

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
        seen: false,
        intro: (parsed.text || m.body || '').substring(0, 100).replace(/\s+/g, ' '),
      };
    }));

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
