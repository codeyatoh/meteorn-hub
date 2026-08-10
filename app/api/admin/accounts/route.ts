import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/supabase/verify-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/admin/accounts
 * Returns all user_accounts across all users, enriched with owner nickname.
 */
export async function GET() {
  const { error: authError } = await verifyAdmin();
  if (authError) return authError;

  const admin = createAdminClient();

  const [
    { data: accounts, error: accountsError },
    { data: { users } },
  ] = await Promise.all([
    admin.from('user_accounts').select('*').order('created_at', { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 });
  }

  // Build user lookup: id → nickname (or email fallback)
  const userMap: Record<string, string> = {};
  users.forEach((u) => {
    userMap[u.id] = (u.user_metadata?.nickname as string) || u.email || 'Unknown';
  });

  const result = (accounts ?? []).map((a) => ({
    id: a.id,
    user_id: a.user_id,
    owner_name: userMap[a.user_id] ?? 'Unknown',
    name: a.name,
    tickets_done: a.tickets_done,
    total_tickets: a.total_tickets,
    avatar: a.avatar,
    referral_link: a.referral_link,
    created_at: a.created_at,
  }));

  return NextResponse.json(result);
}
