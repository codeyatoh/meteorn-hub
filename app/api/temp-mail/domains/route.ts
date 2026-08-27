import { NextResponse } from 'next/server';

// ── Custom domains only ──────────────────────────────────────────────────────
// All emails are received via Cloudflare Email Routing → Worker → Supabase.
// To add a new domain: buy it, set up Cloudflare Email Routing + Worker,
// then add it to this list.
const CUSTOM_DOMAINS = [
  "yatmail.lat",
  // add more custom domains here as you buy them
];

/**
 * GET /api/temp-mail/domains
 * Returns available custom domains for the temp mail service.
 */
export async function GET() {
  return NextResponse.json({ domains: CUSTOM_DOMAINS });
}
