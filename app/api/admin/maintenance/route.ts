import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/maintenance
 * Calculates the number of records to be cleaned up without deleting them.
 * Admin-only route.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Count old yatmail messages (older than 3 days)
    const { count: deletedEmails } = await admin
      .from('yatmail_messages')
      .select('*', { count: 'exact', head: true })
      .lt('received_at', threeDaysAgo);

    // 2. Count expired temp mail sessions
    const { count: deletedSessions } = await admin
      .from('temp_mail_sessions')
      .select('*', { count: 'exact', head: true })
      .lt('expires_at', now);

    return NextResponse.json({
      success: true,
      stats: {
        deletedEmails: deletedEmails ?? 0,
        deletedSessions: deletedSessions ?? 0,
      },
    });
  } catch (err) {
    console.error('[maintenance preview]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/maintenance
 * Runs database cleanup: deletes old temp emails and expired sessions.
 * Admin-only route.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.user_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Delete old yatmail messages (older than 3 days)
    const { count: deletedEmails } = await admin
      .from('yatmail_messages')
      .delete({ count: 'exact' })
      .lt('received_at', threeDaysAgo);

    // 2. Delete expired temp mail sessions
    const { count: deletedSessions } = await admin
      .from('temp_mail_sessions')
      .delete({ count: 'exact' })
      .lt('expires_at', now);

    return NextResponse.json({
      success: true,
      stats: {
        deletedEmails: deletedEmails ?? 0,
        deletedSessions: deletedSessions ?? 0,
      },
      ranAt: now,
    });
  } catch (err) {
    console.error('[maintenance execute]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
