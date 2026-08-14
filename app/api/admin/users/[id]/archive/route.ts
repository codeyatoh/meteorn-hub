import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/supabase/verify-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/admin/users/[id]/archive
 * Toggles the is_archived status in the user's user_metadata.
 */
export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { error: authError } = await verifyAdmin();
  if (authError) return authError;

  try {
    const { is_archived } = await request.json();

    if (typeof is_archived !== 'boolean') {
      return NextResponse.json({ error: 'Invalid is_archived value' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: user, error } = await admin.auth.admin.updateUserById(params.id, {
      user_metadata: { is_archived },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'An error occurred' }, { status: 500 });
  }
}
