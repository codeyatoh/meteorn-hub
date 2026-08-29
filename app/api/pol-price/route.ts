import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/pol-price
 * Server-side proxy for CoinGecko simple price endpoint for Polygon (POL).
 * Fetches usd, php, eur prices for polygon-ecosystem-token.
 * Cached for 60 seconds.
 */
export async function GET() {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=polygon-ecosystem-token&vs_currencies=usd,php,eur`,
      {
        headers: {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
        },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch POL price' }, { status: res.status });
    }

    const data = await res.json();
    const prices = data['polygon-ecosystem-token'];

    return NextResponse.json({
      usd: prices?.usd ?? 0.45,
      php: prices?.php ?? 25,
      eur: prices?.eur ?? 0.41,
    });
  } catch {
    // Fallback to approximate values if CoinGecko is unavailable
    return NextResponse.json({ usd: 0.45, php: 25, eur: 0.41 });
  }
}
