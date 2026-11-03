/** The ways to reach a guide map's teleport stop: every teleport in the travel data (public/world-map/travel.json) that
 * lands within a few tiles of it (spells, tablets, jewellery, diary items…), each with its game icon, and the one the
 * stop's own label names ("Glory teleport to Edgeville" names the Amulet of glory). */
import type {TravelData} from './world-map-routing';
import {ITEM_ICON,TELEPORT_ITEM,TRAVEL_ICON,spellIcon,tabletIcon,teleportIcon} from './world-map-places';
import {GUIDE_SPELLS} from './guide-references';
import {MAP_PIN_HINT,MAP_PIN_ICON,stopIcon,type GuideMapPin} from './guide-map';

export type StopTeleport = {name: string; via: string; icon: string; named: boolean};
type Spot = {x: number; y: number; plane: number};
/** How far from a stop a teleport may land and still count as a way there, in tiles. */
export const TELEPORT_REACH = 10;
export const TELEPORT_LIMIT = 6;
/** Spells and tablets name the place, so they come first; then the home teleport, jewellery and the rest. */
const RANK: Record<string, number> = {spells: 0, tablets: 1, home: 2, jewellery: 3, diary: 4, quest: 5, capes: 6, minigame: 7, other: 8};
const STOP_WORDS = new Set(['teleport', 'teleports', 'to', 'the', 'of', 'a', 'an', 'via', 'and', 'or', 'then', 'from', 'with', 'spawn', 'lvl']);
const ALIAS: Record<string, string> = {tab: 'tablet', tabs: 'tablet', tablets: 'tablet', ammy: 'amulet', necklaces: 'necklace', glories: 'glory'};
const words = (text: string) => new Set(text.toLowerCase().replace(/['’]/g, '').split(/[^a-z0-9]+/).map(w => ALIAS[w] ?? w).filter(w => w && !STOP_WORDS.has(w)));

/** The teleports landing near a stop, nearest and clearest first (one row per teleport name), up to TELEPORT_LIMIT. The
 * house's own portals are left out: they depend on the player's house. */
export function teleportsNear(data: Pick<TravelData, 'groups' | 'names' | 'teleports'>, at: Spot, label = '', reach = TELEPORT_REACH): StopTeleport[] {
  const found = new Map<string, {name: string; via: string; icon: string; far: number; rank: number}>();
  for (const t of data.teleports) {
    const g = data.groups[t.g];
    if (!g || t.in || g.cat === 'house' || t.p !== at.plane) continue;
    const far = Math.max(Math.abs(t.x - at.x), Math.abs(t.y - at.y));
    if (far > reach) continue;
    const name = data.names[t.n], prior = found.get(name);
    if (prior && prior.far <= far) continue;
    found.set(name, {name, via: g.name, icon: teleportIcon({name, group: g.id, groupName: g.name, ...(g.icon ? {item: g.icon} : {})}), far, rank: RANK[g.cat] ?? 9});
  }
  const list = [...found.values()].sort((a, b) => a.rank - b.rank || a.far - b.far || a.name.localeCompare(b.name)).slice(0, TELEPORT_LIMIT);
  const named = namedTeleport(label, list);
  return list.map(({name, via, icon}, i) => ({name, via, icon, named: i === named}));
}

/** Which of the teleports a stop's label names: the one sharing the most words with it (its name and its group's, so
 * "Glory" finds "Amulet of glory: Edgeville"), with a bonus for the whole name ("Lumbridge teleport" is the spell, not
 * the tablet). -1 when no word matches or two teleports tie. */
export function namedTeleport(label: string, list: {name: string; via: string}[]): number {
  const said = words(label), text = label.toLowerCase();
  if (!said.size) return -1;
  const scores = list.map(t => {let n = 0; for (const w of words(t.name + ' ' + t.via)) if (said.has(w)) n++; return n && text.includes(t.name.toLowerCase()) ? n + 5 : n;});
  const best = Math.max(0, ...scores);
  return best > 0 && scores.filter(s => s === best).length === 1 ? scores.indexOf(best) : -1;
}

/** A way to travel a stop names, with its icon: the item's own art (Amulet of glory), a tablet's, a spell's spellbook art,
 * or the game's Transportation map icon for spirit trees, fairy rings, gliders, boats and the like (the game draws them
 * all with it; the cache has no spirit-tree icon of its own). */
export type TravelMethod = {name: string; icon: string};
const TRANSPORTS: [RegExp, string][] = [
  [/spirit tree/, 'Spirit tree'], [/fairy ring/, 'Fairy ring'], [/glider/, 'Gnome glider'], [/balloon/, 'Balloon'], [/mushtree/, 'Magic mushtree'],
  [/quetzal/, 'Quetzal'], [/charter/, 'Charter ship'], [/\b(boat|ship|ferry)\b/, 'Boat'], [/canoe/, 'Canoe'], [/minecart/, 'Minecart'], [/(magic )?carpet/, 'Magic carpet'],
];
/** Short names writers use for teleport items. */
const ITEM_ALIAS: Record<string, string> = {glory: 'Amulet of glory', 'games neck': 'Games necklace', 'skills neck': 'Skills necklace', 'duel ring': 'Ring of dueling', dueling: 'Ring of dueling', 'ring of duelling': 'Ring of dueling', 'wealth': 'Ring of wealth', 'xeric': "Xeric's talisman", 'passage': 'Necklace of passage', 'digsite': 'Digsite pendant'};
const ITEMS = Object.keys(TELEPORT_ITEM).sort((a, b) => b.length - a.length);
const SPELLS = GUIDE_SPELLS.filter(s => / Teleport$/.test(s)).sort((a, b) => b.length - a.length);
/** The way to travel a piece of text names ("Glory teleport to Edgeville", "Spirit tree", "Varrock teleport", "Varrock
 * tab"), or null when it names none. Items win over spells, so "Skills necklace teleport" is the necklace. */
export function travelMethod(text: string): TravelMethod | null {
  const t = text.toLowerCase().replace(/['’]/g, "'");
  for (const [re, name] of TRANSPORTS) if (re.test(t)) return {name, icon: TRAVEL_ICON.transport};
  const item = ITEMS.find(n => t.includes(n.toLowerCase())) ?? Object.entries(ITEM_ALIAS).find(([k]) => new RegExp(`\\b${k}\\b`).test(t))?.[1];
  if (item && TELEPORT_ITEM[item]) return {name: item, icon: ITEM_ICON(TELEPORT_ITEM[item])};
  // A tablet: the place is the one to three words before "tab" or "tablet" ("Varrock tab", "a West Ardougne tablet").
  const tab = t.match(/([a-z' ]+?) (?:teleport )?(?:tab|tablet)s?\b/);
  if (tab) for (const n of [3, 2, 1]) {const place = tab[1].trim().split(/\s+/).slice(-n).join(' '), name = place.replace(/\b\w/g, c => c.toUpperCase()) + ' tablet', icon = tabletIcon(name); if (icon) return {name, icon};}
  if (/\bhome teleport\b/.test(t)) return {name: 'Home Teleport', icon: spellIcon('Lumbridge Home Teleport')};
  const spell = SPELLS.find(s => t.includes(s.toLowerCase()));
  if (spell) return {name: spell, icon: spellIcon(spell)};
  return null;
}
/** How a teleport stop is reached, for its pin and list icon: the writer's own choice (`via`), else what its label names,
 * else the teleport the travel data matches to the label; null when nothing matches (the pin keeps the Home Teleport icon). */
export function teleportStopMethod(pin: Pick<GuideMapPin, 'kind' | 'label' | 'via'>, ways: StopTeleport[] = []): TravelMethod | null {
  if (pin.kind !== 'teleport') return null;
  const chosen = pin.via ? ways.find(w => w.name.toLowerCase() === pin.via!.toLowerCase()) : undefined;
  if (chosen) return {name: chosen.name, icon: chosen.icon};
  const named = ways.find(w => w.named);
  return (pin.via ? travelMethod(pin.via) : null) ?? travelMethod(pin.label) ?? (named ? {name: named.name, icon: named.icon} : null);
}
/** A teleport stop's icon: its travel method's, or the Home Teleport spell. */
export const teleportStopIcon = (pin: Pick<GuideMapPin, 'kind' | 'label' | 'via'>, ways: StopTeleport[] = []) => teleportStopMethod(pin, ways)?.icon ?? MAP_PIN_ICON.teleport;
/** What a stop's icon shows and says on hover: a teleport stop its travel method ("Teleport · Amulet of glory", or
 * "Spirit tree"), an item stop its first item, every other stop its kind. `item` marks inventory art, drawn larger. */
export function stopLook(pin: GuideMapPin, ways: StopTeleport[], itemImage: (id: string) => string | null): {icon: string | null; hint: string; item: boolean} {
  if (pin.kind === 'teleport') {
    const m = teleportStopMethod(pin, ways), icon = m?.icon ?? MAP_PIN_ICON.teleport;
    return {icon, hint: !m ? MAP_PIN_HINT.teleport : m.icon === TRAVEL_ICON.transport ? m.name : `Teleport · ${m.name}`, item: !!icon?.startsWith('/items/')};
  }
  const icon = stopIcon(pin, itemImage);
  return {icon, hint: MAP_PIN_HINT[pin.kind], item: pin.kind === 'item' && !!pin.items?.length && icon !== MAP_PIN_ICON.item};
}
/** Ways to travel a writer can name for a teleport stop, for the editor's suggestions (nearby teleports come first). */
export const TRAVEL_METHODS: string[] = [...TRANSPORTS.map(([, name]) => name), ...ITEMS.slice().sort(), 'Home Teleport', ...SPELLS.slice().sort()];
