import { NextResponse } from 'next/server';

// ISR: regenerate this route every 30 seconds
export const revalidate = 30;

// Fallback prices when CoinGecko is unavailable
const FALLBACK_PRICES = {
  usd: 0.0000105,
  php: 0.00065,
  eur: 0.0000092,
};

/**
 * GET /api/gmto-price
 * Server-side proxy for CoinGecko simple price endpoint.
 * Avoids CORS by making the request from the server, not the browser.
 * Includes retry logic and fallback prices.
 */
export async function GET() {
  const apiKey = process.env.COINGECKO_API_KEY || process.env.NEXT_PUBLIC_COINGECKO_API_KEY || '';

  // Retry up to 2 times with brief delay
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=game-meteor-coin&vs_currencies=usd,php,eur`,
        {
          headers: {
            'x-cg-demo-api-key': apiKey,
          },
          next: { revalidate: 30 },
        }
      );

      if (!res.ok) {
        console.warn(`[gmto-price] CoinGecko returned ${res.status} on attempt ${attempt + 1}`);
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        // Final attempt failed — return fallback
        return NextResponse.json(
          { "game-meteor-coin": FALLBACK_PRICES, _fallback: true },
          {
            headers: {
              'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
            },
          }
        );
      }

      const data = await res.json();
      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      });
    } catch (err) {
      console.warn(`[gmto-price] Fetch error on attempt ${attempt + 1}:`, err);
      if (attempt < 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
    }
  }

  // All retries exhausted — return fallback prices
  return NextResponse.json(
    { "game-meteor-coin": FALLBACK_PRICES, _fallback: true },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    }
  );
}
