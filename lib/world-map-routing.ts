/** Route planning on the game map: walking on the collision map plus doors, stairs, shortcuts, transport networks and
 * teleports, minimising estimated game ticks. Data comes from Shortest Path (BSD-2-Clause); see public/world-map/NOTICE.txt. */
import {KIND_NETWORK, SPELLBOOKS, houseHas, type TravelSettings} from './world-map-settings';

export type Tile = {x: number; y: number; plane: number};
/** travel.json: [fromX, fromY, fromPlane, toX, toY, toPlane, ticks, kind, name, requirement, houseFeature] */
export type TravelEdge = [number, number, number, number, number, number, number, number, number, number, number];
export type TravelRequirement = {q?: string[]; s?: [string, number][]; c?: number};
export type TravelGroup = {id: string; name: string; cat: string; icon?: number};
export type TravelTeleport = {x: number; y: number; p: number; t: number; g: number; n: number; r: number; w: number; b?: number; h?: number; in?: number; u?: number};
export type TravelData = {v: 1; kinds: string[]; features: string[]; names: string[]; reqs: TravelRequirement[]; edges: TravelEdge[]; groups: TravelGroup[]; teleports: TravelTeleport[]; houses: Record<string, {name: string; x: number; y: number; p: number}>; portals: string[]; house: [number, number, number]};

// ---------- Collision ----------
/** Movement flags per tile: can step north, can step east (south and west read the neighbouring tile). */
export type Collision = {flag(x: number, y: number, plane: number, f: 0 | 1): boolean};
const SLAB = (x: number, y: number, p: number) => (p * 256 + (x >> 6)) * 256 + (y >> 6);

/** Decode public/world-map/collision.dat once it is un-gzipped: "SPCM", region count, then per region x, y, planes and
 * 1024 bytes per plane holding two bits per tile. */
export function decodeCollision(bytes: Uint8Array): Collision {
  if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'SPCM') throw Error('Unknown collision data.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), count = view.getUint32(4, true);
  const planes: (Uint8Array | undefined)[] = new Array(4 * 256 * 256);
  let at = 8;
  for (let i = 0; i < count; i++) {
    const rx = view.getUint16(at, true), ry = view.getUint16(at + 2, true), n = bytes[at + 4];
    at += 5;
    for (let p = 0; p < n; p++, at += 1024) planes[(p * 256 + rx) * 256 + ry] = bytes.subarray(at, at + 1024);
  }
  return {flag(x, y, p, f) {
    if (x < 0 || y < 0 || x >= 16384 || y >= 16384 || p < 0 || p > 3) return false;
    const data = planes[SLAB(x, y, p)];
    if (!data) return false;
    const bit = (((y & 63) << 6) | (x & 63)) * 2 + f;
    return (data[bit >> 3] & (1 << (bit & 7))) !== 0;
  }};
}

const DX = [0, 1, 1, 1, 0, -1, -1, -1], DY = [1, 1, 0, -1, -1, -1, 0, 1];
/** The eight walking moves from a tile, as a bit mask (N, NE, E, SE, S, SW, W, NW). A diagonal needs both flanking moves. */
export function walkMask(c: Collision, x: number, y: number, p: number): number {
  const n = (x: number, y: number) => c.flag(x, y, p, 0), e = (x: number, y: number) => c.flag(x, y, p, 1);
  const N = n(x, y), E = e(x, y), S = n(x, y - 1), W = e(x - 1, y);
  let m = 0;
  if (N) m |= 1;
  if (N && E && e(x, y + 1) && n(x + 1, y)) m |= 2;
  if (E) m |= 4;
  if (S && E && e(x, y - 1) && n(x + 1, y - 1)) m |= 8;
  if (S) m |= 16;
  if (S && W && e(x - 1, y - 1) && n(x - 1, y - 1)) m |= 32;
  if (W) m |= 64;
  if (N && W && e(x - 1, y + 1) && n(x - 1, y)) m |= 128;
  return m;
}
export const walkable = (c: Collision, t: Tile) => walkMask(c, t.x, t.y, t.plane) !== 0;
/** The nearest walkable tile within a few tiles, or null. */
export function snap(c: Collision, t: Tile, radius = 6): Tile | null {
  for (let r = 0; r <= radius; r++) for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const s = {x: t.x + dx, y: t.y + dy, plane: t.plane};
    if (walkable(c, s)) return s;
  }
  return null;
}

