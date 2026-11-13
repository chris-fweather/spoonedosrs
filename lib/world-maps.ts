/** The game's own world maps, as its world map's dropdown lists them: Gielinor Surface, Misthalin Underground, Ardent Ocean
 * Underground, … Each map is drawn from its own map squares and 8 by 8 tile zones of the game world, every one placed at
 * a display position of its own (the game moves dungeons from their blocks far north of the surface to sensible spots),
 * with nothing around them. The layout comes from the game cache (its world map "compositemap" files), read by
 * scripts/map-tiles/SpoonedMapTiles.java and written into maps.json by scripts/slice-map-tiles.mjs, which also draws
 * every map's tiles from it (docs/map-tiles.md). Places, exits, routes and links stay in game tiles; a map turns them
 * into its display tiles (`toDisplay`) and back (`toGame`).
 *
 * Floors: a map square or zone shows its game floors from `minLevel` up, as display floors 0, 1, … (a dungeon whose
 * only floor is the game's floor 1 shows as the map's ground floor). The floors in its `levels` come first; the floors
 * above them stay in reach (a building's upper floors on the surface) unless another square or zone owns that spot.
 *
 * Tile sets drawn before maps existed (Mejrs' and our first render) have one sheet in game tiles: `sheetMaps` stands in
 * for the dropdown there, with the surface and everything else as two maps that move nothing. */
import {onSurface, type Box} from './world-map-exits';

export type Tile = {x: number; y: number; plane: number};

/** maps.json: the maps of one tile version. */
export type MapsFile = {v: 1; version: string; maps: MapRecord[]};
export type MapRecord = {
  /** The game's map id (its world map "details" file), or -1 for the squares no map of the game shows. */
  id: number; name: string; surface?: boolean;
  /** Display floors that have tiles; the display box [x0, y0, x1, y1) in tiles. */
  planes: number; bounds: [number, number, number, number];
  /** Where the map opens: its centre in display tiles, and the game tile shown there. */
  centre: [number, number]; home: [number, number, number];
  /** Map squares: [minLevel, levels, sourceX, sourceY, displayX, displayY] in squares (64 tiles), one after another. */
  squares: number[];
  /** Zones: the same in zones (8 tiles), counted from game tile 0, 0. */
  zones: number[];
};

/** One map: where each game tile on it is drawn, and back. */
export interface GameMap {
  readonly id: number;
  readonly name: string;
  /** The surface: the map players are on above ground. */
  readonly surface: boolean;
  /** Drawn on plain black (the underground and other areas), like the game's own map. */
  readonly dark: boolean;
  readonly bounds: Box;
  readonly planes: number;
  /** Where the map opens, in game tiles. */
  readonly home: Tile;
  /** Whether its tiles are this map's own (`m=<id>` in the tile address), not one sheet in game tiles. */
  readonly ownTiles: boolean;
  /** The display tile a game tile is drawn at, or null when this map does not show it. */
  toDisplay(t: Tile): Tile | null;
  /** The game tile drawn at a display tile, or null where the map is black. */
  toGame(d: Tile): Tile | null;
}

/** A map square or zone of a map: its first game floor, how many floors it shows, and its source and display position
 * in units of `size` tiles. */
type Part = {min: number; levels: number; sx: number; sy: number; dx: number; dy: number; size: 8 | 64};
const zoneKey = (x: number, y: number) => x * 2048 + y;
const squareKey = (x: number, y: number) => x * 256 + y;
const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => {const l = m.get(k); if (l) l.push(v); else m.set(k, [v]);};
/** Which part draws a spot when several could: one whose own floors include it before one reaching up from below, and
 * a zone before a whole square. */
const rank = (p: Part, d: number) => (d < p.levels ? 0 : 2) + (p.size === 8 ? 0 : 1);

/** A map made of the game's map squares and zones (maps.json). */
export class CompositeMap implements GameMap {
  readonly id: number; readonly name: string; readonly surface: boolean; readonly dark: boolean; readonly bounds: Box;
  readonly planes: number; readonly home: Tile; readonly ownTiles = true;
  private readonly bySource = {zones: new Map<number, Part[]>(), squares: new Map<number, Part[]>()};
  private readonly byDisplay = {zones: new Map<number, Part[]>(), squares: new Map<number, Part[]>()};

