/** World map tiles for guide maps and the world map, rendered from the game by Mejrs (https://github.com/mejrs/layers_osrs).
 * Served through the site so pages never hot-link GitHub, and kept in Cloudflare's edge cache (no storage of our own):
 * after the first view of a square, it is answered from the nearest Cloudflare location. */
const SOURCE = 'https://raw.githubusercontent.com/mejrs/layers_osrs/refs/heads/master/mapsquares/-1';
const MONTH = 30 * 86_400;
const int = (value: string | null, min: number, max: number) => {
  if (value === null || !/^-?\d{1,4}$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
};
const missing = () => new Response(null, {status: 404, headers: {'Cache-Control': 'public, max-age=86400'}});

/** The tile a request asks for, or null when it is not a square inside the game world. */
export function tileKey(url: URL) {
  const q = url.searchParams;
  const z = int(q.get('z'), -3, 4), p = int(q.get('p'), 0, 3), x = int(q.get('x'), 0, 9999), y = int(q.get('y'), 0, 9999);
  if (z === null || p === null || x === null || y === null) return null;
  // About 6,400 by 12,800 game tiles; 64 game tiles per square at zoom 2. Anything else would be an uncached fetch.
  const scale = 2 ** (z - 2);
  if (x > Math.ceil(110 * scale) || y > Math.ceil(210 * scale)) return 'outside' as const;
  return {z, p, x, y};
}

async function fromSource(key: {z: number; p: number; x: number; y: number}) {
  try {
    const tile = await fetch(`${SOURCE}/${key.z}/${key.p}_${key.x}_${key.y}.png`, {signal: AbortSignal.timeout(8_000), cf: {cacheTtl: MONTH, cacheTtlByStatus: {'200-299': MONTH, '404': 86_400}, cacheEverything: true}} as RequestInit);
    // Open sea and unmapped squares have no tile: the map shows its background there.
    if (tile.status === 404) return missing();
    if (!tile.ok) throw Error();
    return new Response(tile.body, {headers: {'Content-Type': 'image/png', 'Cache-Control': `public, max-age=${MONTH}, immutable`, 'X-Content-Type-Options': 'nosniff'}});
  } catch {
    return new Response(null, {status: 502, headers: {'Cache-Control': 'no-store'}});
  }
}

/** Answer a tile request. With an execution context (the Worker entry) the edge cache is checked first and filled after. */
export async function mapTile(request: Request, ctx?: {waitUntil(p: Promise<unknown>): void}) {
  const url = new URL(request.url), key = tileKey(url);
  if (key === null) return new Response('Unknown tile.', {status: 400});
  if (key === 'outside') return missing();
  const cache = ctx && typeof caches !== 'undefined' ? (caches as unknown as {default: Cache}).default : null;
  const cacheKey = new Request(`${url.origin}/api/map-tile?z=${key.z}&p=${key.p}&x=${key.x}&y=${key.y}`);
  const hit = await cache?.match(cacheKey).catch(() => undefined);
  if (hit) return hit;
  const response = await fromSource(key);
  if (cache && (response.ok || response.status === 404)) ctx!.waitUntil(cache.put(cacheKey, response.clone()).catch(() => undefined));
  return response;
}
