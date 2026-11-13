/** World map tiles for guide maps and the world map, served through the site (`/api/map-tile`), so pages never hot-link
 * anyone. Which copy is served is `TILE_VERSION` (lib/map-tile-source.ts, docs/map-tiles.md):
 *
 * Mejrs' render (`mejrs-master`, https://github.com/mejrs/layers_osrs). Each tile is looked up in order:
 * 1. Cloudflare's edge cache (the nearest location),
 * 2. our copy in R2 (`MAP_TILES`: spoonedosrs-map-tiles, spoonedosrs-dev-map-tiles),
 * 3. GitHub. A tile GitHub returns is then saved to R2 and the edge cache in the background.
 * A copy already in R2 or the edge cache is served even while GitHub is down. With no copy anywhere and GitHub down,
 * the answer is a 502 that is never cached or stored. Open sea (404) is cached at the edge for a day and never stored.
 *
 * Our own render (`spooned-<cache date>`, made by .github/workflows/map-tiles.yml and uploaded to R2): the edge cache,
 * then R2 only. A tile R2 does not hold is open sea (404, cached at the edge for a day); an R2 error or a missing bucket
 * is a 502 that is never cached. Nothing is fetched from GitHub or written to R2.
 *
 * The edge cache key carries the version, so switching versions never serves the old copy from the edge.
 * Later, the same bucket can be served on its own domain (tiles.spoonedosrs.com) so tile requests skip the Worker. */
import {logEvent} from './log';
import {hasMaps, isMapId, isOwnTiles, isTileVersion, TILE_VERSION} from './map-tile-source';

