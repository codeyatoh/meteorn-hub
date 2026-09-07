import { NextRequest, NextResponse } from 'next/server';

// ISR: regenerate this route every 30 seconds
export const revalidate = 30;

/**
 * GET /api/gmto-price?currency=usd
 * Server-side proxy for CoinGecko simple price endpoint.
 * Avoids CORS by making the request from the server, not the browser.
 */
export async function GET() {
  // No longer extracting single currency from query as we fetch usd,php,eur simultaneously

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=game-meteor-coin&vs_currencies=usd,php,eur`,
      {
        headers: {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
        },
        next: { revalidate: 30 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch price' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
