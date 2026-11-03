/** Build-time help for public/world-map/exits.json (scripts/build-map-exits.mjs): the walkable extent of each
 * underground area, so a map view can stay inside the area the reader is in. */
import {EXIT_KINDS, far, onSurface, type Box} from './world-map-exits';
import {walkMask, type Collision, type Tile, type TravelData} from './world-map-routing';

/** The walkable extent of the underground area around a tile: every tile reachable on foot, through doors and up or
 * down stairs inside it (passages under 64 tiles that stay underground). Stops after `limit` tiles. */
export function areaExtent(c: Collision, links: Map<string, Tile[]>, start: Tile, limit = 400_000): {box: Box; tiles: Set<string>} {
  const key = (t: Tile) => `${t.x},${t.y},${t.plane}`, seen = new Set([key(start)]), queue = [start];
  const box = {x0: start.x, y0: start.y, x1: start.x + 1, y1: start.y + 1};
  const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [1, 1, 0, -1, -1, -1, 0, 1];
  for (let i = 0; i < queue.length && seen.size < limit; i++) {
    const t = queue[i], m = walkMask(c, t.x, t.y, t.plane);
    box.x0 = Math.min(box.x0, t.x); box.y0 = Math.min(box.y0, t.y); box.x1 = Math.max(box.x1, t.x + 1); box.y1 = Math.max(box.y1, t.y + 1);
    const next: Tile[] = links.get(key(t)) ?? [];
    for (let d = 0; d < 8; d++) if (m & (1 << d)) next.push({x: t.x + DX[d], y: t.y + DY[d], plane: t.plane});
    for (const n of next) {
      const k = key(n);
      if (seen.has(k) || onSurface(n)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return {box, tiles: seen};
}

/** Short passages that stay underground (doors, stairs, gaps), as links for areaExtent. */
export function undergroundLinks(data: Pick<TravelData, 'kinds' | 'edges'>): Map<string, Tile[]> {
  const links = new Map<string, Tile[]>();
  for (const e of data.edges) {
    if (!EXIT_KINDS.has(data.kinds[e[7]]) || onSurface({x: e[0], y: e[1]}) || onSurface({x: e[3], y: e[4]}) || far({x: e[0], y: e[1]}, {x: e[3], y: e[4]}) > 64) continue;
    const k = `${e[0]},${e[1]},${e[2]}`, to = {x: e[3], y: e[4], plane: e[5]}, list = links.get(k);
    if (list) list.push(to); else links.set(k, [to]);
  }
  return links;
}
