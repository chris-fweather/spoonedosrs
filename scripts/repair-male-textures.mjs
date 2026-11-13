/** Give male item models back the game's textures (the Fire and Infernal capes' lava, the Lava battlestaff, the
 * Volcanic whip...) that their export lost.
 *
 * The male item models in public/models/look/items came from an exporter that painted every textured face one flat
 * palette colour (white on the capes, the texture's own colour on most items), so the texture was gone and animated
 * ones could not move. The female models are exported from the cache by scripts/export-appearance.mjs and keep the
 * textures, their UVs and their `flow:` speed, which app/Look.tsx scrolls. Jagex makes each female body model by moving
 * the male one's vertices (many held items are the very same model), so both have the same faces with the same
 * colours; only their order in the files differs. This finds that face-for-face match (an optimal assignment on corner
 * distance, untextured faces of a different colour kept apart, with a smooth male-to-female warp refitted from the
 * matches) and moves each matched textured face onto the male model with its texture, UVs and material.
 *
 * Refuses a model unless the two have the same number of faces and every textured face lands within a few units of
 * its female twin. Safe to run again: a male face that is already textured is left alone.
 *
 * Usage: node scripts/repair-male-textures.mjs [item IDs]. Without IDs, every item with its own female model that
 * has textured faces. Items it skips or refuses are listed with the reason.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

const manifest = JSON.parse(fs.readFileSync('lib/wearables.json', 'utf8'));
const female = JSON.parse(fs.readFileSync('lib/appearance-models.json', 'utf8')).femaleItems;
const ROOT = 'public/models/look/';
/** Largest summed corner distance (model units) allowed between a moved textured face and its female twin. */
const MAX_TEXTURED_COST = 9;
/** Extra cost for giving a flat male face a texture (see match). */
const RELABEL = 50;
const ORDERS = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]];

function attribute(g, id) {
  const a = g.accessors[id], v = g.bufferViews[a.bufferView], b = Buffer.from(g.buffers[v.buffer].uri.split(',')[1], 'base64');
  const size = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4}[a.type], bytes = {5121: 1, 5123: 2, 5125: 4, 5126: 4}[a.componentType];
  const read = {5121: 'readUInt8', 5123: 'readUInt16LE', 5125: 'readUInt32LE', 5126: 'readFloatLE'}[a.componentType];
  return Array.from({length: a.count}, (_, i) => Array.from({length: size}, (_, j) => b[read]((a.byteOffset ?? 0) + (v.byteOffset ?? 0) + i * (v.byteStride ?? size * bytes) + j * bytes)));
}
function append(g, rows, type, componentType = 5126) {
  const flat = rows.flat(), data = componentType === 5123 ? Uint16Array.from(flat) : componentType === 5125 ? Uint32Array.from(flat) : Float32Array.from(flat), n = g.buffers.length;
  g.buffers.push({uri: 'data:application/octet-stream;base64,' + Buffer.from(data.buffer).toString('base64'), byteLength: data.byteLength});
  g.bufferViews.push({buffer: n, byteLength: data.byteLength});
  const a = {bufferView: g.bufferViews.length - 1, componentType, type, count: rows.length};
  if (type === 'VEC3') { a.min = [0, 1, 2].map(k => Math.min(...rows.map(r => r[k]))); a.max = [0, 1, 2].map(k => Math.max(...rows.map(r => r[k]))); }
  if (type === 'SCALAR') { a.min = [Math.min(...flat)]; a.max = [Math.max(...flat)]; }
  g.accessors.push(a);
  return g.accessors.length - 1;
}
/** Drop buffers, views and accessors nothing points at any more, renumbering the rest. */
function compact(g) {
  const used = new Set(g.meshes.flatMap(m => m.primitives.flatMap(p => [...Object.values(p.attributes), ...p.indices === undefined ? [] : [p.indices]])));
  const accessors = [], remap = new Map();
  g.accessors.forEach((a, i) => { if (used.has(i)) { remap.set(i, accessors.length); accessors.push(a); } });
  for (const m of g.meshes) for (const p of m.primitives) {
    for (const k of Object.keys(p.attributes)) p.attributes[k] = remap.get(p.attributes[k]);
    if (p.indices !== undefined) p.indices = remap.get(p.indices);
  }
  const views = [], viewMap = new Map(), buffers = [], bufferMap = new Map();
  for (const a of accessors) {
    if (!viewMap.has(a.bufferView)) { viewMap.set(a.bufferView, views.length); views.push(g.bufferViews[a.bufferView]); }
    a.bufferView = viewMap.get(a.bufferView);
  }
  for (const v of views) {
    if (!bufferMap.has(v.buffer)) { bufferMap.set(v.buffer, buffers.length); buffers.push(g.buffers[v.buffer]); }
    v.buffer = bufferMap.get(v.buffer);
  }
  Object.assign(g, {accessors, bufferViews: views, buffers});
}

