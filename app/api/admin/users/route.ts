import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/supabase/verify-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/admin/users
 * Returns all registered auth users with their profile + account count.
 */
export async function GET() {
  const { error: authError } = await verifyAdmin();
  if (authError) return authError;

  const admin = createAdminClient();

  const [
    { data: { users }, error: usersError },
    { data: accounts },
    { data: incomes },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('user_accounts').select('user_id'),
    admin.from('income_logs').select('user_id, gmto_amount, is_sold, fiat_received'),
  ]);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  // Build account count lookup
  const accountCounts: Record<string, number> = {};
  if (accounts) {
    accounts.forEach((a) => {
      accountCounts[a.user_id] = (accountCounts[a.user_id] || 0) + 1;
    });
  }

  // Build income lookup
  const incomeCounts: Record<string, { total: number, sold_gmto: number, fiat: number }> = {};
  if (incomes) {
    incomes.forEach((i) => {
      if (!incomeCounts[i.user_id]) {
        incomeCounts[i.user_id] = { total: 0, sold_gmto: 0, fiat: 0 };
      }
      incomeCounts[i.user_id].total += Number(i.gmto_amount);
      if (i.is_sold) {
        incomeCounts[i.user_id].sold_gmto += Number(i.gmto_amount);
        incomeCounts[i.user_id].fiat += Number(i.fiat_received);
      }
    });
  }

  const result = users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    nickname: (u.user_metadata?.nickname as string) ?? null,
    role: (u.user_metadata?.role as string) ?? 'user',
    is_archived: (u.user_metadata?.is_archived as boolean) ?? false,
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    account_count: accountCounts[u.id] ?? 0,
    total_income: incomeCounts[u.id]?.total ?? 0,
    sold_gmto: incomeCounts[u.id]?.sold_gmto ?? 0,
    fiat_received: incomeCounts[u.id]?.fiat ?? 0,
  }));

  return NextResponse.json(result);
}
