// Builds the world map data served from public/world-map/ (only the /map page fetches it).
//
//   node scripts/build-world-map.mjs <shortest-path checkout> <quest-stages.json>
//
// - Shortest Path (https://github.com/Skretzo/shortest-path, BSD-2-Clause): collision map, transports,
//   teleports and bank locations from src/main/resources. Record the commit in SHORTEST_PATH_COMMIT below.
// - Quest Helper (https://github.com/Zoinkwiz/quest-helper, BSD-2-Clause): quest start positions, read from the
//   quest-stages.json snapshot made by preview/guides/scripts/build-stages.mjs on codex/interactive-guide-preview.
// - lib/quest-reference.json (OSRS Wiki, CC BY-NC-SA 3.0): quest difficulty, length and start text.
// Explv's map labels and Mejrs' NPC list are not used: neither has a licence that allows redistribution.
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {gzipSync, inflateRawSync} from 'node:zlib';

const SHORTEST_PATH_COMMIT = 'c48960159a738066a230f76899821da9d5369439';
const [spDir, stagesFile] = process.argv.slice(2);
if (!spDir || !stagesFile) throw Error('Usage: node scripts/build-world-map.mjs <shortest-path checkout> <quest-stages.json>');
const res = join(spDir, 'src/main/resources');
const OUT = 'public/world-map';
mkdirSync(OUT, {recursive: true});

// ---------- Collision: keep the two "can move north/east" bits per tile, drop the wall bits, gzip. ----------
function unzipEntries(buf) {
  // Minimal ZIP reader (central directory), enough for the collision archive.
  const out = new Map();
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    out.set(name, method === 8 ? inflateRawSync(data) : method === 0 ? Buffer.from(data) : null);
    p += 46 + nameLen + extra + comment;
  }
  return out;
}
const regions = unzipEntries(readFileSync(join(res, 'collision-map.zip')));
const parts = [];
let regionCount = 0;
for (const [name, data] of [...regions].sort()) {
  const [rx, ry] = name.split('_').map(Number);
  // Source: 4 bits per tile (north, east, wall north, wall east), tile index (z*4096 + y*64 + x).
  const planes = Math.min(4, Math.ceil((data.length * 8) / (4096 * 4)));
  const packed = Buffer.alloc(planes * 1024);
  let any = false;
  for (let z = 0; z < planes; z++) for (let t = 0; t < 4096; t++) for (let f = 0; f < 2; f++) {
    const bit = ((z * 4096 + t) * 4) + f;
    if (data[bit >> 3] & (1 << (bit & 7))) {const b = z * 8192 + t * 2 + f; packed[b >> 3] |= 1 << (b & 7); any = true;}
  }
  if (!any) continue;
  const head = Buffer.alloc(5);
  head.writeUInt16LE(rx, 0); head.writeUInt16LE(ry, 2); head.writeUInt8(planes, 4);
  parts.push(head, packed);
  regionCount++;
}
const count = Buffer.alloc(4); count.writeUInt32LE(regionCount);
const collision = gzipSync(Buffer.concat([Buffer.from('SPCM'), count, ...parts]), {level: 9});
writeFileSync(join(OUT, 'collision.dat'), collision);