/** Decode an 8-bit RGB or RGBA PNG (the palette textures). */
function png(uri) {
  const b = Buffer.from(uri.split(',')[1], 'base64');
  let at = 8, width = 0, height = 0, type = 0;
  const idat = [];
  while (at < b.length) {
    const len = b.readUInt32BE(at), name = b.toString('ascii', at + 4, at + 8), body = b.subarray(at + 8, at + 8 + len);
    if (name === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); type = body[9]; if (body[8] !== 8 || ![2, 6].includes(type)) throw Error('Unsupported palette PNG'); }
    if (name === 'IDAT') idat.push(body);
    at += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3, raw = zlib.inflateSync(Buffer.concat(idat)), stride = width * bpp, out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, up = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
      const predict = [0, a, up, (a + up) >> 1, pa <= pb && pa <= pc ? a : pb <= pc ? up : c][filter];
      out[y * stride + x] = (line[x] + predict) & 255;
    }
  }
  return {width, height, pixel: (x, y) => [0, 1, 2].map(k => out[y * stride + x * bpp + k])};
}

const toSrgb = c => Math.round(255 * (c <= .0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - .055));
const flowing = material => material?.name?.startsWith('flow:') ?? false;
/** Each face with its corners and colour: 'T' for a face the game textures, else [r,g,b]. */
function faces(g, kind) {
  const out = [];
  g.meshes[0].primitives.forEach((p, prim) => {
    const material = g.materials[p.material], points = attribute(g, p.attributes.POSITION);
    const uv = p.attributes.TEXCOORD_0 === undefined ? null : attribute(g, p.attributes.TEXCOORD_0);
    const color = p.attributes.COLOR_0 === undefined ? null : attribute(g, p.attributes.COLOR_0);
    const indices = p.indices === undefined ? points.map((_, i) => i) : attribute(g, p.indices).flat();
    const palette = kind === 'male' && !flowing(material) ? png(g.images[g.textures[material.pbrMetallicRoughness.baseColorTexture.index].source].uri) : null;
    for (let i = 0; i < indices.length; i += 3) {
      const corners = indices.slice(i, i + 3);
      let key = 'T';
      if (palette) {
        const [u, v] = [0, 1].map(k => corners.reduce((s, c) => s + uv[c][k], 0) / 3);
        key = palette.pixel(Math.min(palette.width - 1, Math.floor(u * palette.width)), Math.min(palette.height - 1, Math.floor(v * palette.height)));
      } else if (!flowing(material)) key = color[corners[0]].map(toSrgb);
      out.push({prim, material: p.material, pos: corners.map(c => points[c]), uv: uv && corners.map(c => uv[c]), key});
    }
  });
  return out;
}
/** The old exporter painted a textured face one flat colour (white on the capes, the texture's own colour on most
 * items), so a female textured face may match any male face; everything else keeps to its colour. */
function compatible(male, fem) {
  if (fem === 'T') return true;
  if (male === 'T') return false;
  return male.every((c, k) => Math.abs(c - fem[k]) <= 10);
}