/** Wilderness level at a tile (0 outside the Wilderness), surface and underground. */
export function wildernessLevel(t: Tile): number {
  if (t.x >= 2944 && t.x <= 3391 && t.y >= 3520 && t.y <= 4000) return Math.min(56, Math.floor((t.y - 3520) / 8) + 1);
  if (t.x >= 2944 && t.x <= 3455 && t.y >= 9920 && t.y <= 10400) return Math.min(56, Math.floor((t.y - 9920) / 8) + 1);
  return 0;
}

// ---------- The travel graph for one player's settings ----------
const key = (x: number, y: number, p: number) => x + y * 16384 + p * 268435456;
const unkey = (k: number): Tile => ({x: k % 16384, y: Math.floor(k / 16384) % 16384, plane: Math.floor(k / 268435456)});

export type Link = {to: number; cost: number; kind: string; name: string; ban: string};
export type Jump = {to: number; cost: number; name: string; group: string; groupName: string; wild: number; ban: string};
export type TravelGraph = {links: Map<number, Link[]>; teleports: Jump[]};

function meets(r: TravelRequirement | undefined, s: TravelSettings) {
  if (!r) return true;
  if (r.q?.length && !s.quests) return false;
  for (const [skill, lvl] of r.s ?? []) {
    if (skill === 'Agility' && lvl > s.agility) return false;
    if (skill === 'Magic' && lvl > s.magic) return false;
  }
  return true;
}
/** Talking to someone or picking from a menu adds a few ticks the source durations leave out. */
const DIALOGUE = new Set(['boat', 'ship', 'charter', 'canoe', 'carpet', 'glider', 'balloon', 'quetzal']);
const NETWORK_BAN = new Set(['boat', 'ship', 'charter', 'canoe', 'minecart', 'carpet', 'fairy', 'spirit', 'glider', 'balloon', 'mushtree', 'quetzal', 'house']);

/** Every connection this player can use. Requirements beyond quests, Agility and Magic (other skills, items, varbits) are
 * taken as met, so a route can still need something the player lacks. */
export function buildGraph(data: TravelData, s: TravelSettings): TravelGraph {
  const links = new Map<number, Link[]>(), add = (from: number, link: Link) => {const list = links.get(from); if (list) list.push(link); else links.set(from, [link]);};
  for (const e of data.edges) {
    const kind = data.kinds[e[7]], net = KIND_NETWORK[kind], feature = data.features[e[10]];
    if (net && !s.networks[net]) continue;
    if (feature && !houseHas(s.house, feature)) continue;
    if (!meets(data.reqs[e[9]], s)) continue;
    const name = data.names[e[8]];
    add(key(e[0], e[1], e[2]), {to: key(e[3], e[4], e[5]), cost: (e[6] + (DIALOGUE.has(kind) ? 3 : 0)) * 2, kind, name, ban: NETWORK_BAN.has(kind) ? 'kind:' + kind : ''});
  }
  const [hx, hy, hp] = data.house, inside = key(hx, hy, hp), outside = data.houses[String(s.house.location)];
  if (outside) add(inside, {to: key(outside.x, outside.y, outside.p), cost: 4, kind: 'house', name: 'Leave the house', ban: ''});
  const teleports: Jump[] = [];
  for (const t of data.teleports) {
    const g = data.groups[t.g];
    if (!g || !teleportUsable(data, t, s)) continue;
    teleports.push({to: key(t.x, t.y, t.p), cost: t.t * 2, name: data.names[t.n], group: g.id, groupName: teleportGroupName(g, t), wild: t.w, ban: 'group:' + g.id});
  }
  return {links, teleports};
}

const teleportGroupName = (g: TravelGroup, t: TravelTeleport) => g.cat === 'spells' ? SPELLBOOKS[t.b ?? 0] + ' spellbook' : g.name;
/** Whether the player's settings allow a teleport: its spellbook, item, minigame or house, its quest, Magic level and
 * unlocks. */
