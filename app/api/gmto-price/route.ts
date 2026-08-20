import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/gmto-price?currency=usd
 * Server-side proxy for CoinGecko simple price endpoint.
 * Avoids CORS by making the request from the server, not the browser.
 */
export async function GET(request: NextRequest) {
  // No longer extracting single currency from query as we fetch usd,php,eur simultaneously

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=game-meteor-coin&vs_currencies=usd,php,eur`,
      {
        headers: {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
        },
        next: { revalidate: 60 }, // cache for 60 seconds
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch price' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
