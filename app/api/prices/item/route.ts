import {itemPriceCard} from '@/lib/ge-prices';

/** The price card for one guide item (lib/ge-prices.ts). */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? '';
  if (!/^\d{1,6}$/.test(id)) return Response.json({error: 'Ask for one item ID.'}, {status: 400});
  try {
    const card = await itemPriceCard(id);
    return Response.json(card, {headers: {'Cache-Control': `public, max-age=${card.tradeable ? 600 : 3600}`}});
  } catch {
    return Response.json({error: 'Prices are unavailable right now.'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  }
}
