/** Builds lib/guide-travel.json: every travel destination a guide can name inline ([[Falador Teleport]], [[BLP]], [[Grand
 * Exchange spirit tree]]), with where it lands and what it needs, for the guide travel hover card (lib/guide-travel.ts).
 * It reads the world map's own data (public/world-map/travel.json and places.json, built by scripts/build-world-map.mjs),
 * so run it again after that: `node scripts/build-guide-travel.mjs`. lib/guide-travel.test.ts checks it is up to date. */
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const BOOKS = ['Standard', 'Ancient', 'Lunar', 'Arceuus'];
/** Transport networks a guide can name, by their place kind and their name in the card. */
const TRANSPORTS = {fairy: 'Fairy ring', spirit: 'Spirit tree', glider: 'Gnome glider', balloon: 'Balloon', mushtree: 'Magic mushtree', quetzal: 'Quetzal'};

/** The catalogue: `reqs` holds each distinct requirement once; each spot is [kind, name, via, area, x, y, plane, req,
 * unlock]. Spells and teleports keep the travel data's own names; transports name their destination, and fairy rings
 * their code. */
export function buildGuideTravel(travel, places) {
  const reqs = [{}], reqIndex = new Map([['{}', 0]]);
  const req = r => {const key = JSON.stringify(r ?? {}); if (!reqIndex.has(key)) {reqIndex.set(key, reqs.length); reqs.push(r);} return reqIndex.get(key);};
  const spots = [], seen = new Set();
  const add = (kind, name, via, area, x, y, p, r, unlock) => {
    const key = kind + ':' + name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    spots.push([kind, name, via, area, x, y, p, r, unlock ? 1 : 0]);
  };
  // Where each teleport lands, by name, as the map names the spot ("Falador Teleport" lands in "Falador").
  const areaOf = new Map();
  for (const p of places.places) if (p.k === 'teleport' && p.d && !areaOf.has(p.d)) areaOf.set(p.d, p.n);
  for (const t of travel.teleports) {
    const g = travel.groups[t.g];
    if (!g || t.in || g.cat === 'house') continue;
    const name = travel.names[t.n], spell = g.cat === 'spells' || g.cat === 'home';
    const via = spell ? `${BOOKS[t.b ?? 0]} spellbook` : g.name;
    add(spell ? 'spell' : 'teleport', name, via, areaOf.get(name) ?? '', t.x, t.y, t.p, req(travel.reqs[t.r]), t.u);
  }
  // Each transport stop's own requirement: the first route into it in the travel data ("AJP (Avium Savannah)" needs
  // Children of the Sun).
  const into = new Map();
  for (const e of travel.edges) {
    const kind = travel.kinds[e[7]];
    if (!(kind in TRANSPORTS) || e[8] == null) continue;
    const key = kind + ':' + travel.names[e[8]];
    if (!into.has(key)) into.set(key, travel.reqs[e[9]] ?? {});
  }
  for (const p of places.places) {
    if (!(p.k in TRANSPORTS)) continue;
    if (p.k === 'fairy') {
      const code = p.n.match(/^Fairy ring ([A-D][I-L][P-S])$/)?.[1];
      if (!code) continue; // The ring in Zanaris itself has no code: BKS lands there.
      const r = [...into].find(([k]) => k.startsWith('fairy:' + code + ' '))?.[1];
      add('fairy', code, TRANSPORTS.fairy, p.d ?? '', p.x, p.y, p.p, req(r), 0);
      continue;
    }
    const dest = p.n.replace(/^[^:]+:\s*/, '');
    add(p.k, dest.replace(/^\d+\.\s*/, ''), TRANSPORTS[p.k], dest.replace(/^\d+\.\s*/, ''), p.x, p.y, p.p, req(into.get(p.k + ':' + dest)), 0);
  }
  return {v: 1, reqs, spots};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const read = f => JSON.parse(readFileSync(new URL(`../public/world-map/${f}`, import.meta.url), 'utf8'));
  const out = buildGuideTravel(read('travel.json'), read('places.json'));
  writeFileSync(new URL('../lib/guide-travel.json', import.meta.url), JSON.stringify(out) + '\n');
  console.log(`${out.spots.length} travel destinations.`);
}
