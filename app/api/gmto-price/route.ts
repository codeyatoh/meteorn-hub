import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/gmto-price?currency=usd
 * Server-side proxy for CoinGecko simple price endpoint.
 * Avoids CORS by making the request from the server, not the browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const currency = searchParams.get('currency') || 'usd';

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=game-meteor-coin&vs_currencies=${currency}`,
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
