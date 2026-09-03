import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/temp-mail/domains
 * Returns available custom domains for the temp mail service.
 * Fetches from the database to check is_active and is_banned statuses.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('temp_mail_allowed_domains')
      .select('domain, is_banned, available_at')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Filter out 'gmail.com' in case it was accidentally added to the DB
    const filteredDomains = (data || []).filter(d => d.domain.toLowerCase() !== 'gmail.com');

    return NextResponse.json({ domains: filteredDomains });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
