/** Walking paths for guide map route lines: the tiles a player walks between two stops on one floor, using the world
 * map's collision data plus doors, gates and short shortcuts. No teleports, boats or stairs: a guide's own teleport stops
 * and floors already show those. Runs in the world map's Web Worker (app/world-map-route.worker.ts). */
import {simplify, walkable, walkMask, type Collision, type Tile, type TravelData} from './world-map-routing';

export type PathPoint = [number, number];
/** Doors, gates and short shortcuts that stay on one floor, by the tile they start from. */
export type WalkLinks = Map<number, {x: number; y: number; cost: number}[]>;
const tileKey = (x: number, y: number, plane: number) => x + y * 16384 + plane * 268435456;
const WALK_KINDS = new Set(['passage', 'shortcut']);

/** How far a guide path may search. A leg longer than `span` tiles, or a walk more than `detour` times the straight
 * distance plus `slack` tiles (going round a lake when the guide means a boat), keeps a straight line instead. */
export const PATH_LIMIT = {span: 320, margin: 40, detour: 5, slack: 40, link: 12, near: 1, reach: 4};

/** The same-floor doors and shortcuts from the travel data. Longer jumps (a trapdoor to a dungeon on the same plane
 * number, a long agility course) are not part of a walk. */
export function walkLinks(data: Pick<TravelData, 'kinds' | 'edges'>): WalkLinks {
  const links: WalkLinks = new Map();
  for (const e of data.edges) {
    if (!WALK_KINDS.has(data.kinds[e[7]]) || e[2] !== e[5]) continue;
    const dx = Math.abs(e[3] - e[0]), dy = Math.abs(e[4] - e[1]);
    if (Math.max(dx, dy) > PATH_LIMIT.link || (dx === 0 && dy === 0)) continue;
    const k = tileKey(e[0], e[1], e[2]), link = {x: e[3], y: e[4], cost: 2 * Math.max(dx, dy) + Math.min(dx, dy) + 2 * Math.max(1, e[6])};
    const list = links.get(k);
    if (list) list.push(link); else links.set(k, [link]);
  }
  return links;
}

/** The walkable tile nearest a stop (a fruit tree patch or an NPC behind a counter is not walkable itself), choosing the
 * side that faces the other end of the leg so the line does not hook round the stop. */
export function snapToward(c: Collision, t: Tile, toward: Tile, radius = 6): Tile | null {
  for (let r = 0; r <= radius; r++) {
    let best: Tile | null = null, bestD = Infinity;
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const s = {x: t.x + dx, y: t.y + dy, plane: t.plane}, d = (s.x - toward.x) ** 2 + (s.y - toward.y) ** 2;
      if (d < bestD && walkable(c, s)) {best = s; bestD = d;}
    }
    if (best) return best;
  }
  return null;
}

const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [1, 1, 0, -1, -1, -1, 0, 1];

/** A small binary heap of grid cells by priority. */
class Heap {
  private keys: number[] = []; private cells: number[] = [];
  get size() {return this.keys.length;}
  push(key: number, cell: number) {
    const k = this.keys, c = this.cells;
    let i = k.length; k.push(key); c.push(cell);
    while (i > 0) {const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; c[i] = c[p]; i = p;}
    k[i] = key; c[i] = cell;
  }
  pop(): number {
    const k = this.keys, c = this.cells, top = c[0], lastK = k.pop()!, lastC = c.pop()!, n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let m = 2 * i + 1;
        if (m >= n) break;
        if (m + 1 < n && k[m + 1] < k[m]) m++;
        if (k[m] >= lastK) break;
        k[i] = k[m]; c[i] = c[m]; i = m;
      }
      k[i] = lastK; c[i] = lastC;
    }
    return top;
  }
}

/** The walking path from one stop to the next as map points (straight runs collapsed), starting and ending at the
 * stops themselves, or null when there is no walk within the limits: different floors, too far, water in the way, or a
 * stop nowhere near a walkable tile. Steps cost 2 straight and 3 diagonally, so paths keep to straight lines and 45°
 * turns, and an equal choice keeps the current direction. */
