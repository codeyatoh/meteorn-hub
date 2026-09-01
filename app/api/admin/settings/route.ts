import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/supabase/verify-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/admin/settings
 * Returns the single platform_settings row.
 */
export async function GET() {
  const { error: authError } = await verifyAdmin();
  if (authError) return authError;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('platform_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

/**
 * PATCH /api/admin/settings
 * Body options (any combination):
 *   { daily_ticket_limit: number, donation_wallet_address: string }
 */
export async function PATCH(request: NextRequest) {
  const { error: authError } = await verifyAdmin();
  if (authError) return authError;

  const body = await request.json() as {
    daily_ticket_limit?: number;
    donation_wallet_address?: string;
    faucet_claim_amount?: number;
  };

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.daily_ticket_limit === 'number') {
    if (body.daily_ticket_limit < 1 || body.daily_ticket_limit > 100) {
      return NextResponse.json({ error: 'daily_ticket_limit must be 1–100.' }, { status: 400 });
    }
    updates.daily_ticket_limit = body.daily_ticket_limit;
  }

  if (typeof body.donation_wallet_address === 'string') {
    updates.donation_wallet_address = body.donation_wallet_address;
  }

  if (typeof body.faucet_claim_amount === 'number') {
    if (body.faucet_claim_amount < 0.0001 || body.faucet_claim_amount > 10) {
      return NextResponse.json({ error: 'faucet_claim_amount must be between 0.0001 and 10.' }, { status: 400 });
    }
    updates.faucet_claim_amount = body.faucet_claim_amount;
  }

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('platform_settings')
    .update(updates)
    .eq('id', 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
