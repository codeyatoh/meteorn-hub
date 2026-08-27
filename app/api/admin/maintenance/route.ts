import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/maintenance
 * Runs database cleanup: deletes old temp emails, expired sessions,
 * and clears emails from banned accounts.
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

    // 3. Clear email from banned accounts (keep the account row intact)
    const { count: clearedBannedEmails } = await admin
      .from('user_accounts')
      .update({ email: null }, { count: 'exact' })
      .eq('is_banned', true)
      .not('email', 'is', null);

    return NextResponse.json({
      success: true,
      stats: {
        deletedEmails: deletedEmails ?? 0,
        deletedSessions: deletedSessions ?? 0,
        clearedBannedEmails: clearedBannedEmails ?? 0,
      },
      ranAt: now,
    });
  } catch (err) {
    console.error('[maintenance]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