// ---------- Transports ----------
const tsv = file => {
  const lines = readFileSync(join(res, 'transports', file), 'utf8').split(/\r?\n/);
  const header = lines[0].replace(/^#\s*/, '').split('\t');
  const rows = [];
  let section = '';
  for (const line of lines.slice(1)) {
    if (!line.replace(/\t/g, '').trim()) continue;
    if (line.startsWith('#')) {section = line.replace(/^#\s*/, '').split('\t')[0].trim(); continue;}
    const cells = line.split('\t'), row = {section};
    header.forEach((h, i) => {row[h] = (cells[i] ?? '').trim();});
    rows.push(row);
  }
  return rows;
};
const point = s => {if (!s) return null; const [x, y, p] = s.split(/\s+/).map(Number); return Number.isFinite(p) ? [x, y, p] : null;};
const HOUSE = [1858, 7051, 0];
const isHouse = pt => pt && pt[0] === HOUSE[0] && pt[1] === HOUSE[1] && pt[2] === HOUSE[2];

const names = [], nameIndex = new Map();
const name = s => {if (!nameIndex.has(s)) {nameIndex.set(s, names.length); names.push(s);} return nameIndex.get(s);};
const reqs = [{}], reqIndex = new Map([['{}', 0]]);
function req(row, extra = {}) {
  const r = {};
  const quests = (row.Quests || '').split(/;/).map(q => q.trim()).filter(Boolean);
  if (quests.length) r.q = quests;
  const skills = [...(row.Skills || '').matchAll(/(\d+)\s+([A-Za-z]+)/g)].map(m => [m[2], Number(m[1])]);
  if (skills.length) r.s = skills;
  const coins = (row.Items || '').match(/COINS=(\d+)/);
  if (coins) r.c = Number(coins[1]);
  Object.assign(r, extra);
  const key = JSON.stringify(r);
  if (!reqIndex.has(key)) {reqIndex.set(key, reqs.length); reqs.push(r);}
  return reqIndex.get(key);
}
const KINDS = ['passage', 'shortcut', 'boat', 'ship', 'charter', 'canoe', 'minecart', 'carpet', 'lever', 'portal', 'fairy', 'spirit', 'glider', 'balloon', 'mushtree', 'quetzal', 'house'];
const kind = k => {const i = KINDS.indexOf(k); if (i < 0) throw Error(k); return i;};
const FEATURES = [''];
const feature = f => {if (!f) return 0; let i = FEATURES.indexOf(f); if (i < 0) {i = FEATURES.length; FEATURES.push(f);} return i;};
const edges = [];
const seenEdge = new Set();
function edge(from, to, ticks, k, label, r, f = '') {
  const key = [...from, ...to, k, label, f].join(',');
  if (seenEdge.has(key)) return;
  seenEdge.add(key);
  edges.push([...from, ...to, Math.max(1, Math.round(ticks)), kind(k), name(label), r, feature(f)]);
}
const ticksOf = (row, fallback) => {const n = Number(row.Duration); return Number.isFinite(n) && n > 0 ? n : fallback;};
const tidy = s => s.replace(/\s+\d+$/, '').replace(/\.$/, '').trim();// menuOption menuTarget objectID → drop the object ID

const DIRECT = [['transports.tsv', 'passage', 1], ['agility_shortcuts.tsv', 'shortcut', 4], ['boats.tsv', 'boat', 10], ['ships.tsv', 'ship', 10], ['charter_ships.tsv', 'charter', 10], ['canoes.tsv', 'canoe', 30], ['minecarts.tsv', 'minecart', 20], ['magic_carpets.tsv', 'carpet', 60], ['teleportation_levers.tsv', 'lever', 5], ['teleportation_portals.tsv', 'portal', 2]];
for (const [file, k, fallback] of DIRECT) for (const row of tsv(file)) {
  const from = point(row.Origin), to = point(row.Destination);
  if (!from || !to) continue;
  const label = tidy(row['menuOption menuTarget objectID'] || '');
  const info = row['Display info'] || '';
  const text = (k === 'passage' || k === 'shortcut' ? label : (info ? info.replace(/^\w+:\s*/, '') : label)).replace(/\.$/, '');
  edge(from, to, ticksOf(row, fallback), k, text, req(row));
}

// Networks: every origin reaches every destination (fairy rings, spirit trees, gliders, balloons, mushtrees, quetzals).
const NETWORKS = [['fairy_rings.tsv', 'fairy', 5, 6], ['spirit_trees.tsv', 'spirit', 5, 5], ['gnome_gliders.tsv', 'glider', 8, 6], ['hot_air_balloons.tsv', 'balloon', 8, 7], ['magic_mushtrees.tsv', 'mushtree', 5, 5], ['quetzals.tsv', 'quetzal', 6, 5]];
const stations = [];
// The Trinket of fairies rows describe every fairy ring code ("Fairy Ring - AIQ (Mudskipper Point)").
const RING_NAME = new Map(tsv('teleportation_items.tsv').map(r => (r['Display info'] || '').match(/Fairy Ring - ([A-Z]{3}) \((.+)\)/)).filter(Boolean).map(m => [m[1], m[2]]));
for (const [file, k, fallback, radius] of NETWORKS) {
  const rows = tsv(file), origins = [], dests = [];
  for (const row of rows) {
    const o = point(row.Origin), d = point(row.Destination);
    if (o && !d) origins.push({pt: o, row});
    else if (d && !o) dests.push({pt: d, row});
  }
  for (const d of dests) {
    const raw = (d.row['Display info'] || '').trim();
    const code = k === 'fairy' ? raw.replace(/\s+/g, '').split('-')[0] : raw.replace(/^\w+:\s*/, '');
    d.label = k === 'fairy' ? (code === 'ZANARIS' ? 'Zanaris' : code) : code || d.row.section;
    if (!isHouse(d.pt) && !raw.includes('-')) stations.push({k, label: d.label, detail: k === 'fairy' ? RING_NAME.get(code) : undefined, pt: d.pt});
    if (k === 'fairy' && RING_NAME.has(code)) d.label = `${code} (${RING_NAME.get(code)})`;
  }
  for (const o of origins) for (const d of dests) {
    if (Math.max(Math.abs(o.pt[0] - d.pt[0]), Math.abs(o.pt[1] - d.pt[1])) <= radius && o.pt[2] === d.pt[2]) continue;
    const merged = {Quests: [o.row.Quests, d.row.Quests].filter(Boolean).join(';'), Skills: [o.row.Skills, d.row.Skills].filter(Boolean).join(';'), Items: [o.row.Items, d.row.Items].filter(Boolean).join(';')};
    const f = isHouse(o.pt) || isHouse(d.pt) ? 'house-' + k : '';
    edge(o.pt, d.pt, Math.max(ticksOf(o.row, 0), ticksOf(d.row, 0)) || fallback, k, d.label, req(merged), f);
  }
}

// Player-owned house: furniture inside the house (at the house's instance tile) leads outside.
const BOX = {37492: 'box1', 37501: 'box2', 37520: 'box3', 13523: 'glory', 31986: 'mythical'};
for (const row of tsv('teleportation_boxes.tsv')) {
  const to = point(row.Destination), id = Number((row['menuOption menuTarget objectID'] || '').match(/(\d+)$/)?.[1]);
  const f = BOX[id] ?? (id >= 33411 && id <= 33415 ? 'xeric' : id >= 33417 && id <= 33419 ? 'digsite' : null);
  if (!to || !f) continue;
  edge(HOUSE, to, ticksOf(row, 4), 'house', (row['Display info'] || '').replace(/^\w+:\s*/, ''), 0, f);
}
const PORTALS = [];
for (const row of tsv('teleportation_portals_poh.tsv')) {
  const to = point(row.Destination), label = (row['Display info'] || '').replace(/ Portal$/, '').trim();
  if (!to || !label || /Respawn|Boat/.test(label)) continue;
  if (!PORTALS.includes(label)) PORTALS.push(label);
  edge(HOUSE, to, ticksOf(row, 1), 'house', label + ' portal', req(row), 'portal:' + label);
}

// ---------- Teleports: from wherever you stand (items, spells, minigames, house) ----------
const groups = [], groupIndex = new Map();
const ICON = {'Games necklace': 3853, 'Ring of dueling': 2552, 'Amulet of glory': 1712, 'Skills necklace': 11105, 'Combat bracelet': 11118, 'Ring of wealth': 11980, 'Ectophial': 4251, 'Teleport tablets': 8007};
function group(id, label, cat, item) {
  if (!groupIndex.has(id)) {
    const icon = ICON[label] ?? (item && existsSync(`public/items/${item}.png`) ? item : undefined);
    groupIndex.set(id, groups.length); groups.push({id, name: label, cat, ...(icon ? {icon} : {})});
  }
  return groupIndex.get(id);
}
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const JEWELLERY = ['Games necklace', 'Ring of dueling', 'Combat bracelet', 'Skills necklace', 'Amulet of glory', 'Ring of wealth', 'Slayer ring', 'Digsite pendant', 'Necklace of passage', 'Burning amulet', 'Giantsoul amulet', "Xeric's talisman", 'Pendant of ates', 'Ring of shadows', 'Ring of the elements', 'Camulet', 'Amulet of the eye', "Sailors' amulet", 'Cowbell amulet'];
const DIARY = ['Ardougne cloak', 'Karamja gloves', 'Desert amulet', 'Morytania legs', 'Fremennik sea boots', 'Kandarin headgear', 'Wilderness sword', 'Western banner', "Explorer's ring", "Rada's blessing"];
const CAPES = ['Max cape', 'Construction cape', 'Crafting cape', 'Quest point cape', 'Music cape', 'Achievement diary cape', 'Mythical cape', 'Farming cape', 'Fishing cape', 'Hunter cape', 'Strength cape'];
const MERGE = {'Amulet of eternal glory': 'Amulet of glory', 'Slayer ring (eternal)': 'Slayer ring', 'Eternal teleport crystal': 'Teleport crystal', 'Book of the dead': "Kharedst's memoirs", 'Enchanted lyre (i)': 'Enchanted lyre', 'Ring of wealth (i)': 'Ring of wealth'};
const KNOWN_VARBITS = new Set(['4070', '2187', '4744']);
const teleports = [], seenTeleport = new Set();
const HOUSE_NAMES = {1: 'Rimmington', 2: 'Taverley', 3: 'Pollnivneach', 4: 'Rellekka', 5: 'Brimhaven', 6: 'Yanille', 8: 'Hosidius', 9: 'Prifddinas', 13: 'Aldarin'};
const houseLocations = {};
function teleport(row, g, label, extra = {}) {
  const to = point(row.Destination);
  if (!to) return;
  const varbits = (row.Varbits || '').split(';').filter(Boolean);
  const book = varbits.find(v => v.startsWith('4070='))?.split('=')[1];
  const house = varbits.find(v => v.startsWith('2187='))?.split('=')[1];
  // A destination that needs a diary or other unlock (any other varbit) is kept and marked, so it can be switched off.
  const unlock = varbits.some(v => !KNOWN_VARBITS.has(v.split(/[=<>&@]/)[0]));
  const key = [g, label, ...to].join(',');
  if (seenTeleport.has(key)) return;
  seenTeleport.add(key);
  const t = {x: to[0], y: to[1], p: to[2], t: ticksOf(row, 4), g, n: name(label), r: req(row), w: Number(row['Wilderness level'] || 20)};
  if (book !== undefined) t.b = Number(book);
  if (house !== undefined) t.h = Number(house);
  if (isHouse(to)) t.in = 1;
  if (unlock) t.u = 1;
  Object.assign(t, extra);
  teleports.push(t);
}
for (const row of tsv('teleportation_items.tsv')) {
  const info = row['Display info'] || '';
  if (/Respawn/.test(info)) continue;
  if (/^Teleport to House|Tele to POH/.test(info) || (row.Varbits || '').includes('2187=') || point(row.Destination) && isHouse(point(row.Destination))) {
    teleport(row, group('house', 'Teleport to house', 'house'), 'Teleport to house');
    continue;
  }
  let base = info.split(':')[0].trim(), dest = info.includes(':') ? info.slice(info.indexOf(':') + 1).trim() : info;
  const section = row.section || '';
  let cat = 'other';
  if (/^Teleport tablets/.test(section) || / tablet$/.test(base)) {base = 'Teleport tablets'; cat = 'tablets';}
  else if (/^Teleport scrolls/.test(section) || /teleport$/i.test(base) || base.startsWith('Master scroll book')) {base = 'Teleport scrolls'; cat = 'tablets';}
  base = base.replace(/\s+\(?\d\)?$/, '');
  base = MERGE[base] ?? base;
  if (base.startsWith('Trinket of fairies')) base = 'Trinket of fairies';
  if (/ sphere$/.test(base)) base = 'Teleport spheres';
  if (JEWELLERY.includes(base)) cat = 'jewellery';
  else if (DIARY.includes(base)) cat = 'diary';
  else if (CAPES.includes(base)) cat = 'capes';
  else if (cat === 'other' && /Ectophial|lyre|crystal|seed pod|medallion|sceptre|memoirs|Chronicle|basalt|sphere|Hallowed/i.test(base)) cat = 'quest';
  const item = Number((row.Items || '').match(/^(\d+)=/)?.[1]);
  teleport(row, group(slug(base), base, cat, item), cat === 'tablets' || dest === info ? info : `${base}: ${dest}`);
}
const BOOKS = ['Standard', 'Ancient', 'Lunar', 'Arceuus'];
for (const row of tsv('teleportation_spells.tsv')) {
  const info = row['Display info'] || '';
  if (/Respawn/.test(info)) continue;
  if (/Teleport to House/.test(info)) {teleport(row, group('house', 'Teleport to house', 'house'), 'Teleport to house');
    const h = (row.Varbits || '').match(/2187=(\d+)/)?.[1], to = point(row.Destination);
    if (h && to && HOUSE_NAMES[h]) houseLocations[h] = {name: HOUSE_NAMES[h], x: to[0], y: to[1], p: to[2]};
    continue;}
  const book = Number((row.Varbits || '').match(/4070=(\d)/)?.[1] ?? 0);
  teleport(row, group('spells-' + slug(BOOKS[book]), BOOKS[book] + ' spellbook', 'spells'), info);
}
for (const row of tsv('teleportation_spells_home.tsv')) {
  if (!(row.VarPlayers || '').includes('4560=0') && !(row.VarPlayers || '').startsWith('892')) continue;
  teleport(row, group('home', 'Home teleport', 'home'), row['Display info'] || 'Home teleport');
}
for (const row of tsv('teleportation_minigames.tsv')) {
  if ((row.VarPlayers || '') && !(row.VarPlayers || '').includes('4560=0')) continue;
  teleport(row, group('minigames', 'Minigame teleports', 'minigame'), (row['Display info'] || '').replace(/ Minigame Teleport$/, ''));
}
for (const row of tsv('quetzal_whistle.tsv')) teleport(row, group('quetzal-whistle', 'Quetzal whistle', 'other', 29271), (row['Display info'] || '').replace(/^Quetzal whistle:\s*/, 'Quetzal whistle: '));

// ---------- Places: banks, transport stops, teleport arrivals and quest starts ----------
const places = [];
const banks = new Map();
for (const line of readFileSync(join(res, 'destinations/game_features/bank.tsv'), 'utf8').split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const [pt, info] = line.split('\t'), p = point(pt);
  if (!p || !info) continue;
  const key = info.trim() + '|' + p[2];
  if (!banks.has(key)) banks.set(key, []);
  banks.get(key).push(p);
}
for (const [key, pts] of banks) {
  // Split one town's bank tiles into separate banks when they are far apart.
  const clusters = [];
  for (const p of pts) {const c = clusters.find(c => Math.abs(c[0][0] - p[0]) < 24 && Math.abs(c[0][1] - p[1]) < 24); if (c) c.push(p); else clusters.push([p]);}
  for (const c of clusters) {
    const cx = c.reduce((s, p) => s + p[0], 0) / c.length, cy = c.reduce((s, p) => s + p[1], 0) / c.length;
    const best = c.reduce((a, p) => Math.hypot(p[0] - cx, p[1] - cy) < Math.hypot(a[0] - cx, a[1] - cy) ? p : a);
    const n = key.split('|')[0];
    places.push({k: 'bank', n: n === 'Bank Boat' ? n : n + ' bank', x: best[0], y: best[1], p: best[2]});
  }
}
// Town names for map labels, placed at the town's bank (the site's own short list in lib/guide-map.ts adds the rest).
const TOWNS = ['Aldarin', 'Arceuus', 'Auburnvale', 'Barbarian Outpost', 'Burgh de Rott', 'Darkmeyer', 'Etceteria', 'Ferox Enclave', 'Hosidius', 'Jatizso', 'Keldagrim', 'Lletya', 'Lovakengj', "Mos Le'Harmless", 'Nardah', 'Neitiznot', 'Port Khazard', 'Port Piscarilius', 'Prifddinas', 'Shayzien', 'Sophanem', 'Tal Teklan', 'Zanaris', 'Lunar Isle', 'Piscatoris', 'Ver Sinhaza', 'Mount Karuulm', 'Wintertodt Camp', 'Fossil Island Museum Camp', 'Lumbridge Castle', 'Shantay Pass', 'Port Roberts', 'Deepfin Point'];
for (const town of TOWNS) {
  const bank = places.find(p => p.k === 'bank' && p.n === town + ' bank');
  if (bank) places.push({k: 'town', n: town.replace(/ Castle$| Museum Camp$/, ''), x: bank.x, y: bank.y + 4, p: bank.p});
}
const STATION_NAME = {fairy: 'Fairy ring', spirit: 'Spirit tree', glider: 'Gnome glider', balloon: 'Balloon', mushtree: 'Magic mushtree', quetzal: 'Quetzal'};
for (const s of stations) places.push({k: s.k, n: s.k === 'fairy' ? `Fairy ring ${s.label}` : `${STATION_NAME[s.k]}: ${s.label}`, ...(s.detail ? {d: s.detail} : {}), x: s.pt[0], y: s.pt[1], p: s.pt[2]});
const charterSeen = new Set();
for (const [file, k] of [['charter_ships.tsv', 'charter'], ['ships.tsv', 'ship'], ['boats.tsv', 'boat']]) for (const row of tsv(file)) {
  const from = point(row.Origin);
  if (!from) continue;
  const key = k + Math.round(from[0] / 8) + ',' + Math.round(from[1] / 8);
  if (charterSeen.has(key)) continue;
  charterSeen.add(key);
  const label = (k === 'charter' ? 'Charter ship: ' : k === 'ship' ? 'Ship: ' : 'Boat: ') + (row.section || tidy(row['menuOption menuTarget objectID'] || '')).split(',')[0];
  places.push({k: 'boat', n: label, x: from[0], y: from[1], p: from[2]});
}
for (const t of teleports) {
  if (t.in || groups[t.g].cat === 'house') continue;
  // Name the place, not the item: "Games necklace: Burthorpe" is Burthorpe, "Varrock Teleport" is Varrock.
  const label = names[t.n];
  let place = (label.includes(': ') ? label.slice(label.lastIndexOf(': ') + 2).replace(/^[0-9A-Z]\.\s*/, '') : label).replace(/ (Home )?(Teleport|teleport|tablet|Minigame Teleport)$/, '');
  if (place === 'GE') place = 'Grand Exchange';
  if (place.length < 4 || /^Teleport$/i.test(place)) place = label;
  places.push({k: 'teleport', n: place, ...(place !== label ? {d: label} : {}), x: t.x, y: t.y, p: t.p});
}

const reference = JSON.parse(readFileSync('lib/quest-reference.json', 'utf8')).quests;
const QUEST_ALIAS = {'RFD - Start': "Recipe for Disaster/Another Cook's Quest", 'RFD - Wartface & Bentnoze': 'Recipe for Disaster/Freeing the Goblin generals', 'RFD - Mountain Dwarf': 'Recipe for Disaster/Freeing the Mountain Dwarf', 'RFD - Evil Dave': 'Recipe for Disaster/Freeing Evil Dave', 'RFD - Pirate Pete': 'Recipe for Disaster/Freeing Pirate Pete', 'RFD - Lumbridge Guide': 'Recipe for Disaster/Freeing the Lumbridge Guide', 'RFD - Sir Amik Varze': 'Recipe for Disaster/Freeing Sir Amik Varze', 'RFD - King Awowogei': 'Recipe for Disaster/Freeing King Awowogei', 'RFD - Skrach Uglogwee': 'Recipe for Disaster/Freeing Skrach Uglogwee', 'Shield of Arrav - Phoenix Gang': 'Shield of Arrav', 'Shield of Arrav - Black Arm Gang': 'Shield of Arrav', 'Vale Totems': 'Vale Totems (miniquest)'};
const quests = [];
const questSeen = new Set();
for (const q of JSON.parse(readFileSync(stagesFile, 'utf8'))) {
  const start = q.contacts.find(c => c.isStart && Number.isInteger(c.x) && /^Quest Helper/.test(c.locationSource || ''));
  if (!start) continue;
  const refName = QUEST_ALIAS[q.quest] ?? q.quest, ref = reference[refName];
  const title = refName.startsWith('Recipe for Disaster/') ? 'RFD: ' + refName.split('/')[1] : refName;
  const key = title + start.x + start.y;
  if (questSeen.has(key)) continue;
  questSeen.add(key);
  quests.push({n: title, x: start.x, y: start.y, p: start.plane, ...(ref?.difficulty ? {d: ref.difficulty} : {}), ...(ref?.length ? {l: ref.length} : {}), ...(ref?.start ? {s: ref.start.replace(/\s+/g, ' ').slice(0, 220)} : {}), ...(start.interaction !== 'Object' && start.npcName ? {npc: start.npcName} : {}), ...(refName !== title ? {a: refName} : {})});
}
quests.sort((a, b) => a.n.localeCompare(b.n));

const travel = {v: 1, source: {shortestPath: SHORTEST_PATH_COMMIT}, kinds: KINDS, features: FEATURES, names, reqs, edges, groups, teleports, houses: houseLocations, portals: PORTALS, house: HOUSE};
writeFileSync(join(OUT, 'travel.json'), JSON.stringify(travel));
// What the travel options dialog lists, without the routing data.
writeFileSync(join(OUT, 'travel-options.json'), JSON.stringify({v: 1, groups, houses: houseLocations, portals: PORTALS}));
writeFileSync(join(OUT, 'places.json'), JSON.stringify({v: 1, places, quests}));
console.log(JSON.stringify({regions: regionCount, collisionBytes: collision.length, edges: edges.length, teleports: teleports.length, groups: groups.length, places: places.length, quests: quests.length, portals: PORTALS.length}));