  constructor(r: MapRecord) {
    this.id = r.id; this.name = r.name; this.surface = !!r.surface; this.dark = !r.surface; this.planes = r.planes;
    const [x0, y0, x1, y1] = r.bounds;
    this.bounds = {x0, y0, x1, y1};
    this.home = {x: r.home[0], y: r.home[1], plane: r.home[2]};
    for (const part of readParts(r)) {
      const into = part.size === 8 ? 'zones' : 'squares', key = part.size === 8 ? zoneKey : squareKey;
      push(this.bySource[into], key(part.sx, part.sy), part);
      push(this.byDisplay[into], key(part.dx, part.dy), part);
    }
  }

  /** The game zone and floor drawn at a display zone on display floor `d`, or null. */
  source(dzx: number, dzy: number, d: number): {zx: number; zy: number; plane: number} | null {
    let best: Part | null = null;
    for (const p of [...this.byDisplay.zones.get(zoneKey(dzx, dzy)) ?? [], ...this.byDisplay.squares.get(squareKey(dzx >> 3, dzy >> 3)) ?? []]) {
      if (d < 0 || p.min + d > 3) continue;
      if (!best || rank(p, d) < rank(best, d)) best = p;
    }
    if (!best) return null;
    return best.size === 8 ? {zx: best.sx, zy: best.sy, plane: best.min + d} : {zx: best.sx * 8 + (dzx - best.dx * 8), zy: best.sy * 8 + (dzy - best.dy * 8), plane: best.min + d};
  }

  toDisplay(t: Tile): Tile | null {
    const zx = t.x >> 3, zy = t.y >> 3;
    const parts = [...this.bySource.zones.get(zoneKey(zx, zy)) ?? [], ...this.bySource.squares.get(squareKey(zx >> 3, zy >> 3)) ?? []]
      .filter(p => t.plane >= p.min).sort((a, b) => rank(a, t.plane - a.min) - rank(b, t.plane - b.min));
    for (const p of parts) {
      const d = t.plane - p.min, dzx = p.size === 8 ? p.dx : p.dx * 8 + (zx - p.sx * 8), dzy = p.size === 8 ? p.dy : p.dy * 8 + (zy - p.sy * 8);
      // Only where this part is the one drawn there (another may cover the same display spot).
      const s = this.source(dzx, dzy, d);
      if (s && s.zx === zx && s.zy === zy && s.plane === t.plane) return {x: t.x + (dzx - zx) * 8, y: t.y + (dzy - zy) * 8, plane: d};
    }
    return null;
  }

  toGame(d: Tile): Tile | null {
    const dzx = d.x >> 3, dzy = d.y >> 3, s = this.source(dzx, dzy, d.plane);
    return s ? {x: d.x + (s.zx - dzx) * 8, y: d.y + (s.zy - dzy) * 8, plane: s.plane} : null;
  }

  /** Every display zone the map draws (scripts/slice-map-tiles.mjs draws them square by square). */
  displayZones(): [number, number][] {
    const seen = new Set<number>(), out: [number, number][] = [];
    const add = (x: number, y: number) => {const k = zoneKey(x, y); if (!seen.has(k)) {seen.add(k); out.push([x, y]);}};
    for (const list of this.byDisplay.zones.values()) for (const p of list) add(p.dx, p.dy);
    for (const list of this.byDisplay.squares.values()) for (const p of list) for (let i = 0; i < 64; i++) add(p.dx * 8 + (i >> 3), p.dy * 8 + (i & 7));
    return out;
  }
}

/** The parts of a map record. */
export function readParts(r: Pick<MapRecord, 'squares' | 'zones'>): Part[] {
  const parts: Part[] = [];
  for (const [list, size] of [[r.squares, 64], [r.zones, 8]] as const) {
    for (let i = 0; i + 5 < list.length; i += 6) parts.push({min: list[i], levels: list[i + 1], sx: list[i + 2], sy: list[i + 3], dx: list[i + 4], dy: list[i + 5], size});
  }
  return parts;
}

