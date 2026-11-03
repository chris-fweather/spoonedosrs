/** Places on the world map: towns, banks, transport stops, teleport arrivals and quest starts (public/world-map/places.json),
 * and the search that finds them. */
import {MAP_PLACES} from './guide-map';
import type {TeleportArrival} from './world-map-routing';
import {UNDERGROUND} from './world-map-underground';
import {GAME_ICON, GAME_SPRITE} from './world-map-game-icons';

export type PlaceKind = 'town' | 'quest' | 'bank' | 'teleport' | 'fairy' | 'spirit' | 'glider' | 'balloon' | 'mushtree' | 'quetzal' | 'boat' | 'dungeon';
export type QuestInfo = {name: string; difficulty?: string; length?: string; start?: string; npc?: string};
/** One teleport that lands at a teleport marker, and whether the player's travel options include it. `label` is the
 * short row text under the marker's name (see teleportRowName). */
export type TeleportLine = {name: string; label: string; via: string; icon: string; ok: boolean};
/** A place on the map. A teleport marker lists every teleport landing there (`teleports`), and is `off` when the player
 * can use none of them. */
export type MapPlace = {id: string; kind: PlaceKind; name: string; detail?: string; x: number; y: number; plane: number; quest?: QuestInfo; teleports?: TeleportLine[]; off?: boolean};
type RawPlace = {k: string; n: string; d?: string; x: number; y: number; p: number};
type RawQuest = {n: string; x: number; y: number; p: number; d?: string; l?: string; s?: string; npc?: string; a?: string};
export type PlacesFile = {v: 1; places: RawPlace[]; quests: RawQuest[]};

export const LAYERS = [
  {id: 'quest', label: 'Quests', kinds: ['quest']},
  {id: 'transport', label: 'Transport', kinds: ['fairy', 'spirit', 'glider', 'balloon', 'mushtree', 'quetzal', 'boat']},
  {id: 'teleport', label: 'Teleports', kinds: ['teleport']},
  {id: 'bank', label: 'Banks', kinds: ['bank']},
] as const;
export type LayerId = (typeof LAYERS)[number]['id'];
export const DEFAULT_LAYERS: LayerId[] = ['quest', 'transport', 'bank'];
const KINDS = new Set<string>(['town', 'quest', 'bank', 'teleport', 'fairy', 'spirit', 'glider', 'balloon', 'mushtree', 'quetzal', 'boat']);

export const KIND_LABEL: Record<PlaceKind, string> = {town: 'Town', quest: 'Quest start', bank: 'Bank', teleport: 'Teleport', fairy: 'Fairy ring', spirit: 'Spirit tree', glider: 'Gnome glider', balloon: 'Balloon', mushtree: 'Magic mushtree', quetzal: 'Quetzal', boat: 'Boat', dungeon: 'Underground'};
/** A quest difficulty's orb (public/icons/tiers), as on the quest list and the guide topic picker; empty for one the game
 * does not have. */
const DIFFICULTIES = new Set(['Novice', 'Intermediate', 'Experienced', 'Master', 'Grandmaster', 'Special']);
export const difficultyIcon = (d?: string) => d && DIFFICULTIES.has(d) ? `/icons/tiers/${d.toLowerCase()}.png` : '';
/** Our own map art (public/icons/map), kept only where the game has nothing of its own (town search results). */
export const MAP_ICON = (name: string) => `/icons/map/${name}.png`;
/** The game's own sprites standing in for our old drawings (public/icons/game, built by scripts/build-game-sprites.mjs). */
export const GAME_UI_ICON = (name: string) => `/icons/game/${name}.png`;
/** The game's map function for each kind: it draws every kind of transport with its one Transportation icon. A teleport
 * with no spell, tablet or item art of its own shows the Home Teleport spell. Towns have no game icon and keep ours. */
