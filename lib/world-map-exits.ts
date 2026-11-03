/** Floors and areas on the game maps. The world map opens on the surface's ground floor; players go underground (and
 * back out) by clicking the way in they would use in the game (cave entrances, tunnels, trapdoors, holes, a ladder down
 * into a dungeon), and the view stays inside the area they are in. Like the game's own world map, the maps offer no
 * floor changes: stairs and ladders that only go up or down a floor are not drawn (a guide map still opens on its own
 * floor, and a link with a floor shows it). The game keeps dungeons and instances in blocks north of the surface world, so the
 * surface view must never show them. Exits come from Shortest Path's travel data (BSD-2-Clause, see
 * public/world-map/NOTICE.txt), built into public/world-map/exits.json by scripts/build-map-exits.mjs. */
import type {Tile, TravelData} from './world-map-routing';

/** A box of game tiles: x0 and y0 inclusive, x1 and y1 exclusive. */
export type Box = {x0: number; y0: number; x1: number; y1: number};
/** The surface world (mainland, Zeah, Varlamore and the islands): the map squares Mejrs renders south of the
 * underground and instance blocks, without the dark edge of sea around them. */
export const SURFACE: Box = {x0: 1024, y0: 2112, x1: 3968, y1: 4160};
/** Where the surface ends for working out which side of an exit is underground (the dark edge squares included). */
const SURFACE_EDGE: Box = {x0: 960, y0: 2048, x1: 4032, y1: 4224};
export const inBox = (b: Box, x: number, y: number) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1;
export const onSurface = (t: {x: number; y: number}) => inBox(SURFACE_EDGE, t.x, t.y);
export const sameBox = (a: Box, b: Box) => a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;
export const boxCentre = (b: Box) => ({x: Math.floor((b.x0 + b.x1) / 2), y: Math.floor((b.y0 + b.y1) / 2)});

/** The closest zoom at which guide maps show exit markers: single buildings are readable from here. */
export const EXIT_ZOOM = 9;
/** The closest zoom at which the world map shows ways into another area. */
export const EXIT_AREA_ZOOM = 8;
export type ExitDirection = 'up' | 'down' | 'enter';
/** The kind of thing an exit is, from its name (for the detail line). */
export type ExitArt = 'stairs' | 'ladder' | 'dungeon' | 'entrance';
const FLOOR_NAME = ['ground floor', '1st floor', '2nd floor', '3rd floor'];

/** exits.json: the exits players can click, and the walkable extent of each underground area. */
export type ExitsFile = {v: 1; names: string[]; areas: [number, number, number, number][]; exits: [number, number, number, number, number, number, number][]};
export type MapExit = {from: Tile; to: Tile; name: string; dir: ExitDirection};

export const far = (a: {x: number; y: number}, b: {x: number; y: number}) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Which way an exit goes: up or down a floor, down into (or up out of) the underground, or into another area. */
export function exitDirection(from: Tile, to: Tile): ExitDirection {
  if (to.plane > from.plane) return 'up';
  if (to.plane < from.plane) return 'down';
  const a = onSurface(from), b = onSurface(to);
  return a && !b ? 'down' : !a && b ? 'up' : 'enter';
}
/** Whether an exit leads into another area (the surface, a dungeon) rather than to another floor of the same one. */
export const exitChangesArea = (e: Pick<MapExit, 'from' | 'to'>) => onSurface(e.from) !== onSurface(e.to) || e.from.plane === e.to.plane;
/** The exits the maps draw: ways into another area only. Stairs and ladders that just change floor are left out, as
 * on the game's world map. */
export const areaExits = <T extends Pick<MapExit, 'from' | 'to'>>(exits: T[]): T[] => exits.filter(exitChangesArea);
const DUNGEON = /cave|cavern|tunnel|dungeon|trap ?door|hole|crevice|manhole|grotto|crypt|\bwell$|chasm|crack|rubble|secret entrance/i;
/** Stairs, a ladder, a way underground (caves, tunnels, trapdoors, holes) or another entrance, from the game's object
 * name. */
export function exitArt(e: Pick<MapExit, 'name'>): ExitArt {
  return /stair|steps/i.test(e.name) ? 'stairs' : /ladder/i.test(e.name) ? 'ladder' : DUNGEON.test(e.name) ? 'dungeon' : 'entrance';
}
/** Exits named after a person or place ("Talk-to Murphy", "Travel Daero"), whose capitals stay. */
const NAMED = /^(?:talk-to|travel|teleport|mines|cellar|watermill)$/i;
/** Names that say which way the player goes, so the detail line shows up or down. */
const MOVES = /^(?:climb|walk|jump|leap|crawl|go|ascend|descend|top|bottom)|-(?:up|down)$/i, DROPS = /trapdoor|hole|\bwell$/i;
/** What an exit is, in sentence case and a few words, from the game's "Verb Object" name: "Ladder · down",
 * "Staircase · up", "Trapdoor · down", "Cave entrance", "Tunnel". */
