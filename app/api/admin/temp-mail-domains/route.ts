import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/temp-mail-domains
 * Returns all custom domains for admin management from the database.
 *
 * POST /api/admin/temp-mail-domains
 * Body: { domain: string, available_at: string | null }
 * Adds a new custom domain.
 */

export const dynamic = 'force-dynamic';

async function isAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.user_metadata?.role === 'admin' ? user : null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const admin = await isAdmin(supabase);
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Admin DB ops need service_role to bypass RLS
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await adminSupabase
      .from('temp_mail_allowed_domains')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const admin = await isAdmin(supabase);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const adminSupabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { domain, available_at } = await request.json();
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format.' }, { status: 400 });
  }

  const insertPayload: Record<string, string | boolean> = {
    domain: domain.toLowerCase(), 
    is_active: true,
    is_banned: false 
  };
  
  if (available_at) {
    insertPayload.available_at = available_at;
  }

  const { data, error } = await adminSupabase
    .from('temp_mail_allowed_domains')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique violation
      return NextResponse.json({ error: 'Domain already exists.' }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