const TRANSPORT = GAME_ICON(GAME_SPRITE.transport);
export const KIND_ICON: Record<PlaceKind, string> = {
  town: MAP_ICON('town'), quest: GAME_ICON(GAME_SPRITE.quest), bank: GAME_ICON(GAME_SPRITE.bank), teleport: '/icons/spells/lumbridge-home-teleport.png', dungeon: GAME_ICON(GAME_SPRITE.dungeon),
  fairy: TRANSPORT, spirit: TRANSPORT, glider: TRANSPORT, balloon: TRANSPORT, mushtree: TRANSPORT, quetzal: TRANSPORT, boat: TRANSPORT,
};
/** Route line colours by how you travel (a trip with stops draws each leg in its own colour instead). */
export const ROUTE_COLOUR: Record<string, string> = {walk: '#ffcf3f', teleport: '#f0a6ff', fairy: '#c58cff', spirit: '#7ddc6c', glider: '#9fd7ff', balloon: '#9fd7ff', quetzal: '#9fd7ff', boat: '#6fb6ff', ship: '#6fb6ff', charter: '#6fb6ff', canoe: '#6fb6ff', minecart: '#d2ad72', carpet: '#d2ad72', mushtree: '#7ddc6c', shortcut: '#ff981f'};
/** The game's map functions for travel that has no place kind (Travel options, route steps): every other kind of
 * transport (charter ships, canoes, minecarts, carpets, levers) is Transportation too. */
export const TRAVEL_ICON = {
  transport: TRANSPORT, shortcut: GAME_ICON(GAME_SPRITE.shortcut), housePortal: GAME_ICON(GAME_SPRITE.housePortal), passage: GAME_ICON(GAME_SPRITE.dungeon),
  /** The game has no fairy ring or spirit tree sprite of its own (its map draws both as Transportation), so lists, routes
   * and Travel options show the Dramen staff that opens fairy rings, and our own drawing of a spirit tree. */
  fairy: '/items/772.png', spirit: MAP_ICON('spirit-tree'),
} as const;
/** A place's icon in lists and its card: the map marker's, except fairy rings and spirit trees, which show their own art
 * there (the map itself keeps the game's Transportation icon for them). */
export const listIcon = (p: MapPlace) => p.kind === 'fairy' ? TRAVEL_ICON.fairy : p.kind === 'spirit' ? TRAVEL_ICON.spirit : markerIcon(p);

// ---------- Teleport art: the game's spell icons, otherwise the item ----------
/** Official item art (public/items, 36×32). */
export const ITEM_ICON = (id: number) => `/items/${id}.png`;
/** Official spell art from the spellbook (public/icons/spells). */
const SPELL_ICON = (file: string) => `/icons/spells/${file}.png`;
/** Teleport items by name, for their item art: the travel data's own item ids, plus the items it has no id for. */
export const TELEPORT_ITEM: Record<string, number> = {
  'Ardougne cloak': 13121, 'Karamja gloves': 11140, 'Desert amulet': 13134, 'Morytania legs': 13112, 'Fremennik sea boots': 13129, 'Kandarin headgear': 13139,
  'Wilderness sword': 13110, 'Western banner': 13143, "Explorer's ring": 13126, "Rada's blessing": 22941,
  'Games necklace': 3853, 'Ring of dueling': 2552, 'Combat bracelet': 11118, 'Skills necklace': 11105, 'Amulet of glory': 1712, 'Ring of wealth': 11980,
  'Slayer ring': 11866, 'Digsite pendant': 11190, 'Necklace of passage': 21146, 'Burning amulet': 21166, 'Camulet': 6707, "Xeric's talisman": 13393,
  'Amulet of the eye': 26914, 'Ring of the elements': 26815, 'Ring of shadows': 28327, 'Pendant of ates': 29893, 'Giantsoul amulet': 30637,
  "Sailors' amulet": 32399, 'Cowbell amulet': 33103,
  'Crafting cape': 9780, 'Construction cape': 9789, 'Fishing cape': 9798, 'Farming cape': 9810, 'Hunter cape': 9948, 'Strength cape': 9750, 'Max cape': 13280,
  'Quest point cape': 9813, 'Music cape': 13221, 'Achievement diary cape': 13069, 'Mythical cape': 22114,
  'Ectophial': 4251, 'Teleport crystal': 6099, 'Royal seed pod': 19564, 'Grand seed pod': 9469, 'Enchanted lyre': 3691, "Kharedst's memoirs": 21760,
  "Drakan's medallion": 22400, 'Stony basalt': 22601, 'Icy basalt': 22599, "Pharaoh's sceptre": 9044, 'Skull sceptre': 9013, 'Chronicle': 13660,
  'Trinket of fairies': 28564, 'Quetzal whistle': 29271, 'Teleport tablets': 8007, 'Teleport scrolls': 12402,
};
/** Teleport tablets and scrolls by destination (slug), for their item art. The redirected house tablets (Rimmington,
 * Taverley and the rest) have no art in public/items, so they show the house tablet they are made from. */