export function teleportUsable(data: Pick<TravelData, 'groups' | 'reqs'>, t: TravelTeleport, s: TravelSettings): boolean {
  const g = data.groups[t.g];
  if (!g || !meets(data.reqs[t.r], s)) return false;
  if (t.u && !s.unlocks && g.cat !== 'diary') return false;
  if (g.cat === 'spells' || g.cat === 'home') return t.b !== undefined && s.spellbooks.includes(t.b) && (g.cat !== 'home' || s.home);
  if (g.cat === 'minigame') return s.minigames;
  // Teleports to a house portal location only make sense for a house that is there.
  if (g.cat === 'house') return !!s.house.location && s.house.teleport && (!!t.in || t.h === s.house.location);
  return s.items.includes(g.id);
}

/** Where a teleport lands, for the map's Teleports layer: every teleport but the house's own, and whether this player's
 * travel options include it. */
export type TeleportArrival = {x: number; y: number; plane: number; name: string; group: string; groupName: string; cat: string; item?: number; ok: boolean};
export function teleportArrivals(data: Pick<TravelData, 'groups' | 'reqs' | 'names' | 'teleports'>, s: TravelSettings): TeleportArrival[] {
  const out: TeleportArrival[] = [];
  for (const t of data.teleports) {
    const g = data.groups[t.g];
    if (!g || t.in || g.cat === 'house') continue;
    out.push({x: t.x, y: t.y, plane: t.p, name: data.names[t.n], group: g.id, groupName: teleportGroupName(g, t), cat: g.cat, ...(g.icon ? {item: g.icon} : {}), ok: teleportUsable(data, t, s)});
  }
  return out;
}

// ---------- Search ----------
export type RouteStep =
  | {type: 'walk'; tiles: number; ticks: number; from: Tile; to: Tile}
  | {type: 'travel'; kind: string; name: string; ticks: number; from: Tile; to: Tile}
  | {type: 'teleport'; name: string; group: string; groupName: string; ticks: number; to: Tile};
export type RouteLeg = {mode: string; plane: number; points: [number, number][]};
export type Route = {ticks: number; steps: RouteStep[]; legs: RouteLeg[]; bans: string[]; signature: string};

/** Distances and how each tile was reached, stored in 64×64 slabs per floor so only visited areas take memory. */
class Visits {
  dist: (Int32Array | undefined)[] = new Array(4 * 256 * 256);
  dir: (Int8Array | undefined)[] = new Array(4 * 256 * 256);
  via = new Map<number, {prev: number; link?: Link; jump?: Jump}>();
  count = 0;
  get(k: number) {const t = k % 16384, y = Math.floor(k / 16384) % 16384, p = Math.floor(k / 268435456), d = this.dist[SLAB(t, y, p)]; return d ? d[((y & 63) << 6) | (t & 63)] : 0x7fffffff;}
  set(k: number, cost: number, dir: number) {
    const x = k % 16384, y = Math.floor(k / 16384) % 16384, p = Math.floor(k / 268435456), s = SLAB(x, y, p), i = ((y & 63) << 6) | (x & 63);
    let d = this.dist[s];
    if (!d) {d = this.dist[s] = new Int32Array(4096).fill(0x7fffffff); this.dir[s] = new Int8Array(4096).fill(-1);}
    if (d[i] === 0x7fffffff) this.count++;
    d[i] = cost; this.dir[s]![i] = dir;
  }
  dirOf(k: number) {const x = k % 16384, y = Math.floor(k / 16384) % 16384, p = Math.floor(k / 268435456); return this.dir[SLAB(x, y, p)]?.[((y & 63) << 6) | (x & 63)] ?? -1;}
}

export class RouteError extends Error {}
const LIMIT = 4_000_000;

