import { NextRequest, NextResponse } from 'next/server';

// ISR: regenerate this route every 30 seconds
export const revalidate = 30;

/**
 * GET /api/gmto-chart?currency=usd&days=1
 * Server-side proxy for CoinGecko market_chart endpoint.
 * Avoids CORS by making the request from the server, not the browser.
 * Includes retry logic.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const currency = searchParams.get('currency') || 'usd';
  const days = searchParams.get('days') || '1';
  const apiKey = process.env.COINGECKO_API_KEY || process.env.NEXT_PUBLIC_COINGECKO_API_KEY || '';

  // Retry up to 2 times with brief delay
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/coins/game-meteor-coin/market_chart?vs_currency=${currency}&days=${days}`,
        {
          headers: {
            'x-cg-demo-api-key': apiKey,
          },
          next: { revalidate: 30 },
        }
      );

      if (!res.ok) {
        console.warn(`[gmto-chart] CoinGecko returned ${res.status} on attempt ${attempt + 1}`);
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return NextResponse.json({ error: 'Failed to fetch chart data', prices: [] }, { status: res.status });
      }

      const data = await res.json();
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      });
    } catch (err) {
      console.warn(`[gmto-chart] Fetch error on attempt ${attempt + 1}:`, err);
      if (attempt < 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
    }
  }

  // All retries exhausted
  return NextResponse.json({ error: 'Chart data temporarily unavailable', prices: [] }, { status: 503 });
}