const HOUSE_TABLET = 8013;
const TABLET_ITEM: Record<string, number> = {
  varrock: 8007, lumbridge: 8008, falador: 8009, camelot: 8010, ardougne: 8011, watchtower: 8012, house: HOUSE_TABLET,
  annakarl: 12775, carrallanger: 12776, dareeyak: 12777, ghorrock: 12778, kharyrll: 12779, lassar: 12780, paddewwa: 12781, senntisten: 12782,
  'arceuus-library': 19613, 'draynor-manor': 19615, 'mind-altar': 19617, 'salve-graveyard': 19619, 'fenkenstrains-castle': 19621, 'west-ardougne': 19623,
  'harmony-island': 19625, cemetery: 19627, barrows: 19629, 'ape-atoll': 19631, battlefront: 22949, 'volcanic-mine': 21541, 'wilderness-crabs': 24251,
  moonclan: 24949, ourania: 24951, waterbirth: 24953, barbarian: 24955, khazard: 24957, 'fishing-guild': 24959, catherby: 24961, 'ice-plateau': 24963,
  'kourend-castle': 28790, 'civitas-illa-fortis': 28824,
  nardah: 12402, digsite: 12403, 'feldip-hills': 12404, 'lunar-isle': 12405, mortton: 12406, 'pest-control': 12407, piscatoris: 12408,
  'tai-bwo-wannai': 12409, 'iorwerth-camp': 12410, 'mos-leharmless': 12411, lumberyard: 12642, 'zul-andra': 12938, 'key-master': 13249,
  'revenant-cave': 21802, watson: 23387,
  ...Object.fromEntries(['rimmington', 'taverley', 'pollnivneach', 'rellekka', 'brimhaven', 'yanille', 'trollheim', 'hosidius', 'prifddinas', 'aldarin'].map(t => [t, HOUSE_TABLET])),
};
/** Spell names whose icon file is named differently, and spells with no icon of their own in public/icons/spells (the
 * other books' home teleports show the standard one; Battlefront has none, so it keeps its spellbook). */
const SPELL_FILE: Record<string, string | null> = {
  'carrallanger-teleport': 'carrallangar-teleport', 'edgeville-home-teleport': 'lumbridge-home-teleport', 'lunar-home-teleport': 'lumbridge-home-teleport',
  'arceuus-home-teleport': 'lumbridge-home-teleport', 'battlefront-teleport': null,
};
/** Spells by spellbook, for the spellbook icon where a spell has no art of its own; anything else is standard. */
const SPELLBOOK_SPELLS: [string, string[]][] = [ // after the standard spellbook, in SPELLBOOK_ICON order
  ['ancient', ['Paddewwa', 'Senntisten', 'Kharyrll', 'Lassar', 'Dareeyak', 'Carrallanger', 'Annakarl', 'Ghorrock', 'Edgeville Home']],
  ['lunar', ['Moonclan', 'Ourania', 'Waterbirth', 'Barbarian', 'Khazard', 'Fishing Guild', 'Catherby', 'Ice Plateau', 'Lunar Home']],
  ['arceuus', ['Arceuus Library', 'Draynor Manor', 'Battlefront', 'Mind Altar', 'Salve Graveyard', "Fenkenstrain's Castle", 'West Ardougne', 'Harmony Island', 'Cemetery', 'Barrows', 'Arceuus Home']],
];
/** The game's spellbook tab icons, for a spellbook as a whole (Travel options) and spells without art. */
export const SPELLBOOK_ICON = ['standard', 'ancient', 'lunar', 'arceuus'].map(b => GAME_UI_ICON('spellbook-' + b));
const slug = (s: string) => s.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A spell's own icon from the spellbook ("Varrock Teleport: Grand Exchange" is varrock-teleport.png), or its
 * spellbook's icon when the game art is missing. */
