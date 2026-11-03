/** Travel destinations a guide can name inline, for their hover card: teleport spells ([[Falador Teleport]]), other
 * teleports ([[Amulet of glory: Edgeville]]), fairy ring codes ([[BLP]]) and transport stops ([[Grand Exchange spirit
 * tree]]). Where each lands and what it needs come from the world map's travel data, gathered into lib/guide-travel.json
 * by scripts/build-guide-travel.mjs. */
import data from './guide-travel.json' with {type: 'json'};
import type {TravelRequirement} from './world-map-routing';
import {ITEM_ICON, TELEPORT_ITEM, TRAVEL_ICON, placeIcon, spellIcon, tabletIcon, teleportGroupIcon} from './world-map-places';

export type TravelKind = 'spell' | 'teleport' | 'fairy' | 'spirit' | 'glider' | 'balloon' | 'mushtree' | 'quetzal';
export type GuideTravel = {
  /** The travel data's name: a spell or teleport's ("Falador Teleport", "Amulet of glory: Edgeville"), a fairy ring's
   * code, or a transport stop's destination ("Grand Exchange"). */
  name: string; kind: TravelKind;
  /** What it is: a spell's spellbook, a teleport item, or the transport ("Fairy ring"). */
  via: string;
  /** Where it lands, as the map names the area; empty when the data has no name for it. */
  area: string;
  x: number; y: number; plane: number;
  req: TravelRequirement;
  /** The destination has to be unlocked first (a diary, a quest reward or an item upgrade). */
  unlock: boolean;
};
type Raw = {v: 1; reqs: TravelRequirement[]; spots: [TravelKind, string, string, string, number, number, number, number, number][]};
const RAW = data as unknown as Raw;
export const GUIDE_TRAVEL: GuideTravel[] = RAW.spots.map(([kind, name, via, area, x, y, plane, r, unlock]) => ({kind, name, via, area, x, y, plane, req: RAW.reqs[r] ?? {}, unlock: unlock === 1}));

/** Names fold to lower-case words, with apostrophes, colons and brackets dropped: "Spirit tree (Grand Exchange)" and
 * "spirit tree: grand exchange" are one name. */
export const foldTravel = (s: string) => s.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/** The transport in names: "Grand Exchange spirit tree", "Spirit tree: Grand Exchange", "Fairy ring BLP", "BLP fairy ring". */
const TRANSPORT_WORDS: Partial<Record<TravelKind, string[]>> = {fairy: ['fairy ring', 'fairy'], spirit: ['spirit tree'], glider: ['gnome glider', 'glider'], balloon: ['balloon', 'hot air balloon'], mushtree: ['magic mushtree', 'mushtree'], quetzal: ['quetzal']};

let index: Map<string, GuideTravel> | undefined;
function lookup() {
  if (index) return index;
  index = new Map();
  const put = (key: string, t: GuideTravel) => {if (key && !index!.has(key)) index!.set(key, t);};
  for (const t of GUIDE_TRAVEL) {
    const name = foldTravel(t.name);
    if (t.kind === 'spell' || t.kind === 'teleport') {put(name, t); continue;}
    for (const w of TRANSPORT_WORDS[t.kind] ?? []) {put(`${w} ${name}`, t); put(`${name} ${w}`, t);}
    if (t.kind === 'fairy') put(name, t);
  }
  return index;
}
/** The destination a name in a guide means, or null. Fairy rings answer to their code alone; other stops need their
 * transport in the name, so [[Grand Exchange]] stays a place, not the spirit tree. */
export function guideTravel(name: string): GuideTravel | null {
  return lookup().get(foldTravel(name)) ?? null;
}
/** A destination by its kind and travel-data name (a hover target's), or null. */
export const travelSpot = (kind: TravelKind, name: string) => GUIDE_TRAVEL.find(t => t.kind === kind && t.name === name) ?? null;
/** A card's heading: where it goes (the area for a fairy ring, the stop for a transport, the destination after a
 * teleport item's name), and a spell its own name. */