export function exitDetail(e: Pick<MapExit, 'name' | 'dir'>): string {
  if (e.name === 'Next stop') return e.name;
  const [verb = '', ...rest] = e.name.trim().split(/\s+/);
  const thing = rest.join(' ')
    .replace(/^.*->\s*/, '') // "Use Spade -> Mole hill"
    .replace(/^(?:(?:a|an|the|up|down|through|off|over|into|across)\s+)+/i, '') // "Use A crack", "Climb Down Ladder", "Jump off End of bridge"
    .replace(/\s+(?:up|down|top|bottom)$/i, '') // "Climb-up Stairs up", "Climb-down Ladder top"
    .replace(/\b(\w+)\s+\1\b/gi, '$1') // "Leave Tomb Tomb Door"
    .replace(/\btrap door\b/i, 'trapdoor');
  const text = (thing || verb.replace(/-/g, ' ')).replace(/.+/, t => NAMED.test(verb) ? t : t.toLowerCase());
  const kind = exitArt({name: text});
  const way = e.dir !== 'enter' && (kind === 'stairs' || kind === 'ladder' || MOVES.test(verb) || DROPS.test(text)) ? ' · ' + e.dir : '';
  return text.charAt(0).toUpperCase() + text.slice(1) + way;
}
const CLIMB = /^climb|stair|steps|ladder|rope|chain|vine|ivy|trellis|tree|rocks?\b|wall|beams/i;
/** What the player does, in plain words: "Climb up", "Climb down", "Enter", "Leave", "Go up". */
export function exitVerb(e: MapExit): string {
  const climb = CLIMB.test(e.name);
  if (e.dir === 'up') return climb ? 'Climb up' : !onSurface(e.from) && onSurface(e.to) ? 'Leave' : 'Go up';
  if (e.dir === 'down') return climb ? 'Climb down' : 'Enter';
  return 'Enter';
}
/** Names for places, so an exit can say where it leads: the town nearest a surface tile, the underground area a tile is in. */
export type PlaceNames = {town?: (t: Tile) => string | null; area?: (t: Tile) => string | null};
/** Where an exit leads, like "Lumbridge 1st floor", "Taverley Dungeon" or "Taverley". */
export function exitWhere(e: MapExit, names: PlaceNames = {}): string {
  const surface = onSurface(e.to);
  if (!exitChangesArea(e)) {
    if (surface) {const town = names.town?.(e.from); return (town ? town + ' ' : '') + FLOOR_NAME[e.to.plane];}
    const area = names.area?.(e.to);
    return (area ? area + ', ' : '') + (e.to.plane > e.from.plane ? 'upper level' : 'lower level');
  }
  if (surface) return names.town?.(e.to) ?? 'the surface';
  return names.area?.(e.to) ?? (onSurface(e.from) ? 'underground' : 'another area');
}
/** How an exit reads on hover or tap, like "Climb up — Lumbridge 1st floor" or "Enter — Taverley Dungeon". */
export function exitLabel(e: MapExit, names: PlaceNames = {}): string {
  return exitVerb(e) + ' — ' + exitWhere(e, names);
}

export const EXIT_KINDS = new Set(['passage', 'shortcut']);
/** The travel edges players take to change floor or area, one per staircase or ladder. A floor change is a short
 * passage between planes; an area change crosses between the surface and the underground, or between two places far
 * apart underground. An edge that only applies in some quest state (the same door also opening normally) is left out,
 * and neighbouring tiles of one staircase going to the same place make one exit. */
export function findExits(data: Pick<TravelData, 'kinds' | 'names' | 'edges'>): MapExit[] {
  const local = new Map<string, Set<string>>();
  const key = (x: number, y: number, p: number) => `${x},${y},${p}`;
  for (const e of data.edges) {
    if (!EXIT_KINDS.has(data.kinds[e[7]]) || e[2] !== e[5] || far({x: e[0], y: e[1]}, {x: e[3], y: e[4]}) > 3) continue;
    const k = key(e[0], e[1], e[2]), names = local.get(k);
    if (names) names.add(data.names[e[8]]); else local.set(k, new Set([data.names[e[8]]]));
  }
  const kept: MapExit[] = [];
  for (const e of data.edges) {
    if (!EXIT_KINDS.has(data.kinds[e[7]])) continue;
    const from = {x: e[0], y: e[1], plane: e[2]}, to = {x: e[3], y: e[4], plane: e[5]}, name = data.names[e[8]], d = far(from, to);
    const surfaceFrom = onSurface(from), surfaceTo = onSurface(to);
    const floor = from.plane !== to.plane && surfaceFrom === surfaceTo && d <= 12;
    const area = surfaceFrom !== surfaceTo || (!surfaceFrom && !surfaceTo && d > 64);
    if (!floor && !area) continue;
    if (area && local.get(key(from.x, from.y, from.plane))?.has(name)) continue;
    if (kept.some(k => k.name === name && k.from.plane === from.plane && k.to.plane === to.plane && far(k.from, from) <= 2 && far(k.to, to) <= 4)) continue;
    kept.push({from, to, name, dir: exitDirection(from, to)});
  }
  return kept;
}

