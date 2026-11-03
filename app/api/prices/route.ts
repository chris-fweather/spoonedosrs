import {latestTrades} from '@/lib/ge-prices';

/** Grand Exchange prices for guide costs (lib/ge-prices.ts): callers get only the item IDs they ask for. */
export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get('ids') ?? '').split(',').filter(id => /^\d{1,6}$/.test(id)))].slice(0, 200);
  if (!ids.length) return Response.json({error: 'Ask for at least one item ID.'}, {status: 400});
  try {
    const data = await latestTrades(), prices: Record<string, number> = {};
    // Coins are always worth 1; otherwise use the average of the latest instant buy and sell, or whichever exists.
    for (const id of ids) {
      if (id === '995') { prices[id] = 1; continue; }
      const p = data[id], values = [p?.high, p?.low].filter((v): v is number => typeof v === 'number' && v > 0);
      if (values.length) prices[id] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }
    return Response.json({prices, source: 'OSRS Wiki real-time prices'}, {headers: {'Cache-Control': 'public, max-age=600'}});
  } catch {
    return Response.json({error: 'Prices are unavailable right now.'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  }
}