export function spellIcon(name: string): string {
  const spell = name.replace(/:.*$/, '').trim(), file = spell.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const mapped = file in SPELL_FILE ? SPELL_FILE[file] : file;
  if (mapped) return SPELL_ICON(mapped);
  // The game has no spell art here (Battlefront): its tablet's item art.
  if (TABLET_ITEM[file.replace(/-teleport$/, '')]) return ITEM_ICON(TABLET_ITEM[file.replace(/-teleport$/, '')]);
  const book = SPELLBOOK_SPELLS.findIndex(([, names]) => names.some(n => spell.startsWith(n + ' ')));
  return SPELLBOOK_ICON[book + 1];
}
/** A tablet's or scroll's icon from its name ("Varrock tablet: GE", "Master scroll book: Nardah teleport"): its item
 * art, or null for one we don't know. */
export function tabletIcon(name: string): string | null {
  const dest = slug(name.replace(/^Master scroll book: /, '').replace(/:.*$/, '').replace(/ (tablet|teleport)$/i, ''));
  const id = TABLET_ITEM[dest];
  return id ? ITEM_ICON(id) : null;
}
/** A teleport item's icon by name: the item's own art. */
function itemArt(name: string, item?: number): string | null {
  const id = item ?? TELEPORT_ITEM[name];
  return id ? ITEM_ICON(id) : null;
}

/** Minigame teleports: the game's minigame grouping tab icon. */
export const MINIGAME_ICON = GAME_UI_ICON('minigame');
/** The icon for one place: a teleport's spell or item art, or its kind's icon (charter ships are transport). */
export function placeIcon(p: Pick<MapPlace, 'kind' | 'name' | 'detail'>): string {
  if (p.kind !== 'teleport') return KIND_ICON[p.kind];
  const label = p.detail ?? p.name, source = label.split(':')[0].trim();
  if (TELEPORT_ITEM[source] && source !== 'Teleport tablets' && source !== 'Teleport scrolls') return itemArt(source)!;
  if (/ tablet$| teleport$|^Master scroll book$/.test(source)) return tabletIcon(label) ?? KIND_ICON.teleport;
  if (/Minigame Teleport$/.test(source)) return MINIGAME_ICON;
  if (/ Teleport$/.test(source)) return spellIcon(source);
  return KIND_ICON.teleport;
}

const SPELLBOOK_IDS = ['standard', 'ancient', 'lunar', 'arceuus'];
/** The icon for a group of teleports (travel.json groups): its spellbook, the home teleport and Teleport to house
 * spells, the minigame tab icon, or the item's own art. */
export function teleportGroupIcon(id: string, name: string, item?: number): string {
  if (id.startsWith('spells-') && SPELLBOOK_IDS.includes(id.slice(7))) return SPELLBOOK_ICON[SPELLBOOK_IDS.indexOf(id.slice(7))];
  if (id === 'home') return SPELL_ICON('lumbridge-home-teleport');
  if (id === 'minigames') return MINIGAME_ICON;
  if (id === 'house') return SPELL_ICON('teleport-to-house');
  if (id === 'teleport-tablets') return ITEM_ICON(TABLET_ITEM.varrock);
  return itemArt(name, item) ?? KIND_ICON.teleport;
}
/** One teleport's own icon: a spell's spellbook art, a tablet's or scroll's item art, otherwise its group's icon (the
 * item, or the minigame tab icon). Used on markers, hover lists, the place card, search, route steps
 * and Travel options. */
export function teleportIcon(a: {name: string; group: string; groupName: string; item?: number}): string {
  if (a.group.startsWith('spells-') || a.group === 'home') return spellIcon(a.name);
  if (a.group === 'house') return SPELL_ICON('teleport-to-house');
  if (a.group === 'teleport-tablets' || a.group === 'teleport-scrolls') return tabletIcon(a.name) ?? teleportGroupIcon(a.group, a.groupName, a.item);
  return teleportGroupIcon(a.group, a.groupName, a.item);
}