export {TILE_VERSION};
const SOURCE = 'https://raw.githubusercontent.com/mejrs/layers_osrs/refs/heads/master/mapsquares/-1';
const MONTH = 30 * 86_400;
const int = (value: string | null, min: number, max: number) => {
  if (value === null || !/^-?\d{1,4}$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
};
const missing = () => new Response(null, {status: 404, headers: {'Cache-Control': 'public, max-age=86400'}});
const unavailable = () => new Response(null, {status: 502, headers: {'Cache-Control': 'no-store'}});
const png = (body: BodyInit, source: string) => new Response(body, {headers: {'Content-Type': 'image/png', 'Cache-Control': `public, max-age=${MONTH}, immutable`, 'X-Content-Type-Options': 'nosniff', 'X-Tile-Source': source}});

type Key = {z: number; p: number; x: number; y: number; m?: number};
/** The tile a request asks for, or null when it is not a square inside the game world. A version drawn per world map
 * needs the map (`m`, a map id); a single sheet takes none. */
export function tileKey(url: URL, version: string = TILE_VERSION): Key | 'outside' | null {
  const q = url.searchParams;
  const z = int(q.get('z'), -3, 4), p = int(q.get('p'), 0, 3), x = int(q.get('x'), 0, 9999), y = int(q.get('y'), 0, 9999);
  if (z === null || p === null || x === null || y === null) return null;
  const maps = hasMaps(version), m = q.get('m');
  if (maps ? m === null : m !== null) return null;
  const map = maps ? int(m, -1, 4095) : null;
  if (maps && (map === null || !isMapId(map))) return null;
  // About 6,400 by 12,800 game tiles; 64 game tiles per square at zoom 2. Anything else would be an uncached fetch.
  const scale = 2 ** (z - 2);
  if (x > Math.ceil(110 * scale) || y > Math.ceil(210 * scale)) return 'outside' as const;
  return map === null ? {z, p, x, y} : {z, p, x, y, m: map};
}
/** Where a tile lives in R2: `<version>/<z>/<p>_<x>_<y>.png`, or `<version>/<mapId>/<z>/<p>_<x>_<y>.png` for a version
 * drawn per map. */
export const tileObjectKey = (key: Key, version = TILE_VERSION) => `${version}/${key.m === undefined ? '' : key.m + '/'}${key.z}/${key.p}_${key.x}_${key.y}.png`;

/** The part of an R2 bucket this needs (the real binding, or a test double). */
export type TileBucket = {
  get(key: string): Promise<{arrayBuffer(): Promise<ArrayBuffer>} | null>;
  put(key: string, value: ArrayBuffer, options?: {httpMetadata?: {contentType?: string}}): Promise<unknown>;
};
type Context = {waitUntil(p: Promise<unknown>): void};

async function fromSource(key: Key): Promise<{status: 200; body: ArrayBuffer} | {status: 404} | {status: 502}> {
  try {
    const tile = await fetch(`${SOURCE}/${key.z}/${key.p}_${key.x}_${key.y}.png`, {signal: AbortSignal.timeout(8_000), cf: {cacheTtl: MONTH, cacheTtlByStatus: {'200-299': MONTH, '404': 86_400}, cacheEverything: true}} as RequestInit);
    // Open sea and unmapped squares have no tile: the map shows its background there.
    if (tile.status === 404) {await tile.body?.cancel(); return {status: 404};}
    if (!tile.ok) {await tile.body?.cancel(); return {status: 502};}
    const body = await tile.arrayBuffer();
    // Only a real PNG is kept; an error page in its place would otherwise be stored for good.
    return new Uint8Array(body.slice(0, 4)).join(',') === '137,80,78,71' ? {status: 200, body} : {status: 502};
  } catch {
    return {status: 502};
  }
}

/** Our own render: R2 only. A tile R2 does not hold is open sea; an R2 failure (or no bucket) is never taken for one. */
async function fromOwnCopy(bucket: TileBucket | null | undefined, objectKey: string) {
  if (!bucket) return 'error' as const;
  try {
    const stored = await bucket.get(objectKey);
    return stored ? await stored.arrayBuffer() : 'none' as const;
  } catch {
    return 'error' as const;
  }
}

/** Answer a tile request. The Worker entry passes its execution context (edge cache and background saves) and the
 * `MAP_TILES` bucket; without them (the app route fallback, a local run) Mejrs' tiles come straight from GitHub and our
 * own tiles cannot be served (502). `version` is for tests; the site always serves `TILE_VERSION`. */
export async function mapTile(request: Request, ctx?: Context, bucket?: TileBucket | null, version: string = TILE_VERSION) {
  if (!isTileVersion(version)) throw Error(`Unknown map tile version ${version}.`);
  const url = new URL(request.url), key = tileKey(url, version);
  if (key === null) return new Response('Unknown tile.', {status: 400});
  if (key === 'outside') return missing();
  const cache = ctx && typeof caches !== 'undefined' ? (caches as unknown as {default: Cache}).default : null;
  const cacheKey = new Request(`${url.origin}/api/map-tile?z=${key.z}&p=${key.p}&x=${key.x}&y=${key.y}${key.m === undefined ? '' : `&m=${key.m}`}&v=${version}`);
  const keep = (response: Response) => {if (cache) ctx!.waitUntil(cache.put(cacheKey, response.clone()).catch(() => undefined));};
  const hit = await cache?.match(cacheKey).catch(() => undefined);
  if (hit) return hit;
  const objectKey = tileObjectKey(key, version);
  if (isOwnTiles(version)) {
    const own = await fromOwnCopy(bucket, objectKey);
    if (own === 'error') {
      logEvent('map-tile-unavailable', {tile: objectKey});
      return unavailable();
    }
    const response = own === 'none' ? missing() : png(own, 'r2');
    keep(response);
    return response;
  }
  const stored = await bucket?.get(objectKey).catch(() => null);
  if (stored) {const response = png(await stored.arrayBuffer(), 'r2'); keep(response); return response;}
  const source = await fromSource(key);
  if (source.status === 404) {const response = missing(); keep(response); return response;}
  if (source.status === 502) {
    logEvent('map-tile-unavailable', {tile: objectKey});
    return unavailable();
  }
  const response = png(source.body, 'upstream');
  keep(response);
  if (bucket && ctx) ctx.waitUntil(bucket.put(objectKey, source.body, {httpMetadata: {contentType: 'image/png'}}).catch(() => undefined));
  return response;
}