export function travelTitle(t: GuideTravel): string {
  if (t.kind === 'spell') return t.name;
  if (t.kind === 'fairy') return t.area || `Fairy ring ${t.name}`;
  if (t.kind === 'teleport') return t.name.includes(':') ? t.name.slice(t.name.lastIndexOf(':') + 1).trim() : t.name;
  return t.name;
}
/** Whether a name is a fairy ring code written on its own ([[BLP]]), so it shows in capitals. */
export const isFairyCode = (name: string) => /^[a-d][i-l][p-s]$/i.test(name.trim());

/** The name a guide shows for a destination and the editor offers: the spell or teleport's own name, a fairy ring's code,
 * and "<destination> <transport>" for the other stops ("Grand Exchange spirit tree"). */
export function travelLabel(t: GuideTravel): string {
  if (t.kind === 'spell' || t.kind === 'teleport' || t.kind === 'fairy') return t.name;
  return `${t.name} ${(t.kind === 'glider' ? 'gnome glider' : t.via).toLowerCase()}`;
}
/** A destination's icon: a spell's spellbook art, a teleport's item or tablet art, the Dramen staff for fairy rings and
 * our spirit tree drawing for spirit trees (as the world map's lists show them), the Transportation icon for the rest. */
export function travelIcon(t: GuideTravel): string {
  if (t.kind === 'spell') return spellIcon(t.name);
  if (t.kind === 'fairy') return TRAVEL_ICON.fairy;
  if (t.kind === 'spirit') return TRAVEL_ICON.spirit;
  if (t.kind !== 'teleport') return TRAVEL_ICON.transport;
  const source = t.name.split(':')[0].trim();
  if (TELEPORT_ITEM[source] && source !== 'Teleport tablets' && source !== 'Teleport scrolls') return ITEM_ICON(TELEPORT_ITEM[source]);
  if (t.via === 'Teleport tablets' || t.via === 'Teleport scrolls') return tabletIcon(t.name) ?? teleportGroupIcon('teleport-tablets', t.via);
  return placeIcon({kind: 'teleport', name: t.area || t.name, detail: t.name});
}
/** What a destination is, in one line: "Standard spellbook · 37 Magic", "Fairy ring · BLP", "Spirit tree", "Amulet of glory". */
export function travelWhat(t: GuideTravel): string {
  const magic = t.kind === 'spell' ? t.req.s?.find(([s]) => s === 'Magic') : undefined;
  if (magic) return `${t.via} · ${magic[1]} Magic`;
  if (t.kind === 'fairy') return `${t.via} · ${t.name}`;
  return t.via;
}
/** The world map at a destination: /map?at=x,y,plane&zoom=10. */
export const travelMapHref = (t: Pick<GuideTravel, 'x' | 'y' | 'plane'>) => `/map?at=${t.x},${t.y},${t.plane}&zoom=10`;

/** Map tiles (/api/map-tile, lib/map-tile.ts) for a small view centred on a tile: at tile zoom z each game tile is 2^z
 * pixels and a square is 256 pixels, the world map's own layout (app/map-canvas.ts). Each tile has its offset from the
 * view's top left. */
export function travelSnippetTiles(at: {x: number; y: number; plane: number}, width: number, height: number, z = 2) {
  const scale = 2 ** z, cx = (at.x + .5) * scale, cy = -(at.y + .5) * scale, left = cx - width / 2, top = cy - height / 2;
  const tiles: {src: string; left: number; top: number}[] = [];
  for (let col = Math.floor(left / 256); col * 256 < left + width; col++) for (let row = Math.floor(top / 256); row * 256 < top + height; row++) {
    tiles.push({src: `/api/map-tile?z=${z}&p=${at.plane}&x=${col}&y=${-1 - row}`, left: Math.round(col * 256 - left), top: Math.round(row * 256 - top)});
  }
  return tiles;
}
