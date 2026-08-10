import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/supabase/verify-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/admin/accounts/[id]
 * Body options (any combination):
 *   { total_tickets: number }  — update ticket quota
 *   { reset_tickets: true }    — reset tickets_done to 0
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await verifyAdmin();
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json() as {
    total_tickets?: number;
    reset_tickets?: boolean;
  };

  const updates: Record<string, unknown> = {};

  if (typeof body.total_tickets === 'number') {
    if (body.total_tickets < 1 || body.total_tickets > 100) {
      return NextResponse.json({ error: 'total_tickets must be between 1 and 100.' }, { status: 400 });
    }
    updates.total_tickets = body.total_tickets;
  }

  if (body.reset_tickets === true) {
    updates.tickets_done = 0;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('user_accounts')
    .update(updates)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, updates });
}
