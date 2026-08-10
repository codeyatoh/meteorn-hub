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
  ] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from('user_accounts').select('user_id'),
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

  const result = users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    nickname: (u.user_metadata?.nickname as string) ?? null,
    role: (u.user_metadata?.role as string) ?? 'user',
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    account_count: accountCounts[u.id] ?? 0,
  }));

  return NextResponse.json(result);
}
