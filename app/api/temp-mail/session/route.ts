import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/temp-mail/session
 * Returns the current user's active temp mail session (if any).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: session } = await supabase
      .from('temp_mail_sessions')
      .select('address, expires_at, created_at')
      .eq('user_id', user.id)
      .single();

    if (!session) {
      return NextResponse.json({ session: null });
    }

    // Auto-clean expired
    if (new Date(session.expires_at) < new Date()) {
      await supabase.from('temp_mail_sessions').delete().eq('user_id', user.id);
      return NextResponse.json({ session: null });
    }

    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