/** Read exits.json into exits and area boxes. */
export function readExits(file: ExitsFile): {exits: MapExit[]; areas: Box[]} {
  const exits = file.exits.map(([x, y, p, tx, ty, tp, n]) => {const from = {x, y, plane: p}, to = {x: tx, y: ty, plane: tp}; return {from, to, name: file.names[n] ?? '', dir: exitDirection(from, to)};});
  return {exits, areas: file.areas.map(([x0, y0, x1, y1]) => ({x0, y0, x1, y1}))};
}

/** Room around an underground area's walkable tiles, and the smallest area a view frames, in tiles. */
const AREA_PAD = 12, AREA_MIN = 64;
/** The box a map view stays inside for a tile: the whole surface, or the underground area the tile is in (the smallest
 * known area that holds it, padded), or a 128-tile box around a tile in no known area. */
export function areaFor(t: {x: number; y: number}, areas: Box[] = []): Box {
  if (onSurface(t)) return SURFACE;
  let best: Box | null = null;
  for (const a of areas) if (inBox(a, t.x, t.y) && (!best || (a.x1 - a.x0) * (a.y1 - a.y0) < (best.x1 - best.x0) * (best.y1 - best.y0))) best = a;
  if (!best) return {x0: t.x - 64, y0: t.y - 64, x1: t.x + 64, y1: t.y + 64};
  const grow = (lo: number, hi: number): [number, number] => {const size = Math.max(hi - lo + 2 * AREA_PAD, AREA_MIN), mid = (lo + hi) / 2; return [Math.floor(mid - size / 2), Math.ceil(mid + size / 2)];};
  const [x0, x1] = grow(best.x0, best.x1), [y0, y1] = grow(best.y0, best.y1);
  return {x0, y0, x1, y1};
}

/** An underground area grown to hold other tiles in it (a guide map's stops around the saved view); tiles on the surface
 * or over 200 tiles away belong elsewhere and are left out. */
export function areaWith(area: Box, tiles: {x: number; y: number}[]): Box {
  if (sameBox(area, SURFACE)) return area;
  const b = {...area}, mid = boxCentre(area);
  for (const t of tiles) {
    if (onSurface(t) || far(t, mid) > 200) continue;
    b.x0 = Math.min(b.x0, t.x - AREA_PAD); b.y0 = Math.min(b.y0, t.y - AREA_PAD); b.x1 = Math.max(b.x1, t.x + AREA_PAD + 1); b.y1 = Math.max(b.y1, t.y + AREA_PAD + 1);
  }
  return b;
}

/** The exits to draw: on this floor, inside the area being shown. */
export function exitsIn(exits: MapExit[], plane: number, area: Box): MapExit[] {
  return exits.filter(e => e.from.plane === plane && inBox(area, e.from.x, e.from.y));
}

/** Where "Back to the surface" goes from an underground area: its nearest way out to the surface (nearest to `near`).
 * Null when `near` is in no known area (a quest dungeon the travel data lacks: its box could hold another dungeon's
 * exits) or the area has no way out. */
export function wayOut(exits: MapExit[], area: Box, near: {x: number; y: number}, areas: Box[] = []): Tile | null {
  if (!areas.some(a => inBox(a, near.x, near.y))) return null;
  let best: MapExit | null = null;
  for (const e of exits) if (onSurface(e.to) && inBox(area, e.from.x, e.from.y) && (!best || far(e.from, near) < far(best.from, near))) best = e;
  return best ? {...best.to, plane: 0} : null;
}

/** Where a map is: the floor shown and the tile its area is worked out from. */
export type MapPlace = {plane: number; at: {x: number; y: number}};
/** The label of the control that takes the reader back to the surface's ground floor, or null on the ground floor. */
export function backLabel(place: MapPlace): string | null {
  if (!onSurface(place.at)) return 'Back to the surface';
  return place.plane > 0 ? 'Down to the ground floor' : null;
}

/** How near a map icon a way into another area must start for the icon to stand for it, in tiles. */
export const ICON_EXIT_RANGE = 5;
/** The way into another area a map icon (the game's Dungeon or Map link icon) stands for: the nearest one on this floor,
 * inside the area shown, starting within `range` tiles of the icon. Null where the travel data knows none (a quest
 * dungeon it lacks), so the map offers no way in there. */
export function exitNear(exits: MapExit[], t: Tile, area: Box, range = ICON_EXIT_RANGE): MapExit | null {
  let best: MapExit | null = null;
  for (const e of exits) {
    if (e.from.plane !== t.plane || !exitChangesArea(e) || !inBox(area, e.from.x, e.from.y)) continue;
    const d = far(e.from, t);
    if (d <= range && (!best || d < far(best.from, t))) best = e;
  }
  return best;
}
/** What the map's menu offers on a way into another area: "Enter" going underground (or into another underground
 * area), "Exit" coming back up to the surface. */
export const exitAction = (e: Pick<MapExit, 'from' | 'to'>): 'Enter' | 'Exit' => !onSurface(e.from) && onSurface(e.to) ? 'Exit' : 'Enter';
