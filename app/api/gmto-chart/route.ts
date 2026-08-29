import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gmto-chart?currency=usd&days=1
 * Server-side proxy for CoinGecko market_chart endpoint.
 * Avoids CORS by making the request from the server, not the browser.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const currency = searchParams.get('currency') || 'usd';
  const days = searchParams.get('days') || '1';

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/game-meteor-coin/market_chart?vs_currency=${currency}&days=${days}`,
      {
        headers: {
          'x-cg-demo-api-key': process.env.COINGECKO_API_KEY || '',
        },
        next: { revalidate: 10 }, // cache for 10 seconds (near real-time)
      }
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