/** The quickest route from one tile to another, in half-ticks (one running step each). */
export function findRoute(c: Collision, g: TravelGraph, fromTile: Tile, toTile: Tile, bans: string[] = []): Route {
  const from = snap(c, fromTile) ?? (g.links.has(key(fromTile.x, fromTile.y, fromTile.plane)) ? fromTile : null);
  const to = snap(c, toTile);
  if (!from) throw new RouteError('The start is not on a path. Move it a little.');
  if (!to) throw new RouteError('The destination is not on a path. Move it a little.');
  const banned = new Set(bans), source = key(from.x, from.y, from.plane), target = key(to.x, to.y, to.plane);
  const teleports = g.teleports.filter(t => !banned.has(t.ban)).sort((a, b) => b.wild - a.wild);
  const v = new Visits(), buckets: number[][] = [];
  const push = (k: number, cost: number) => {(buckets[cost] ??= []).push(k);};
  v.set(source, 0, -1); push(source, 0);
  let jumpsFrom = 0;// teleports before this index (highest Wilderness limit first) have been tried
  for (let cost = 0; cost < buckets.length; cost++) {
    const bucket = buckets[cost];
    if (!bucket) continue;
    for (let i = 0; i < bucket.length; i++) {
      const k = bucket[i];
      if (v.get(k) !== cost) continue;
      if (k === target) return trace(v, source, target, cost, bans);
      if (v.count > LIMIT) throw new RouteError('That trip is too long to plan here. Try a stop on the way.');
      const x = k % 16384, y = Math.floor(k / 16384) % 16384, p = Math.floor(k / 268435456);
      // Teleporting later is never quicker than teleporting as soon as you can, so each teleport is tried once, from
      // the first tile reached where its Wilderness limit allows it.
      if (jumpsFrom < teleports.length) {
        const level = wildernessLevel({x, y, plane: p});
        while (jumpsFrom < teleports.length && level <= teleports[jumpsFrom].wild) {
          const t = teleports[jumpsFrom++], d = cost + t.cost;
          if (d < v.get(t.to)) {v.set(t.to, d, 8); v.via.set(t.to, {prev: k, jump: t}); push(t.to, d);}
        }
      }
      const mask = walkMask(c, x, y, p);
      for (let dir = 0; dir < 8; dir++) {
        if (!(mask & (1 << dir))) continue;
        const n = k + DX[dir] + DY[dir] * 16384, d = cost + 1;
        if (d < v.get(n)) {v.set(n, d, dir); v.via.delete(n); push(n, d);}
      }
      for (const link of g.links.get(k) ?? []) {
        if (link.ban && banned.has(link.ban)) continue;
        const d = cost + link.cost;
        if (d < v.get(link.to)) {v.set(link.to, d, 8); v.via.set(link.to, {prev: k, link}); push(link.to, d);}
      }
    }
    buckets[cost] = undefined as unknown as number[];
  }
  throw new RouteError('No route found with your travel options.');
}

function trace(v: Visits, source: number, target: number, total: number, bans: string[]): Route {
  // Walk back from the target to a list of moves, oldest first.
  type Move = {from: number; to: number; link?: Link; jump?: Jump};
  const moves: Move[] = [];
  for (let at = target; at !== source;) {
    const dir = v.dirOf(at);
    if (dir === 8) {const via = v.via.get(at)!; moves.push({from: via.prev, to: at, link: via.link, jump: via.jump}); at = via.prev;}
    else {const prev = at - DX[dir] - DY[dir] * 16384; moves.push({from: prev, to: at}); at = prev;}
  }
  moves.reverse();
  const steps: RouteStep[] = [], legs: RouteLeg[] = [];
  let walk: RouteStep & {type: 'walk'} | null = null, leg: RouteLeg | null = null;
  const point = (k: number): [number, number] => {const t = unkey(k); return [t.x, t.y];};
  const newLeg = (mode: string, k: number): RouteLeg => {const l = {mode, plane: unkey(k).plane, points: [point(k)]}; legs.push(l); return l;};
  for (const m of moves) {
    const isWalk = !m.link && !m.jump, quiet = m.link && (m.link.kind === 'passage' || m.link.kind === 'shortcut') && unkey(m.from).plane === unkey(m.to).plane && Math.abs(unkey(m.from).x - unkey(m.to).x) + Math.abs(unkey(m.from).y - unkey(m.to).y) <= 6;
    if (isWalk || quiet) {
      // Walking, and doors or short shortcuts on the same floor, read as one walk.
      const ticks = isWalk ? 0.5 : m.link!.cost / 2;
      if (!walk) {walk = {type: 'walk', tiles: 0, ticks: 0, from: unkey(m.from), to: unkey(m.to)}; steps.push(walk);}
      walk.tiles += isWalk ? 1 : 0; walk.ticks += ticks; walk.to = unkey(m.to);
      if (!leg || leg.mode !== 'walk' || leg.plane !== unkey(m.to).plane) leg = newLeg('walk', m.from);
      leg.points.push(point(m.to));
      continue;
    }
    walk = null;
    if (m.jump) steps.push({type: 'teleport', name: m.jump.name, group: m.jump.group, groupName: m.jump.groupName, ticks: m.jump.cost / 2, to: unkey(m.to)});
    else steps.push({type: 'travel', kind: m.link!.kind, name: m.link!.name, ticks: m.link!.cost / 2, from: unkey(m.from), to: unkey(m.to)});
    leg = null;
    // A teleport is drawn as a straight hop from where it is cast to where it lands (on the same floor).
    if (m.jump && unkey(m.from).plane === unkey(m.to).plane) legs.push({mode: 'teleport', plane: unkey(m.to).plane, points: [point(m.from), point(m.to)]});
    if (!m.jump && unkey(m.from).plane === unkey(m.to).plane && m.link!.kind !== 'passage') legs.push({mode: m.link!.kind, plane: unkey(m.to).plane, points: [point(m.from), point(m.to)]});
  }
  for (const l of legs) l.points = simplify(l.points);
  for (const s of steps) if (s.type === 'walk') s.ticks = Math.ceil(s.ticks);
  // Two routes are the same trip when they land in the same places the same way (a tablet and its spell, say).
  const signature = steps.filter(s => s.type !== 'walk').map(s => (s.type === 'teleport' ? 't' : s.kind) + ':' + s.to.x + ',' + s.to.y + ',' + s.to.plane).join('|');
  return {ticks: Math.ceil(total / 2), steps, legs, bans, signature};
}

