import { NextResponse } from 'next/server';

// ISR: regenerate this route every 60 seconds
export const revalidate = 60;

// Fallback prices when CoinGecko is unavailable
const FALLBACK_PRICES = { usd: 0.45, php: 25, eur: 0.41 };

/**
 * GET /api/pol-price
 * Server-side proxy for CoinGecko simple price endpoint for Polygon (POL).
 * Fetches usd, php, eur prices for polygon-ecosystem-token.
 * Cached for 60 seconds. Includes retry logic.
 */
export async function GET() {
  const apiKey = process.env.COINGECKO_API_KEY || process.env.NEXT_PUBLIC_COINGECKO_API_KEY || '';

  // Retry up to 2 times with brief delay
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=polygon-ecosystem-token&vs_currencies=usd,php,eur`,
        {
          headers: {
            'x-cg-demo-api-key': apiKey,
          },
          next: { revalidate: 60 },
        }
      );

      if (!res.ok) {
        console.warn(`[pol-price] CoinGecko returned ${res.status} on attempt ${attempt + 1}`);
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        // Final attempt failed — return fallback
        return NextResponse.json({ ...FALLBACK_PRICES, _fallback: true });
      }

      const data = await res.json();
      const prices = data['polygon-ecosystem-token'];

      return NextResponse.json({
        usd: prices?.usd ?? FALLBACK_PRICES.usd,
        php: prices?.php ?? FALLBACK_PRICES.php,
        eur: prices?.eur ?? FALLBACK_PRICES.eur,
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      });
    } catch (err) {
      console.warn(`[pol-price] Fetch error on attempt ${attempt + 1}:`, err);
      if (attempt < 1) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
    }
  }

  // All retries exhausted — return fallback
  return NextResponse.json({ ...FALLBACK_PRICES, _fallback: true });
}