/** Turn the data file into places, adding the site's own town list and dropping towns already labelled. */
export function readPlaces(file: PlacesFile): MapPlace[] {
  const out: MapPlace[] = MAP_PLACES.map(p => ({id: 'town:' + p.name, kind: 'town', name: p.name, x: p.x, y: p.y, plane: 0}));
  const towns = new Set(out.map(p => p.name));
  file.places.forEach((p, i) => {
    if (!KINDS.has(p.k) || (p.k === 'town' && towns.has(p.n))) return;
    out.push({id: p.k + ':' + i, kind: p.k as PlaceKind, name: p.n, ...(p.d ? {detail: p.d} : {}), x: p.x, y: p.y, plane: p.p});
  });
  file.quests.forEach((q, i) => out.push({id: 'quest:' + i, kind: 'quest', name: q.n, x: q.x, y: q.y, plane: q.p, quest: {name: q.a ?? q.n, difficulty: q.d, length: q.l, start: q.s, npc: q.npc}}));
  // Dungeons and other underground areas, for search (they have no marker: their entrances do).
  UNDERGROUND.forEach(u => out.push({id: 'dungeon:' + u.name, kind: 'dungeon', name: u.name, x: u.x, y: u.y, plane: u.plane}));
  return out;
}

const RANK: Record<PlaceKind, number> = {town: 0, quest: 1, dungeon: 2, bank: 2, fairy: 3, spirit: 3, glider: 3, balloon: 3, mushtree: 3, quetzal: 3, boat: 3, teleport: 4};
const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '');

/** Places matching the words typed: whole-name starts first, then word starts, then anywhere; towns before the rest.
 * "AIQ" or "a i q" finds a fairy ring code, and "3222 3218" a tile. */
export function searchPlaces(places: MapPlace[], query: string, limit = 8): MapPlace[] {
  const q = fold(query).trim();
  if (!q) return [];
  const tile = query.trim().match(/^(\d{3,5})[\s,]+(\d{3,5})(?:[\s,]+([0-3]))?$/);
  if (tile) return [{id: 'tile', kind: 'town', name: `Tile ${tile[1]}, ${tile[2]}`, x: Number(tile[1]), y: Number(tile[2]), plane: Number(tile[3] ?? 0)}];
  const compact = q.replace(/ /g, '');
  const scored: {p: MapPlace; score: number}[] = [];
  for (const p of places) {
    const name = fold(p.name), words = name.split(' ');
    let score: number;
    if (name === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (words.some(w => w.startsWith(q)) || name.includes(' ' + q)) score = 2;
    else if (name.includes(q)) score = 3;
    else if (p.detail && fold(p.detail).includes(q)) score = 4;
    else if (p.kind === 'fairy' && compact.length === 3 && name.replace(/ /g, '').endsWith(compact)) score = 1;
    else continue;
    scored.push({p, score: score * 10 + RANK[p.kind]});
  }
  scored.sort((a, b) => a.score - b.score || a.p.name.length - b.p.name.length || a.p.name.localeCompare(b.p.name));
  const seen = new Set<string>(), out: MapPlace[] = [];
  for (const {p} of scored) {
    const key = p.name + '|' + Math.round(p.x / 16) + ',' + Math.round(p.y / 16);
    if (seen.has(key)) continue;
    seen.add(key); out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** The closest named place to a tile, for describing a clicked spot ("Near Varrock"). */
export function nearestPlace(places: MapPlace[], x: number, y: number, plane: number, kinds: PlaceKind[] = ['town', 'bank', 'quest', 'fairy', 'spirit', 'teleport']): MapPlace | null {
  let best: MapPlace | null = null, distance = Infinity;
  for (const p of places) {
    if (p.plane !== plane || !kinds.includes(p.kind)) continue;
    const d = Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) + (p.kind === 'town' ? -20 : 0);
    if (d < distance) {distance = d; best = p;}
  }
  return best && distance < 120 ? best : null;
}

/** The town nearest a tile within `reach` tiles, for naming a floor ("Lumbridge 1st floor") or a way out. */
export function townNear(places: Pick<MapPlace, 'kind' | 'name' | 'x' | 'y'>[], t: {x: number; y: number}, reach = 48): string | null {
  let best: string | null = null, distance = reach + 1;
  for (const p of places) {
    if (p.kind !== 'town') continue;
    const d = Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y));
    if (d < distance) {distance = d; best = p.name;}
  }
  return best;
}

