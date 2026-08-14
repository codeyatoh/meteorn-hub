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
    { data: incomes },
  ] = await Promise.all([
    admin.from('user_accounts').select('*').order('created_at', { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('income_logs').select('user_id, account_name, gmto_amount'),
  ]);

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 500 });
  }

  // Build user lookup: id → nickname (or email fallback)
  const userMap: Record<string, string> = {};
  users.forEach((u) => {
    userMap[u.id] = (u.user_metadata?.nickname as string) || u.email || 'Unknown';
  });

  // Build income lookup: `${user_id}_${account_name}` → total gmto
  const incomeMap: Record<string, number> = {};
  if (incomes) {
    incomes.forEach((i) => {
      const key = `${i.user_id}_${i.account_name}`;
      incomeMap[key] = (incomeMap[key] || 0) + Number(i.gmto_amount);
    });
  }

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
    is_banned: a.is_banned ?? false,
    total_earned: incomeMap[`${a.user_id}_${a.name}`] || 0,
  }));

  return NextResponse.json(result);
}