/** Minimum-cost assignment (Hungarian method, O(n³)); returns the column for each row. */
function assign(cost) {
  const n = cost.length, u = new Float64Array(n + 1), v = new Float64Array(n + 1), p = new Int32Array(n + 1), way = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0;
    const minv = new Float64Array(n + 1).fill(Infinity), used = new Uint8Array(n + 1);
    do {
      used[j0] = 1; const i0 = p[j0]; let delta = Infinity, j1 = 0;
      for (let j = 1; j <= n; j++) if (!used[j]) {
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const row = new Int32Array(n);
  for (let j = 1; j <= n; j++) row[p[j] - 1] = j - 1;
  return row;
}

const terms = ([x, y, z]) => [1, x, y, z, x * x, y * y, z * z, x * y, y * z, x * z, x ** 3, y ** 3, z ** 3, x * x * y, x * y * y, y * y * z, y * z * z, x * x * z, x * z * z, x * y * z];
/** Least-squares cubic warp from male to female space. Coordinates are scaled to about ±1 to keep it well conditioned. */
function fitWarp(src, dst) {
  const scale = 200, rows = src.map(p => terms(p.map(c => c / scale))), m = rows[0].length;
  const coef = [0, 1, 2].map(axis => {
    const a = Array.from({length: m}, () => new Float64Array(m + 1));
    rows.forEach((r, n) => { for (let i = 0; i < m; i++) { for (let j = 0; j < m; j++) a[i][j] += r[i] * r[j]; a[i][m] += r[i] * dst[n][axis]; } });
    for (let i = 0; i < m; i++) a[i][i] += 1e-9;
    for (let c = 0; c < m; c++) {
      let best = c; for (let r = c + 1; r < m; r++) if (Math.abs(a[r][c]) > Math.abs(a[best][c])) best = r;
      [a[c], a[best]] = [a[best], a[c]];
      for (let r = 0; r < m; r++) if (r !== c) { const f = a[r][c] / a[c][c]; for (let k = c; k <= m; k++) a[r][k] -= f * a[c][k]; }
    }
    return a.map((r, i) => r[m] / r[i]);
  });
  return p => { const t = terms(p.map(c => c / scale)); return coef.map(cs => cs.reduce((s, c, i) => s + c * t[i], 0)); };
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** The cheapest way to lay the male corners onto the female ones: [cost, female corner for each male corner]. */
function laid(male, fem) {
  let best = [Infinity, ORDERS[0]];
  for (const o of ORDERS) { const c = dist(male[0], fem[o[0]]) + dist(male[1], fem[o[1]]) + dist(male[2], fem[o[2]]); if (c < best[0]) best = [c, o]; }
  return best;
}

/** Match male faces to female faces; returns [{male, fem, cost, order}] for every male face. */
function match(mf, ff) {
  const n = mf.length, all = list => list.flatMap(f => f.pos);
  const box = pts => [0, 1, 2].map(k => [Math.min(...pts.map(p => p[k])), Math.max(...pts.map(p => p[k]))]);
  const bm = box(all(mf)), bf = box(all(ff));
  let warp = p => p.map((c, k) => (c - bm[k][0]) / (bm[k][1] - bm[k][0]) * (bf[k][1] - bf[k][0]) + bf[k][0]);
  let pairs = [];
  for (let round = 0; round < 4; round++) {
    const moved = mf.map(f => f.pos.map(warp));
    // A male face that is already textured keeps a textured twin: handing a textured female face to a flat male face
    // costs a little extra, so it only happens where the male face really lost its texture.
    const cost = moved.map((pos, i) => ff.map(f => !compatible(mf[i].key, f.key) ? 1e6 : laid(pos, f.pos)[0] + (f.key === 'T' && mf[i].key !== 'T' ? RELABEL : 0)));
    const row = assign(cost);
    pairs = mf.map((f, i) => { const [c, order] = laid(moved[i], ff[row[i]].pos); return {male: i, fem: row[i], cost: cost[i][row[i]] >= 1e6 ? 1e6 : c, order}; });
    const sorted = pairs.map(p => p.cost).sort((a, b) => a - b), cut = sorted[Math.floor(sorted.length * .8)];
    const src = [], dst = [];
    for (const p of pairs) if (p.cost <= cut) p.order.forEach((o, k) => { src.push(mf[p.male].pos[k]); dst.push(ff[p.fem].pos[o]); });
    warp = fitWarp(src, dst);
  }
  return pairs;
}

function repair(id) {
  const item = manifest.items[id], femaleFile = female[id];
  if (!item?.file || !femaleFile || femaleFile === item.file) return `${id}: no separate female model`;
  const g = JSON.parse(fs.readFileSync(ROOT + item.file, 'utf8')), f = JSON.parse(fs.readFileSync(ROOT + femaleFile, 'utf8'));
  if (g.meshes.length !== 1 || g.meshes[0].primitives.some(p => Object.keys(p.attributes).some(k => !['POSITION', 'TEXCOORD_0'].includes(k)))) throw Error(`${id}: unexpected male model layout`);
  const mf = faces(g, 'male'), ff = faces(f, 'female');
  if (!ff.some(x => x.key === 'T')) return `${id}: the game does not texture it`;
  if (mf.length !== ff.length) throw Error(`${id}: male ${mf.length} and female ${ff.length} faces differ`);
  const pairs = match(mf, ff);
  if (pairs.some(p => mf[p.male].key === 'T' && ff[p.fem].key !== 'T')) throw Error(`${id}: a textured male face has no textured twin`);
  const moves = pairs.filter(p => p.cost < 1e6 && ff[p.fem].key === 'T' && mf[p.male].key !== 'T');
  if (!moves.length) return `${id}: already textured`;
  const worst = Math.max(...moves.map(p => p.cost));
  if (worst > MAX_TEXTURED_COST) throw Error(`${id}: a textured face is ${worst.toFixed(1)} units from its female twin`);
  const moved = new Set(moves.map(p => p.male));

  // Rebuild every primitive without the moved faces (indexed, as the cache-model tests read them).
  g.meshes[0].primitives = g.meshes[0].primitives.flatMap((p, prim) => {
    const kept = mf.filter((x, i) => x.prim === prim && !moved.has(i));
    if (!kept.length) return [];
    const attributes = {POSITION: append(g, kept.flatMap(x => x.pos), 'VEC3')};
    if (p.attributes.TEXCOORD_0 !== undefined) attributes.TEXCOORD_0 = append(g, kept.flatMap(x => x.uv), 'VEC2');
    return [{...p, attributes, indices: append(g, kept.flatMap((_, i) => [[i * 3], [i * 3 + 1], [i * 3 + 2]]), 'SCALAR', 5123)}];
  });
  // One textured primitive per female material, each face with the male corners and the female UVs.
  const materials = new Map();
  for (const p of moves) {
    const femFace = ff[p.fem];
    if (!materials.has(femFace.material)) {
      const source = f.materials[femFace.material], texture = f.textures[source.pbrMetallicRoughness.baseColorTexture.index];
      g.images.push(structuredClone(f.images[texture.source]));
      g.samplers ??= [];
      g.samplers.push(structuredClone(f.samplers[texture.sampler]));
      g.textures.push({source: g.images.length - 1, sampler: g.samplers.length - 1});
      const material = structuredClone(source);
      material.pbrMetallicRoughness.baseColorTexture.index = g.textures.length - 1;
      g.materials.push(material);
      materials.set(femFace.material, {material: g.materials.length - 1, pos: [], uv: []});
    }
    const group = materials.get(femFace.material);
    p.order.forEach((o, k) => { group.pos.push(mf[p.male].pos[k]); group.uv.push(femFace.uv[o]); });
  }
  for (const {material, pos, uv} of materials.values()) g.meshes[0].primitives.push({attributes: {POSITION: append(g, pos, 'VEC3'), TEXCOORD_0: append(g, uv, 'VEC2')}, indices: append(g, pos.map((_, i) => [i]), 'SCALAR', 5123), material});
  compact(g);
  fs.writeFileSync(ROOT + item.file, JSON.stringify(g));
  const animated = [...materials.keys()].map(m => f.materials[m].name).find(name => name !== 'flow:0,0');
  if (animated) item.flow = animated.slice(5).split(',').map(Number);
  return `${id}: ${moves.length} textured face(s) restored (worst match ${worst.toFixed(2)} units)`;
}

const textured = file => JSON.parse(fs.readFileSync(ROOT + file, 'utf8')).materials.some(flowing);
const ids = process.argv.slice(2).length ? process.argv.slice(2)
  : Object.entries(manifest.items).filter(([id, item]) => female[id] && female[id] !== item.file && textured(female[id])).map(([id]) => id);
const before = JSON.stringify(manifest);
for (const id of ids) {
  try { console.log(repair(id)); } catch (error) { console.log(`${id}: refused, ${error.message.replace(/^\d+: /, '')}`); }
}
if (JSON.stringify(manifest) !== before) fs.writeFileSync('lib/wearables.json', JSON.stringify(manifest));