// ---------- The Teleports layer ----------
/** The place a teleport lands at, from its name: "Games necklace: Burthorpe" is Burthorpe, "Varrock Teleport" Varrock. */
export function teleportPlaceName(label: string): string {
  let place = (label.includes(': ') ? label.slice(label.lastIndexOf(': ') + 2).replace(/^[0-9A-Z]\. /, '') : label).replace(/ (Home )?(Teleport|teleport|tablet|Minigame Teleport)$/, '');
  if (place === 'GE') place = 'Grand Exchange';
  return place.length < 4 || /^Teleport$/i.test(place) ? label : place;
}
const ONE: Record<string, string> = {'Teleport tablets': 'Teleport tablet', 'Teleport scrolls': 'Teleport scroll'};
/** A teleport's row under a marker that already names the place: "Master scroll book: Nardah teleport" is "Master scroll
 * book", "Amulet of glory: Edgeville" under Edgeville is "Amulet of glory", and a plain "Varrock tablet" under Varrock
 * is "Teleport tablet" (a spell, its spellbook). Anything naming another place stays whole. */
export function teleportRowName(name: string, via: string, place: string): string {
  if (name.startsWith('Master scroll book: ')) return 'Master scroll book';
  if (teleportPlaceName(name).toLowerCase() !== place.toLowerCase()) return name;
  if (name.includes(': ')) return name.slice(0, name.lastIndexOf(': '));
  return ONE[via] ?? via;
}
/** One teleport's icon on the Teleports layer (see `teleportIcon`). */
export const arrivalIcon = (a: Pick<TeleportArrival, 'name' | 'group' | 'groupName' | 'item'>) => teleportIcon(a);
/** How much an icon says about a teleport, for choosing a marker's icon: spell and tablet art name the place. */
const ICON_RANK: Record<string, number> = {spells: 0, tablets: 1, home: 2, jewellery: 3, minigame: 4, diary: 5, capes: 7};

/** The Teleports layer: teleports landing within `reach` tiles of each other on one floor share a marker, named after
 * the place most of them name and drawn with the clearest icon of the ones the player can use. */
export function groupTeleports(list: TeleportArrival[], reach = 3): MapPlace[] {
  const groups: {x: number; y: number; plane: number; members: TeleportArrival[]}[] = [];
  for (const a of list) {
    const g = groups.find(g => g.plane === a.plane && Math.abs(g.x - a.x) <= reach && Math.abs(g.y - a.y) <= reach);
    if (g) g.members.push(a); else groups.push({x: a.x, y: a.y, plane: a.plane, members: [a]});
  }
  return groups.map(g => {
    const members = [...g.members].sort((a, b) => Number(b.ok) - Number(a.ok) || (ICON_RANK[a.cat] ?? 6) - (ICON_RANK[b.cat] ?? 6));
    const names = new Map<string, number>();
    for (const m of members) {const n = teleportPlaceName(m.name); names.set(n, (names.get(n) ?? 0) + 1);}
    const name = [...names].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
    const teleports = members.map(m => ({name: m.name, label: teleportRowName(m.name, m.groupName, name), via: m.groupName, icon: arrivalIcon(m), ok: m.ok}));
    const off = !members.some(m => m.ok);
    return {id: `teleport:${g.x},${g.y},${g.plane}`, kind: 'teleport' as const, name, detail: members.length === 1 ? members[0].name : `${members.length} teleports`, x: g.x, y: g.y, plane: g.plane, teleports, ...(off ? {off} : {})};
  });
}
/** The icon a place's marker shows: a teleport marker's clearest teleport, or the place's own icon. */
export const markerIcon = (p: MapPlace) => p.teleports?.[0]?.icon ?? placeIcon(p);