/** Drop points that sit on a straight line between their neighbours. */
export function simplify(points: [number, number][]): [number, number][] {
  if (points.length < 3) return points;
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [ax, ay] = out[out.length - 1], [bx, by] = points[i], [cx, cy] = points[i + 1];
    if (Math.sign(bx - ax) === Math.sign(cx - bx) && Math.sign(by - ay) === Math.sign(cy - by) && (bx - ax) * (cy - by) === (by - ay) * (cx - bx)) continue;
    out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** What to rule out to find a different route: the teleport group or transport network that saves the most time. */
function alternativesTo(r: Route): string[] {
  const used: {ban: string; ticks: number}[] = [];
  for (const s of r.steps) {
    if (s.type === 'teleport') used.push({ban: 'group:' + s.group, ticks: 1000});
    else if (s.type === 'travel' && NETWORK_BAN.has(s.kind)) used.push({ban: 'kind:' + s.kind, ticks: Math.abs(s.from.x - s.to.x) + Math.abs(s.from.y - s.to.y)});
  }
  return [...new Map(used.sort((a, b) => b.ticks - a.ticks).map(u => [u.ban, u])).keys()];
}

/** The quickest route and up to two different ones (each avoids the main teleport or network of a quicker route). */
export function planRoutes(c: Collision, g: TravelGraph, from: Tile, to: Tile, max = 3): Route[] {
  const best = findRoute(c, g, from, to);
  const routes = [best], tried = new Set<string>(['']);
  const queue: string[][] = alternativesTo(best).map(b => [b]);
  while (routes.length < max && queue.length) {
    const bans = queue.shift()!, id = [...bans].sort().join(',');
    if (tried.has(id)) continue;
    tried.add(id);
    let r: Route;
    try {r = findRoute(c, g, from, to, bans);} catch (e) {if (e instanceof RouteError) continue; throw e;}
    if (routes.some(x => x.signature === r.signature)) {for (const b of alternativesTo(r)) if (!bans.includes(b)) queue.push([...bans, b]); continue;}
    routes.push(r);
    for (const b of alternativesTo(r)) if (!bans.includes(b)) queue.push([...bans, b]);
  }
  return routes.sort((a, b) => a.ticks - b.ticks);
}

/** Game ticks as a short time: "45 s", "2 min 5 s", "12 min", "1 h 5 min". */
export function travelTime(ticks: number): string {
  const s = Math.round(ticks * 0.6);
  if (s < 60) return `${Math.max(1, s)} s`;
  if (s < 600) return s % 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s / 60} min`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}
