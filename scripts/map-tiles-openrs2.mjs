// Picks the game cache the map tiles are rendered from, from the OpenRS2 Archive (archive.openrs2.org), and turns its
// XTEA keys into the form RuneLite's cache tools read. Used by .github/workflows/map-tiles.yml; see docs/map-tiles.md.
//
//   node scripts/map-tiles-openrs2.mjs pick caches.json [cacheId]   prints {id, scope, date, build, keys, ...} as JSON
//   node scripts/map-tiles-openrs2.mjs keys keys.json xtea.json      writes [{region, keys}] for RuneLite's XteaKeyManager
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Where OpenRS2 serves a cache's files. */
export const cacheUrl = (cache, file) => `https://archive.openrs2.org/caches/${cache.scope}/${cache.id}/${file}`;

/** Share of the map keys the archive has for a cache (1 when it lists no count). */
export const keyCoverage = cache => cache.keys > 0 ? (cache.valid_keys ?? 0) / cache.keys : 1;

/** The cache to render: the one asked for, else the newest live Old School cache whose files are complete and which has
 * nearly every map key (a missing key leaves that square without objects: walls, trees, buildings). */
export function pickCache(caches, id = null) {
  if (!Array.isArray(caches)) throw Error('caches.json is not a list.');
  if (id !== null && id !== '') {
    const found = caches.find(c => String(c.id) === String(id));
    if (!found) throw Error(`OpenRS2 has no cache ${id}.`);
    return describe(found);
  }
  const live = caches.filter(c => c.game === 'oldschool' && c.environment === 'live' && (c.language ?? 'en') === 'en' && c.timestamp && c.disk_store_valid !== false)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  if (!live.length) throw Error('OpenRS2 lists no live Old School cache.');
  const complete = live.find(c => keyCoverage(c) >= 0.99 && (c.indexes == null || c.valid_indexes === c.indexes));
  return describe(complete ?? live[0], complete ? null : 'No recent cache has 99% of its map keys; using the newest one.');
}
function describe(c, warning = null) {
  const build = c.builds?.[0] ? `${c.builds[0].major}${c.builds[0].minor ? '.' + c.builds[0].minor : ''}` : null;
  return {id: c.id, scope: c.scope ?? 'runescape', game: c.game, date: c.timestamp ? new Date(c.timestamp).toISOString().slice(0, 10) : null,
    timestamp: c.timestamp ?? null, build, keys: c.keys ?? null, validKeys: c.valid_keys ?? null, keyCoverage: +keyCoverage(c).toFixed(4), warning};
}

/** OpenRS2's keys.json ([{mapsquare, key: [4 ints]}]) as RuneLite's XteaKeyManager reads it ([{region, keys}]). */
export function runeliteKeys(keys) {
  if (!Array.isArray(keys)) throw Error('keys.json is not a list.');
  return keys.filter(k => Number.isInteger(k.mapsquare) && Array.isArray(k.key) && k.key.length === 4).map(k => ({region: k.mapsquare, keys: k.key}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, input, extra] = process.argv.slice(2), read = file => JSON.parse(readFileSync(file, 'utf8'));
  if (command === 'pick') console.log(JSON.stringify(pickCache(read(input), extra ?? null)));
  else if (command === 'keys') {const keys = runeliteKeys(read(input)); writeFileSync(extra, JSON.stringify(keys)); console.log(`${keys.length} map keys`);}
  else {console.error('Usage: pick <caches.json> [cacheId] | keys <keys.json> <xtea.json>'); process.exit(1);}
}
