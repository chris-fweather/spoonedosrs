/** Marker sizes and decluttering for the game maps: icons grow as the map zooms in, and where icons would pile up the
 * less important ones wait for a closer zoom. */

/** Icon size in screen pixels at each zoom: small over the whole world, 28 to 36 once single buildings are readable. */
const SIZES = [16, 16, 18, 20, 22, 26, 30, 32, 36];// zoom 3 to 11
export function markerSize(zoom: number): number {
  return SIZES[Math.max(0, Math.min(SIZES.length - 1, Math.round(zoom) - 3))];
}

/** Which markers win where they would overlap: ways between floors and areas first, then transport, banks, teleports
 * (shown only when asked for) and quest starts; teleports the player cannot use last. */
export const MARKER_PRIORITY = {exitArea: 90, exitFloor: 80, transport: 60, bank: 50, teleport: 48, quest: 45, teleportOff: 20} as const;

/** A marker's place on screen: its centre and size in pixels. */
export type Footprint = {x: number; y: number; size: number; priority: number};

/** Two markers clash when their boxes overlap by more than `overlap` of their combined half sizes on both axes. */
const clash = (a: Footprint, b: Footprint, overlap: number) => {
  const reach = (a.size + b.size) / 2 * (1 - overlap);
  return Math.abs(a.x - b.x) < reach && Math.abs(a.y - b.y) < reach;
};

/** The markers to draw: highest priority first (ties keep list order), each left out if it clashes with one already kept
 * or with a `taken` footprint (markers drawn by another layer). Returns the kept indices in list order. */
export function declutter(items: Footprint[], overlap = .25, taken: Footprint[] = []): number[] {
  const CELL = 48, grid = new Map<string, Footprint[]>();
  const cell = (x: number, y: number) => Math.floor(x / CELL) + ',' + Math.floor(y / CELL);
  const put = (f: Footprint) => {const k = cell(f.x, f.y), list = grid.get(k); if (list) list.push(f); else grid.set(k, [f]);};
  const near = (f: Footprint) => {
    const cx = Math.floor(f.x / CELL), cy = Math.floor(f.y / CELL), out: Footprint[] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(...grid.get((cx + dx) + ',' + (cy + dy)) ?? []);
    return out;
  };
  taken.forEach(put);
  const order = items.map((_, i) => i).sort((a, b) => items[b].priority - items[a].priority || a - b), kept: number[] = [];
  for (const i of order) {
    const f = items[i];
    if (near(f).some(o => clash(f, o, overlap))) continue;
    put(f);
    kept.push(i);
  }
  return kept.sort((a, b) => a - b);
}
