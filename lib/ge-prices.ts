/** Grand Exchange data from the OSRS Wiki real-time prices API (https://prices.runescape.wiki), shared by the guide
 * price routes. Latest trades are cached ten minutes and the item mapping (alch values, buy limits) a day, per isolate. */
import untradeableValues from './untradeable-values.json' with {type: 'json'};
import {guideItems} from './guides';
import {itemQuests} from './item-quest';
const API = 'https://prices.runescape.wiki/api/v1/osrs';
const AGENT = 'spoonedosrs.com guide prices (discord.gg/spoonedosrs)';
export type LatestTrade = {high: number | null; highTime: number | null; low: number | null; lowTime: number | null};
export type ItemMapping = {id: number; name: string; highalch?: number; lowalch?: number; limit?: number; members?: boolean};
let latestCache: {at: number; data: Record<string, LatestTrade>} | null = null;
let mappingCache: {at: number; data: Map<string, ItemMapping>} | null = null;

async function get<T>(path: string, ttl: number): Promise<T> {
  const response = await fetch(API + path, {headers: {'User-Agent': AGENT}, signal: AbortSignal.timeout(10_000), cf: {cacheTtl: ttl, cacheEverything: true}} as RequestInit);
  if (!response.ok) throw Error('Prices are unavailable right now.');
  return response.json() as Promise<T>;
}

export async function latestTrades() {
  if (latestCache && Date.now() - latestCache.at < 600_000) return latestCache.data;
  const body = await get<{data?: Record<string, LatestTrade>}>('/latest', 600);
  latestCache = {at: Date.now(), data: body.data ?? {}};
  return latestCache.data;
}

export async function itemMapping() {
  if (mappingCache && Date.now() - mappingCache.at < 86_400_000) return mappingCache.data;
  const body = await get<ItemMapping[]>('/mapping', 86_400);
  mappingCache = {at: Date.now(), data: new Map(body.map(item => [String(item.id), item]))};
  return mappingCache.data;
}

/** High alchemy values of untradeable items, from the Wiki drop tables (scripts/build-untradeable-values.mjs). */
const untradeable = untradeableValues as Record<string, number>;

/** One item's price card: the latest instant buy and sell trades, alchemy values and the buy limit. Items missing from
 * the mapping are not sold on the Grand Exchange; their card carries the high alchemy value when the Wiki lists one, and
 * the quests the item belongs to (lib/item-quest.ts). */
export async function itemPriceCard(id: string) {
  const [latest, mapping] = await Promise.all([latestTrades(), itemMapping()]);
  const trade = latest[id], item = mapping.get(id);
  if (!item) return {id, tradeable: false as const, highAlch: untradeable[id] ?? null, quests: guideItems[id] ? await itemQuests(guideItems[id]) : []};
  return {id, tradeable: true as const, name: item.name, members: !!item.members, limit: item.limit ?? null,
    high: trade?.high ?? null, highTime: trade?.highTime ?? null, low: trade?.low ?? null, lowTime: trade?.lowTime ?? null,
    highAlch: item.highalch ?? null, lowAlch: item.lowalch ?? null};
}
