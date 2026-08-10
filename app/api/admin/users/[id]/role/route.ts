import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/supabase/verify-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * PATCH /api/admin/users/[id]/role
 * Body: { role: 'admin' | 'user' }
 * Promotes or demotes a user's role via user_metadata.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await verifyAdmin();
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();
  const { role } = body as { role: string };

  if (!['admin', 'user'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role. Must be "admin" or "user".' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch current metadata so we don't overwrite other fields
  const { data: { user: target }, error: fetchError } = await admin.auth.admin.getUserById(id);
  if (fetchError || !target) {
    return NextResponse.json({ error: 'User not found.' }, { status: 404 });
  }

  const { error } = await admin.auth.admin.updateUserById(id, {
    user_metadata: { ...target.user_metadata, role },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, role });
}
