import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.user_metadata?.role === 'admin' ? user : null;
}

/**
 * PATCH /api/admin/temp-mail-domains/[id]
 * Body: { is_active: boolean }
 *
 * DELETE /api/admin/temp-mail-domains/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const admin = await isAdmin(supabase);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { id } = await params;
  const { is_active } = await request.json();

  const { data, error } = await adminSupabase
    .from('temp_mail_allowed_domains')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const admin = await isAdmin(supabase);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { id } = await params;

  const { error } = await adminSupabase
    .from('temp_mail_allowed_domains')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
