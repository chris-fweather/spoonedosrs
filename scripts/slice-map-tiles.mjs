// Cuts our own world map render into the tiles /api/map-tile serves (lib/map-tile.ts, docs/map-tiles.md):
// `<out>/<z>/<p>_<x>_<y>.png`, 256 px each, zoom -3 to 4. At zoom z one game tile is 2^z pixels, so a zoom 2 tile is one
// 64 by 64 map square (a region) at 4 px per game tile, the scale RuneLite's map renderer draws. x counts squares east
// from game x 0 and y counts squares north from game y 0; the top of each image is north. Same names, origin and
// direction as Mejrs' tiles, so the map front-end does not change.
//
// Input: one 256 px PNG per region and plane, `<regions>/<p>_<regionX>_<regionY>.png`, as scripts/map-tiles/SpoonedMapTiles.java
// writes them (transparent where the plane has nothing). Or a whole-plane image from RuneLite's MapImageDumper with
// `--image <plane>:<file>:<west>:<north>` (the game x of its left edge and the game y of its top edge), which is first cut
// into region tiles in --regions.
//
// Upper floors look like Mejrs' and the game's own map: the ground floor at half brightness, with the floor drawn over it.
// Zoom 3 and 4 scale zoom 2 up (nearest neighbour, crisp pixels); zoom 1 down to -3 halve the level above with a Lanczos-2
// filter. Fully empty or black tiles are skipped: the route answers those squares as open sea (404).
//
// Per map (when --regions holds worldmaps.json from SpoonedMapTiles.java): each of the game's world maps (lib/world-maps.ts)
// is drawn on its own from its map squares and zones at their display positions, with nothing (transparent, so the
// map's black shows) around them, into `<out>/<mapId>/<z>/<p>_<x>_<y>.png`; map -1 holds the squares no map of the game
// shows, where they are. `<out>/maps.json` lists every map with its layout, for the front-end (public/world-map/maps.json).
//
//   node --import ./scripts/register-tests.mjs scripts/slice-map-tiles.mjs --regions render/regions --out tiles
//     [--sample sample] [--cache-id 1234] [--cache-date 2026-11-01] [--version spooned-2026-11-01] [--concurrency 8]
//     [--single true] (one sheet in game tiles, as before maps)
import {mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, copyFileSync, existsSync} from 'node:fs';
import {availableParallelism} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {CompositeMap, readParts} from '../lib/world-maps.ts';

export const SIZE = 256, NATIVE_ZOOM = 2, MIN_ZOOM = -3, MAX_ZOOM = 4, PLANES = 4;
/** Game tiles per zoom 2 tile (one region) and pixels per game tile at zoom 2. */
export const REGION = 64, SCALE = 4;
/** Upper floors draw the ground floor under them at this brightness (Mejrs' tiles: exactly half). */
export const GROUND_UNDER_FLOOR = 0.5;
/** What /api/map-tile accepts (lib/map-tile.ts tileKey): a tile past this is never requested. */
export const insideRoute = (z, x, y) => {const s = 2 ** (z - 2); return x <= Math.ceil(110 * s) && y <= Math.ceil(210 * s);};

sharp.cache(false);
const key = (p, x, y) => `${p}_${x}_${y}`;
const tilePath = (out, z, p, x, y) => path.join(out, String(z), `${key(p, x, y)}.png`);