/** A map that moves nothing: the game tiles inside it are drawn where they are (one sheet in game tiles). */
class SheetMap implements GameMap {
  readonly ownTiles = false; readonly planes = 4;
  readonly id: number; readonly name: string; readonly surface: boolean; readonly dark: boolean; readonly bounds: Box; readonly home: Tile;
  private readonly inside: (t: {x: number; y: number}) => boolean;
  constructor(id: number, name: string, surface: boolean, bounds: Box, home: Tile, inside: (t: {x: number; y: number}) => boolean) {
    this.id = id; this.name = name; this.surface = surface; this.dark = !surface; this.bounds = bounds; this.home = home; this.inside = inside;
  }
  toDisplay(t: Tile) {return this.inside(t) ? {x: t.x, y: t.y, plane: t.plane} : null;}
  toGame(d: Tile) {return this.toDisplay(d);}
}

/** The maps of one tile version, and which map shows a game tile. */
export class WorldMaps {
  readonly surface: GameMap; readonly maps: GameMap[]; readonly version: string | null;
  constructor(maps: GameMap[], version: string | null) {
    this.maps = maps; this.version = version;
    this.surface = maps.find(m => m.surface) ?? maps[0];
  }
  byId(id: number) {return this.maps.find(m => m.id === id) ?? null;}
  /** The map that shows a game tile: the one asked for (the map on screen) if it shows it, else the surface, else the
   * first map that does. Null for a tile no map shows. */
  mapOf(t: Tile, prefer?: GameMap | null): GameMap | null {
    if (prefer?.toDisplay(t)) return prefer;
    if (this.surface.toDisplay(t)) return this.surface;
    return this.maps.find(m => m.toDisplay(t)) ?? null;
  }
  /** The maps the dropdown offers: the surface first, then the rest by name ("Other areas" last). */
  get choices(): GameMap[] {
    return [...this.maps].sort((a, b) => Number(b.surface) - Number(a.surface) || Number(a.id < 0) - Number(b.id < 0) || a.name.localeCompare(b.name));
  }
}

/** The surface world in game tiles (lib/world-map-exits SURFACE, with its dark edge). */
const SURFACE_BOX: Box = {x0: 960, y0: 2048, x1: 4032, y1: 4224};
/** For a sheet in game tiles (no maps.json): the surface, and every other block (dungeons, instances) as one map. */
export function sheetMaps(): WorldMaps {
  return new WorldMaps([
    new SheetMap(0, 'Gielinor Surface', true, SURFACE_BOX, {x: 3222, y: 3300, plane: 0}, onSurface),
    new SheetMap(-1, 'Underground', false, {x0: 1024, y0: 1216, x1: 4416, y1: 12800}, {x: 3210, y: 9616, plane: 0}, t => !onSurface(t)),
  ], null);
}

/** The maps in maps.json. */
export function readMaps(file: MapsFile): WorldMaps {
  return new WorldMaps(file.maps.map(r => new CompositeMap(r)), file.version);
}

/** A path in game tiles as the runs of display tiles a map draws on floor `plane`: a run ends where the path leaves the
 * map or the floor, or where two steps next to each other in the game are drawn apart (zones placed apart). */
export function displayRuns(map: GameMap, plane: number, points: [number, number][], gamePlane: number): [number, number][][] {
  const runs: [number, number][][] = [];
  let run: [number, number][] = [], last: [number, number] | null = null, lastGame: [number, number] | null = null;
  for (const [x, y] of points) {
    const d = map.toDisplay({x, y, plane: gamePlane});
    const joins = d && d.plane === plane && last && lastGame && Math.abs((d.x - last[0]) - (x - lastGame[0])) <= 2 && Math.abs((d.y - last[1]) - (y - lastGame[1])) <= 2;
    if (!joins && run.length) {if (run.length > 1) runs.push(run); run = [];}
    if (d && d.plane === plane) {run.push([d.x, d.y]); last = [d.x, d.y]; lastGame = [x, y];} else {last = lastGame = null;}
  }
  if (run.length > 1) runs.push(run);
  return runs;
}
