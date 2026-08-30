import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * GET /api/admin/temp-mail-domains
 * Returns all custom domains for admin management.
 * Syncs CUSTOM_DOMAINS list with DB — removes any non-custom domains.
 *
 * POST /api/admin/temp-mail-domains
 * Body: { domain: string }
 * Adds a new custom domain.
 */

// ── Custom domains only ──────────────────────────────────────────────────────
// All domains here use Cloudflare Email Routing → Worker → Supabase.
// To add a new domain: buy it, set up Cloudflare, then add it here.
const CUSTOM_DOMAINS = [
  "yatmail.lat",
  "3hitsmail.xyz",
  // add more custom domains here as you buy them
];

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

    const insertData = CUSTOM_DOMAINS.map(domain => ({
      domain,
      is_active: true,
      is_banned: false
    }));

    await adminSupabase.from('temp_mail_allowed_domains').upsert(insertData, {
      onConflict: 'domain',
      ignoreDuplicates: true
    });

    // Remove any stale domains that are no longer in our custom list
    await adminSupabase
      .from('temp_mail_allowed_domains')
      .delete()
      .not('domain', 'in', `(${CUSTOM_DOMAINS.map(d => `"${d}"`).join(',')})`);

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

  const { domain } = await request.json();
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: 'Invalid domain format.' }, { status: 400 });
  }

  const { data, error } = await adminSupabase
    .from('temp_mail_allowed_domains')
    .insert({ domain: domain.toLowerCase(), is_active: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