export function walkingPath(c: Collision, links: WalkLinks, a: Tile, b: Tile): PathPoint[] | null {
  if (a.plane !== b.plane) return null;
  const span = Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  if (span > PATH_LIMIT.span) return null;
  const s = snapToward(c, a, b), t = snapToward(c, b, a);
  if (!s || !t) return null;
  const p = a.plane, margin = Math.max(PATH_LIMIT.margin, Math.round(span * 0.6));
  const x0 = Math.min(s.x, t.x) - margin, y0 = Math.min(s.y, t.y) - margin;
  const w = Math.abs(s.x - t.x) + 2 * margin + 1, h = Math.abs(s.y - t.y) + 2 * margin + 1, size = w * h;
  const inside = (x: number, y: number) => x >= x0 && y >= y0 && x < x0 + w && y < y0 + h;
  const cell = (x: number, y: number) => (y - y0) * w + (x - x0);
  const guess = (x: number, y: number) => {const dx = Math.abs(x - t.x), dy = Math.abs(y - t.y); return 2 * Math.max(dx, dy) + Math.min(dx, dy);};
  const goal = cell(t.x, t.y);
  let cost = new Int32Array(0), prev = cost, end = -1;
  // First from the stop's own side; a stop that is a locked door can also be left from right next to it.
  for (const near of [0, PATH_LIMIT.near]) {
    cost = new Int32Array(size).fill(0x7fffffff); prev = new Int32Array(size).fill(-1);
    const dir = new Int8Array(size).fill(-1), done = new Uint8Array(size), heap = new Heap();
    // Priority: estimated total first, then the cell nearer the goal.
    const push = (i: number, x: number, y: number) => {const g = guess(x, y); heap.push((cost[i] + g) * 4096 + g, i);};
    for (let dx = -near; dx <= near; dx++) for (let dy = -near; dy <= near; dy++) {
      const x = s.x + dx, y = s.y + dy, r = Math.max(Math.abs(dx), Math.abs(dy));
      if (r && !walkable(c, {x, y, plane: p})) continue;
      cost[cell(x, y)] = 4 * r; push(cell(x, y), x, y);
    }
    const step = (from: number, x: number, y: number, d: number, add: number, moveDir: number) => {
      if (!inside(x, y)) return;
      const n = cell(x, y);
      if (done[n]) return;
      const nd = cost[from] + add;
      if (nd < cost[n]) {cost[n] = nd; prev[n] = from; dir[n] = moveDir; push(n, x, y);}
      else if (nd === cost[n] && moveDir >= 0 && moveDir === d && dir[n] !== moveDir) {prev[n] = from; dir[n] = moveDir;}
    };
    while (heap.size) {
      const i = heap.pop();
      if (done[i]) continue;
      done[i] = 1;
      if (i === goal) break;
      const x = x0 + (i % w), y = y0 + Math.floor(i / w), d = dir[i], mask = walkMask(c, x, y, p);
      for (let m = 0; m < 8; m++) if (mask & (1 << m)) step(i, x + DX[m], y + DY[m], d, m & 1 ? 3 : 2, m);
      for (const link of links.get(tileKey(x, y, p)) ?? []) step(i, link.x, link.y, d, link.cost, 8);
    }
    // A stop behind a locked door, bars or a fence is reached when the walk gets close to it, and the line finishes the way.
    end = done[goal] ? goal : -1;
    for (let r = 1; end < 0 && r <= PATH_LIMIT.reach; r++) {
      let bestD = Infinity;
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
        const x = t.x + dx, y = t.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !inside(x, y) || !done[cell(x, y)]) continue;
        const d = (dx * dx + dy * dy) * 0x10000 + cost[cell(x, y)];// nearest first, then the shorter walk
        if (d < bestD) {bestD = d; end = cell(x, y);}
      }
    }
    if (end >= 0) break;
  }
  if (end < 0) return null;
  const tiles: PathPoint[] = [];
  for (let i = end; i !== -1; i = prev[i]) tiles.push([x0 + (i % w), y0 + Math.floor(i / w)]);
  tiles.reverse();
  if (tiles.length - 1 > PATH_LIMIT.detour * Math.max(span, 1) + PATH_LIMIT.slack) return null;
  const points = simplify(tiles);
  if (points[0][0] !== a.x || points[0][1] !== a.y) points.unshift([a.x, a.y]);
  const [ex, ey] = points[points.length - 1];
  if (ex !== b.x || ey !== b.y) points.push([b.x, b.y]);
  return points;
}

/** A leg's cache key: the same two tiles always walk the same way. */
export const pathKey = (a: Tile, b: Tile) => `${a.x},${a.y},${a.plane}>${b.x},${b.y},${b.plane}`;

/** Where to put a leg's direction arrow: halfway along the drawn line (in screen pixels), pointing along that piece.
 * Returns the point, the angle in degrees (0 east, clockwise as on screen) and the line's length. */
export function midpointOnLine(points: {x: number; y: number}[]): {x: number; y: number; degrees: number; length: number} | null {
  if (points.length < 2) return null;
  let length = 0;
  for (let i = 1; i < points.length; i++) length += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  let left = length / 2;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], piece = Math.hypot(b.x - a.x, b.y - a.y);
    if (piece === 0) continue;
    if (left <= piece || i === points.length - 1) {
      const f = Math.min(1, left / piece);
      return {x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, degrees: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI, length};
    }
    left -= piece;
  }
  return null;
}