/** RGBA pixels of a 256 px PNG. */
export async function decode(file) {
  const {data, info} = await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  if (info.width !== SIZE || info.height !== SIZE) throw Error(`${file} is ${info.width}x${info.height}, not ${SIZE}x${SIZE}.`);
  return data;
}
/** Whether a tile has nothing to show: every pixel transparent, or opaque black (RuneLite's background). */
export function isEmpty(rgba) {
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] !== 0 && (rgba[i] | rgba[i + 1] | rgba[i + 2]) !== 0) return false;
  return true;
}
/** An upper floor over the ground floor: the ground at half brightness, the floor drawn over it ("over", straight alpha). */
export function composeFloor(ground, floor) {
  const out = Buffer.alloc(SIZE * SIZE * 4);
  for (let i = 0; i < out.length; i += 4) {
    const ga = ground ? ground[i + 3] / 255 : 0, fa = floor ? floor[i + 3] / 255 : 0, a = fa + ga * (1 - fa);
    if (a === 0) continue;
    for (let c = 0; c < 3; c++) {
      const g = ground ? ground[i + c] * GROUND_UNDER_FLOOR : 0, f = floor ? floor[i + c] : 0;
      out[i + c] = Math.round((f * fa + g * ga * (1 - fa)) / a);
    }
    out[i + 3] = Math.round(a * 255);
  }
  return out;
}
/** One of the f×f tiles a tile splits into at f times the scale: column i from the west, row j from the south. */
export function upscalePart(rgba, f, i, j) {
  const s = SIZE / f, top = (f - 1 - j) * s, left = i * s, out = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    const from = ((top + Math.floor(y / f)) * SIZE + left) * 4;
    for (let x = 0; x < SIZE; x++) rgba.copy(out, (y * SIZE + x) * 4, from + Math.floor(x / f) * 4, from + Math.floor(x / f) * 4 + 4);
  }
  return out;
}
/** A tile from the four below it (zoom + 1): `children[dx][dy]`, dx 0 west, dy 0 south; a missing child is transparent. */
export async function downscale(children) {
  const mosaic = Buffer.alloc(SIZE * 2 * SIZE * 2 * 4);
  for (const dx of [0, 1]) for (const dy of [0, 1]) {
    const c = children[dx][dy];
    if (!c) continue;
    const top = (1 - dy) * SIZE, left = dx * SIZE;
    for (let y = 0; y < SIZE; y++) c.copy(mosaic, ((top + y) * SIZE * 2 + left) * 4, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  return sharp(mosaic, {raw: {width: SIZE * 2, height: SIZE * 2, channels: 4}}).resize(SIZE, SIZE, {kernel: 'lanczos2'}).raw().toBuffer();
}
/** A tile as PNG: RGB when fully opaque (smaller), RGBA where the world ends. */
export function encode(rgba) {
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) {opaque = false; break;}
  const image = sharp(rgba, {raw: {width: SIZE, height: SIZE, channels: 4}});
  return (opaque ? image.removeAlpha() : image).png({compressionLevel: 9, adaptiveFiltering: true}).toBuffer();
}

/** Runs `work` over `items`, `limit` at a time. */
async function pool(items, limit, work) {
  let next = 0;
  await Promise.all(Array.from({length: Math.min(limit, items.length)}, async () => {while (next < items.length) await work(items[next++]);}));
}

/** Cuts a whole-plane image (4 px per game tile, top-left corner at game x `west`, game y `north`) into region tiles. */
export async function cutPlaneImage({file, plane, west, north}, regionsDir) {
  const {data, info} = await sharp(file, {limitInputPixels: false}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const {width, height} = info, south = north - height / SCALE, east = west + width / SCALE;
  if (width % SCALE || height % SCALE) throw Error(`${file}: ${width}x${height} is not a whole number of game tiles at ${SCALE} px each.`);
  mkdirSync(regionsDir, {recursive: true});
  let written = 0;
  for (let rx = Math.floor(west / REGION); rx * REGION < east; rx++) for (let ry = Math.floor(south / REGION); ry * REGION < north; ry++) {
    const tile = Buffer.alloc(SIZE * SIZE * 4);
    const left = (rx * REGION - west) * SCALE, top = (north - (ry + 1) * REGION) * SCALE;
    for (let y = 0; y < SIZE; y++) {
      const sy = top + y;
      if (sy < 0 || sy >= height) continue;
      const x0 = Math.max(0, -left), x1 = Math.min(SIZE, width - left);
      if (x1 > x0) data.copy(tile, (y * SIZE + x0) * 4, (sy * width + left + x0) * 4, (sy * width + left + x1) * 4);
    }
    if (isEmpty(tile)) continue;
    writeFileSync(path.join(regionsDir, `${key(plane, rx, ry)}.png`), await sharp(tile, {raw: {width: SIZE, height: SIZE, channels: 4}}).png().toBuffer());
    written++;
  }
  return written;
}

/** Region tiles on disk, by plane: `Map<plane, Set<"x_y">>`. */
export function listRegions(regionsDir) {
  const planes = new Map(Array.from({length: PLANES}, (_, p) => [p, new Set()]));
  for (const name of readdirSync(regionsDir)) {
    const m = /^([0-3])_(\d+)_(\d+)\.png$/.exec(name);
    if (m) planes.get(Number(m[1])).add(`${m[2]}_${m[3]}`);
  }
  return planes;
}

/** Writes every tile; returns how many there are and their bytes, per zoom and plane. */
export async function sliceMapTiles({regionsDir, out, concurrency = availableParallelism() * 2, log = () => {}}) {
  const regions = listRegions(regionsDir), stats = {}, tiles = new Map();
  const count = (z, p, bytes) => {const s = (stats[z] ??= {count: 0, bytes: 0, planes: [0, 0, 0, 0]}); s.count++; s.bytes += bytes; s.planes[p]++;};
  const save = async (z, p, x, y, rgba) => {
    if (isEmpty(rgba)) return false;
    const png = await encode(rgba);
    writeFileSync(tilePath(out, z, p, x, y), png);
    count(z, p, png.length);
    tiles.get(z).add(key(p, x, y));
    return true;
  };
  for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {mkdirSync(path.join(out, String(z)), {recursive: true}); tiles.set(z, new Set());}
  const region = async (p, xy) => regions.get(p).has(xy) ? decode(path.join(regionsDir, `${p}_${xy}.png`)) : null;

  // Zoom 2 (each upper floor over the ground floor), with zoom 3 and 4 scaled up from it.
  for (let p = 0; p < PLANES; p++) {
    const squares = [...new Set([...regions.get(0), ...regions.get(p)])];
    await pool(squares, concurrency, async xy => {
      const [x, y] = xy.split('_').map(Number);
      const ground = await region(0, xy), rgba = p === 0 ? ground : composeFloor(ground, await region(p, xy));
      if (!(await save(NATIVE_ZOOM, p, x, y, rgba))) return;
      for (let z = NATIVE_ZOOM + 1; z <= MAX_ZOOM; z++) {
        const f = 2 ** (z - NATIVE_ZOOM);
        for (let i = 0; i < f; i++) for (let j = 0; j < f; j++) await save(z, p, x * f + i, y * f + j, upscalePart(rgba, f, i, j));
      }
    });
    log(`plane ${p}: ${squares.length} squares`);
  }
  // Zoom 1 down to -3, each from the four tiles below it.
  for (let z = NATIVE_ZOOM - 1; z >= MIN_ZOOM; z--) {
    const parents = new Set();
    for (const k of tiles.get(z + 1)) {const [p, x, y] = k.split('_').map(Number); parents.add(key(p, x >> 1, y >> 1));}
    await pool([...parents], concurrency, async k => {
      const [p, x, y] = k.split('_').map(Number), children = [[null, null], [null, null]];
      for (const dx of [0, 1]) for (const dy of [0, 1]) if (tiles.get(z + 1).has(key(p, 2 * x + dx, 2 * y + dy))) children[dx][dy] = await decode(tilePath(out, z + 1, p, 2 * x + dx, 2 * y + dy));
      await save(z, p, x, y, await downscale(children));
    });
    log(`zoom ${z}: ${tiles.get(z).size} tiles`);
  }
  let outside = 0;
  for (const [z, set] of tiles) for (const k of set) {const [, x, y] = k.split('_').map(Number); if (!insideRoute(z, x, y)) outside++;}
  const total = Object.values(stats).reduce((t, s) => ({count: t.count + s.count, bytes: t.bytes + s.bytes}), {count: 0, bytes: 0});
  const regionCount = Object.fromEntries([...regions].map(([p, s]) => [p, s.size]));
  return {total, zooms: stats, regions: regionCount, outsideRoute: outside, tiles};
}

/** Copies a small set for review: every tile at zoom -3 to -1, and the squares around a few landmarks at every zoom and
 * floor. Also writes a whole-world preview per floor, from the zoom -3 tiles. */
export async function writeSample(out, sampleDir, tiles) {
  // Lumbridge Castle, Falador, the Grand Exchange, Kourend Castle, Prifddinas, Civitas illa Fortis.
  const PLACES = [[3222, 3218], [2964, 3378], [3165, 3487], [1639, 3673], [3263, 6079], [1680, 3130]];
  const picked = new Set();
  for (const [z, set] of tiles) for (const k of set) {
    const [, x, y] = k.split('_').map(Number), span = SIZE / 2 ** z;
    const near = PLACES.some(([gx, gy]) => Math.abs(Math.floor(gx / span) - x) <= 1 && Math.abs(Math.floor(gy / span) - y) <= 1);
    if (z <= -1 || near) picked.add(`${z}/${k}`);
  }
  for (const t of picked) {mkdirSync(path.join(sampleDir, path.dirname(t)), {recursive: true}); copyFileSync(path.join(out, `${t}.png`), path.join(sampleDir, `${t}.png`));}
  const previews = [];
  for (let p = 0; p < PLANES; p++) {
    const own = [...tiles.get(MIN_ZOOM)].map(k => k.split('_').map(Number)).filter(([q]) => q === p);
    if (!own.length) continue;
    const xs = own.map(t => t[1]), ys = own.map(t => t[2]), x0 = Math.min(...xs), y1 = Math.max(...ys);
    const width = (Math.max(...xs) - x0 + 1) * SIZE, height = (y1 - Math.min(...ys) + 1) * SIZE;
    const file = path.join(sampleDir, `preview-plane-${p}.png`);
    await sharp({create: {width, height, channels: 4, background: '#0e0d0b'}})
      .composite(own.map(([, x, y]) => ({input: tilePath(out, MIN_ZOOM, p, x, y), left: (x - x0) * SIZE, top: (y1 - y) * SIZE})))
      .png().toFile(file);
    previews.push(path.basename(file));
  }
  return {tiles: picked.size, previews};
}

// ---- Per map ----

/** Zone (8 tiles) size in pixels at zoom 2. */
const ZONE_PX = 8 * SCALE;
/** maps.json records from SpoonedMapTiles' worldmaps.json: squares and zones flattened, zones counted from game 0, 0;
 * plus map -1, "Other areas", for every rendered square no map uses (instances and quest areas the game does not map). */
export function mapRecords(worldMaps, regions) {
  const records = worldMaps.map(m => ({
    id: m.id, name: m.name, surface: !!m.surface, origin: m.origin,
    squares: m.squares.flat(),
    zones: m.zones.flatMap(([min, levels, ssx, ssy, szx, szy, dsx, dsy, dzx, dzy]) => [min, levels, ssx * 8 + szx, ssy * 8 + szy, dsx * 8 + dzx, dsy * 8 + dzy]),
  }));
  if (!records.some(r => r.surface) && records.length) (records.find(r => r.id === 0) ?? records[0]).surface = true;
  const used = new Set();
  for (const r of records) for (const p of readParts(r)) used.add(p.size === 64 ? `${p.sx}_${p.sy}` : `${p.sx >> 3}_${p.sy >> 3}`);
  const other = [...new Set([...regions.values()].flatMap(s => [...s]))].filter(xy => !used.has(xy)).sort();
  if (other.length) records.push({id: -1, name: 'Other areas', surface: false, origin: null, squares: other.flatMap(xy => {const [x, y] = xy.split('_').map(Number); return [0, 4, x, y, x, y];}), zones: []});
  return records;
}

/** A map record finished: its display box, where it opens (the game's origin for it, as a display tile it draws or a
 * game tile it shows, else the middle of what it draws), and how many display floors have tiles. */
export function finishRecord(record, planes) {
  const map = new CompositeMap({...record, planes, bounds: [0, 0, 0, 0], centre: [0, 0], home: [0, 0, 0]}), zones = map.displayZones();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of zones) {x0 = Math.min(x0, x * 8); y0 = Math.min(y0, y * 8); x1 = Math.max(x1, x * 8 + 8); y1 = Math.max(y1, y * 8 + 8);}
  const drawn = ([x, y]) => !!map.toGame({x, y, plane: 0});
  const o = record.origin, fromGame = o && map.toDisplay({x: o[0], y: o[1], plane: o[2]});
  let centre = o && o[0] >= 0 && drawn(o) ? [o[0], o[1]] : fromGame && fromGame.plane === 0 ? [fromGame.x, fromGame.y] : [Math.floor((x0 + x1) / 2), Math.floor((y0 + y1) / 2)];
  if (!drawn(centre)) {
    // The drawn zone nearest the middle.
    let best = null, far = Infinity;
    for (const [x, y] of zones) {const c = [x * 8 + 4, y * 8 + 4], d = Math.hypot(c[0] - centre[0], c[1] - centre[1]); if (drawn(c) && d < far) {best = c; far = d;}}
    if (best) centre = best;
  }
  const home = map.toGame({x: centre[0], y: centre[1], plane: 0}) ?? {x: centre[0], y: centre[1], plane: 0};
  const {origin, ...rest} = record;
  void origin;
  return {...rest, planes, bounds: [x0, y0, x1, y1], centre, home: [home.x, home.y, home.plane]};
}

/** Draws one map's zoom 2 squares at their display positions from the rendered game squares, into `dir`
 * (`<plane>_<x>_<y>.png`, display floor and square). Returns how many display floors have something drawn. */
export async function composeMap(record, regionsDir, regions, dir, {concurrency = availableParallelism() * 2} = {}) {
  const map = new CompositeMap({...record, planes: 4, bounds: [0, 0, 0, 0], centre: [0, 0], home: [0, 0, 0]});
  mkdirSync(dir, {recursive: true});
  const squares = new Map();
  for (const [x, y] of map.displayZones()) squares.set(`${x >> 3}_${y >> 3}`, [x >> 3, y >> 3]);
  // Decoded game squares, a few hundred at a time (a map's squares mostly come from one block of the world).
  const cache = new Map();
  const square = (p, x, y) => {
    const k = key(p, x, y);
    if (!regions.get(p)?.has(`${x}_${y}`)) return null;
    let v = cache.get(k);
    if (!v) {
      if (cache.size > 600) cache.delete(cache.keys().next().value);
      v = decode(path.join(regionsDir, `${k}.png`));
      cache.set(k, v);
    }
    return v;
  };
  const planes = new Set();
  await pool([...squares.values()], concurrency, async ([sx, sy]) => {
    for (let d = 0; d < PLANES; d++) {
      const out = Buffer.alloc(SIZE * SIZE * 4);
      let any = false;
      for (let i = 0; i < 64; i++) {
        const zx = sx * 8 + (i >> 3), zy = sy * 8 + (i & 7), src = map.source(zx, zy, d);
        if (!src) continue;
        const from = await square(src.plane, src.zx >> 3, src.zy >> 3);
        if (!from) continue;
        const fl = (src.zx & 7) * ZONE_PX, ft = (7 - (src.zy & 7)) * ZONE_PX, tl = (zx & 7) * ZONE_PX, tt = (7 - (zy & 7)) * ZONE_PX;
        for (let y = 0; y < ZONE_PX; y++) from.copy(out, ((tt + y) * SIZE + tl) * 4, ((ft + y) * SIZE + fl) * 4, ((ft + y) * SIZE + fl + ZONE_PX) * 4);
        any = true;
      }
      if (!any || isEmpty(out)) continue;
      writeFileSync(path.join(dir, `${key(d, sx, sy)}.png`), await sharp(out, {raw: {width: SIZE, height: SIZE, channels: 4}}).png({compressionLevel: 1}).toBuffer());
      planes.add(d);
    }
  });
  return planes.size ? Math.max(...planes) + 1 : 0;
}

/** A whole-map picture per floor, from the closest zoom at which the map fits in 4096 px. */
async function mapPreview(out, sampleDir, record, tiles) {
  const [x0, y0, x1, y1] = record.bounds, span = Math.max(x1 - x0, y1 - y0), files = [];
  let z = NATIVE_ZOOM;
  while (z > MIN_ZOOM && span * 2 ** z > 4096) z--;
  const slug = record.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (let p = 0; p < record.planes; p++) {
    const own = [...tiles.get(z)].map(k => k.split('_').map(Number)).filter(([q]) => q === p);
    if (!own.length) continue;
    const xs = own.map(t => t[1]), ys = own.map(t => t[2]), tx0 = Math.min(...xs), ty1 = Math.max(...ys);
    const file = path.join(sampleDir, 'previews', `${record.id}-${slug}-plane-${p}.png`);
    mkdirSync(path.dirname(file), {recursive: true});
    await sharp({create: {width: (Math.max(...xs) - tx0 + 1) * SIZE, height: (ty1 - Math.min(...ys) + 1) * SIZE, channels: 4, background: '#000'}, limitInputPixels: false})
      .composite(own.map(([, x, y]) => ({input: tilePath(out, z, p, x, y), left: (x - tx0) * SIZE, top: (ty1 - y) * SIZE}))).png().toFile(file);
    files.push(path.relative(sampleDir, file));
  }
  return files;
}

/** The squares around a few landmarks at every zoom and floor (Lumbridge Castle, Falador, the Grand Exchange, Kourend
 * Castle, Prifddinas, Civitas illa Fortis). */
function landmarkTiles(tiles) {
  const PLACES = [[3222, 3218], [2964, 3378], [3165, 3487], [1639, 3673], [3263, 6079], [1680, 3130]], picked = [];
  for (const [z, set] of tiles) for (const k of set) {
    const [, x, y] = k.split('_').map(Number), span = SIZE / 2 ** z;
    if (PLACES.some(([gx, gy]) => Math.abs(Math.floor(gx / span) - x) <= 1 && Math.abs(Math.floor(gy / span) - y) <= 1)) picked.push(`${z}/${k}`);
  }
  return picked;
}

/** Every map, sliced on its own. Returns maps.json's maps and the totals. With `sample`, copies every map's far zooms,
 * zoom 2 of every map but the surface (whose landmarks are copied at every zoom) and a picture of each map. */
export async function sliceMaps({regionsDir, out, work, sample, concurrency, log = () => {}}) {
  const regions = listRegions(regionsDir), worldMaps = JSON.parse(readFileSync(path.join(regionsDir, 'worldmaps.json'), 'utf8'));
  const records = mapRecords(worldMaps, regions), maps = [], totals = {count: 0, bytes: 0, outsideRoute: 0, perMap: {}};
  for (const record of records) {
    const dir = path.join(work, String(record.id)), planes = await composeMap(record, regionsDir, regions, dir, {concurrency});
    if (!planes) {log(`map ${record.id} ${record.name}: nothing drawn`); continue;}
    const result = await sliceMapTiles({regionsDir: dir, out: path.join(out, String(record.id)), concurrency});
    const finished = finishRecord(record, planes);
    maps.push(finished);
    totals.count += result.total.count; totals.bytes += result.total.bytes; totals.outsideRoute += result.outsideRoute;
    totals.perMap[record.id] = {name: record.name, count: result.total.count, bytes: result.total.bytes, planes, squares: record.squares.length / 6, zones: record.zones.length / 6};
    log(`map ${record.id} ${record.name}: ${result.total.count} tiles, ${planes} floors`);
    if (sample) {
      const picked = [];
      for (const [z, set] of result.tiles) for (const k of set) if (z <= 1 || (z === NATIVE_ZOOM && !record.surface)) picked.push(`${z}/${k}`);
      if (record.surface) picked.push(...landmarkTiles(result.tiles));
      for (const t of picked) {const to = path.join(sample, String(record.id), `${t}.png`); mkdirSync(path.dirname(to), {recursive: true}); copyFileSync(path.join(out, String(record.id), `${t}.png`), to);}
      finished.preview = await mapPreview(path.join(out, String(record.id)), sample, finished, result.tiles);
    }
  }
  return {maps, totals};
}

function args(argv) {
  const o = {images: []};
  for (let i = 0; i < argv.length; i++) {
    const [name, value] = [argv[i], argv[i + 1]];
    if (!name.startsWith('--') || value === undefined) throw Error(`Unexpected argument ${name}.`);
    if (name === '--image') o.images.push(value); else o[name.slice(2).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = value;
    i++;
  }
  return o;
}

async function main() {
  const o = args(process.argv.slice(2));
  if (!o.regions || !o.out) throw Error('Usage: node scripts/slice-map-tiles.mjs --regions <dir> --out <dir> [--image <plane>:<file>:<west>:<north>] [--sample <dir>] [--cache-id N] [--cache-date YYYY-MM-DD] [--version spooned-...] [--concurrency N]');
  const started = Date.now(), log = message => console.log(`[${((Date.now() - started) / 1000).toFixed(0)}s] ${message}`);
  for (const spec of o.images) {
    const m = /^([0-3]):(.+):(-?\d+):(-?\d+)$/.exec(spec);
    if (!m) throw Error(`--image wants <plane>:<file>:<west>:<north>, not ${spec}.`);
    log(`${m[2]}: ${await cutPlaneImage({plane: Number(m[1]), file: m[2], west: Number(m[3]), north: Number(m[4])}, o.regions)} region tiles`);
  }
  if (!existsSync(o.regions) || !statSync(o.regions).isDirectory()) throw Error(`No region tiles in ${o.regions}.`);
  if (existsSync(path.join(o.regions, 'worldmaps.json')) && o.single !== 'true') {
    const version = o.version ?? (o.cacheDate ? `spooned-${o.cacheDate}` : null);
    const {maps, totals} = await sliceMaps({regionsDir: o.regions, out: o.out, work: o.work ?? path.join(path.dirname(path.resolve(o.out)), 'map-squares'), sample: o.sample, concurrency: Number(o.concurrency) || undefined, log});
    if (!totals.count) throw Error('No tiles: the render is empty.');
    const file = {v: 1, version, maps: maps.map(({preview, ...m}) => {void preview; return m;})};
    writeFileSync(path.join(o.out, 'maps.json'), JSON.stringify(file) + '\n');
    const manifest = {
      version, cacheId: o.cacheId ? Number(o.cacheId) : null, cacheDate: o.cacheDate ?? null, builtAt: new Date().toISOString(),
      renderer: o.renderer ?? 'RuneLite cache MapImageDumper (BSD-2-Clause)',
      scheme: '<mapId>/<z>/<p>_<x>_<y>.png, 256 px, 2^z px per display tile, x east and y north from display 0,0, top of each image north; maps.json maps game tiles to display tiles',
      zooms: [MIN_ZOOM, MAX_ZOOM], count: totals.count, bytes: totals.bytes, outsideRoute: totals.outsideRoute, maps: totals.perMap,
      seconds: Math.round((Date.now() - started) / 1000),
    };
    writeFileSync(path.join(o.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    log(`${maps.length} maps, ${manifest.count} tiles, ${(manifest.bytes / 1e6).toFixed(1)} MB${manifest.outsideRoute ? `; ${manifest.outsideRoute} outside what the route serves` : ''}`);
    if (o.sample) {
      writeFileSync(path.join(o.sample, 'maps.json'), JSON.stringify(file) + '\n');
      writeFileSync(path.join(o.sample, 'manifest.json'), JSON.stringify({...manifest, previews: Object.fromEntries(maps.map(m => [m.id, m.preview]))}, null, 2) + '\n');
    }
    return;
  }
  const result = await sliceMapTiles({regionsDir: o.regions, out: o.out, concurrency: Number(o.concurrency) || undefined, log});
  if (!result.total.count) throw Error('No tiles: the render is empty.');
  const manifest = {
    version: o.version ?? (o.cacheDate ? `spooned-${o.cacheDate}` : null), cacheId: o.cacheId ? Number(o.cacheId) : null, cacheDate: o.cacheDate ?? null,
    builtAt: new Date().toISOString(), renderer: o.renderer ?? 'RuneLite cache MapImageDumper (BSD-2-Clause)',
    scheme: '<z>/<p>_<x>_<y>.png, 256 px, 2^z px per game tile, x east and y north from game 0,0, top of each image north',
    zooms: [MIN_ZOOM, MAX_ZOOM], count: result.total.count, bytes: result.total.bytes, regions: result.regions,
    perZoom: result.zooms, outsideRoute: result.outsideRoute, seconds: Math.round((Date.now() - started) / 1000),
  };
  writeFileSync(path.join(o.out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  log(`${manifest.count} tiles, ${(manifest.bytes / 1e6).toFixed(1)} MB${manifest.outsideRoute ? `; ${manifest.outsideRoute} outside what the route serves` : ''}`);
  if (o.sample) {
    const sample = await writeSample(o.out, o.sample, result.tiles);
    writeFileSync(path.join(o.sample, 'manifest.json'), JSON.stringify({...manifest, sample}, null, 2) + '\n');
    log(`sample: ${sample.tiles} tiles and ${sample.previews.length} previews in ${o.sample}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => {console.error(e.message ?? e); process.exit(1);});
