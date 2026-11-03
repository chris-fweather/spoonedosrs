import type {Method, Pet} from './model';

/** Tangleroot's per-tree methods, as PetCord's pet hours sheet (Farming – Tangleroot section) sets them out: count the
 * trees planted and checked, pace in trees an hour, one 1/(base − 25 × Farming level) roll per tree. XP per tree is
 * the sheet's Xp/Resc, shown for reference only. Hespori counts kills; Hespori seeds are a flat 1/500. */
export type TreeRow = {name: string; base: number; flat?: boolean; perHour: number; xp: number | null; unit: 'trees' | 'kills' | 'seeds';
  /** Older names for the same row: the spreadsheet catalogue's and the OSRS Wiki's. */
  aliases?: string[]; activity?: string};

export const TANGLEROOT_TREES: TreeRow[] = [
  {name: 'Palm tree', base: 9000, perHour: 80, xp: 10510, unit: 'trees'},
  {name: 'Spirit tree', base: 5000, perHour: 80, xp: 19500, unit: 'trees', aliases: ['Spirit seed']},
  {name: 'Teak tree', base: 5000, perHour: 80, xp: 7290, unit: 'trees'},
  {name: 'Mahogany tree', base: 5000, perHour: 80, xp: 15720, unit: 'trees'},
  {name: 'Redwood tree', base: 5000, perHour: 80, xp: 22450, unit: 'trees'},
  {name: 'Ironwood tree', base: 5000, perHour: 80, xp: 20525, unit: 'trees'},
  {name: 'Rosewood tree', base: 5000, perHour: 80, xp: 23352, unit: 'trees'},
  {name: 'Calquat tree', base: 6000, perHour: 80, xp: 12244, unit: 'trees', aliases: ['Calquat']},
  {name: 'Papaya tree', base: 9000, perHour: 80, xp: 6380, unit: 'trees'},
  {name: 'Celastrus tree', base: 9000, perHour: 80, xp: 14354, unit: 'trees'},
  {name: 'Dragonfruit tree', base: 9000, perHour: 80, xp: 17825, unit: 'trees'},
  {name: 'Crystal tree', base: 9000, perHour: 80, xp: 13240, unit: 'trees'},
  {name: 'Magic tree', base: 9368, perHour: 80, xp: 13914, unit: 'trees'},
  {name: 'Yew tree', base: 11242, perHour: 80, xp: 7151, unit: 'trees'},
  {name: 'Maple tree', base: 14052, perHour: 80, xp: 3448, unit: 'trees'},
  {name: 'Cactus', base: 7000, perHour: 60, xp: 515, unit: 'trees'},
  {name: 'Mushroom', base: 7500, perHour: 60, xp: 407, unit: 'trees'},
  {name: 'Giant seaweed', base: 7500, perHour: 60, xp: 500, unit: 'trees'},
  {name: 'Belladonna', base: 8000, perHour: 60, xp: 603, unit: 'trees', aliases: ['Belladona', 'Cave nightshade']},
  {name: 'Hespori', base: 7000, perHour: 30, xp: 12600, unit: 'kills', aliases: ['Hespori (kills)'], activity: 'Hespori'},
  {name: 'Hespori seeds (no contracts)', base: 500, flat: true, perHour: 6.1, xp: null, unit: 'seeds'},
];

export const TREE_SOURCE = 'PetCord pet hours sheet, Farming – Tangleroot:';
const key = (s?: string | null) => s?.trim().toLowerCase() ?? '';

export function treeRow(name: string | null | undefined): TreeRow | undefined {
  const k = key(name);
  return TANGLEROOT_TREES.find(r => key(r.name) === k || r.aliases?.some(a => key(a) === k));
}

/** Chance per tree at a Farming level (99 when unknown): base − 25 × level, or the flat base. */
export function treeRate(row: TreeRow, level: number | null | undefined) {
  const l = Math.max(1, Math.min(99, Math.floor(level ?? 99)));
  return row.flat ? row.base : row.base - 25 * l;
}

export function treeMethod(row: TreeRow, level: number | null | undefined): Method {
  const per = row.unit.replace(/s$/, '');
  return {name: row.name, unit: row.unit, kc: null, kph: row.perHour, rate: treeRate(row, level), activity: row.activity ?? null, rateOverride: false, rateConfirmed: true, paceConfirmed: false,
    source: `${TREE_SOURCE} ${row.flat ? `flat 1/${row.base} per ${per}` : `1/(${row.base.toLocaleString('en-US')} − 25 × Farming level) per ${per}`}, example pace ${row.perHour} ${row.unit}/hour${row.xp ? `, ${row.xp.toLocaleString('en-US')} XP per ${per}` : ''}. https://oldschool.runescape.wiki/w/Tangleroot`};
}

/** One short fact for a per-tree method: its XP per tree. */
export function treeFact(m: Pick<Method, 'name' | 'unit'>): string | null {
  const row = treeRow(m.name);
  return row?.xp && row.unit === m.unit ? `${row.xp.toLocaleString('en-US')} XP per ${row.unit.replace(/s$/, '')}` : null;
}

/** Brings Tangleroot's per-tree methods in line with the sheet.
 * - The spreadsheet catalogue rows (counted in "plants", their rates and paces one row out of place) and Wiki crops a
 *   player added in plants become the sheet's method: count kept, unit trees (kills, seeds), pace and rate from the
 *   sheet unless the player set their own. The acquisition record and hunt history follow the rename.
 * - Sheet methods keep their chance on the player's Farming level unless they typed their own. */
export function upgradeTreeMethods(p: Pet, level: number | null | undefined) {
  for (const m of p.methods) {
    const row = treeRow(m.name);
    if (!row) continue;
    const fresh = treeMethod(row, level);
    if (m.unit === 'plants' && (m.source.startsWith('Spreadsheet') || m.source.startsWith('OSRS Wiki:'))) {
      const old = key(m.name), taken = p.methods.some(x => x !== m && key(x.name) === key(row.name));
      if (!taken) m.name = row.name;
      m.unit = row.unit; m.source = fresh.source; m.activity = m.activity ?? fresh.activity;
      if (!m.paceConfirmed) m.kph = fresh.kph;
      if (!m.rateOverride) { m.rate = fresh.rate; m.rateConfirmed = true; }
      if (key(p.obtainedMethod) === old) { p.obtainedMethod = m.name; if (p.obtainedUnit === 'plants') p.obtainedUnit = row.unit; }
      if (p.huntHistory) p.huntHistory = p.huntHistory.map(s => key(s.method) === old ? {...s, method: m.name, unit: s.unit === 'plants' ? row.unit : s.unit} : s);
    } else if (m.source.startsWith(TREE_SOURCE) && !m.rateOverride && m.unit === row.unit) {
      m.rate = fresh.rate; m.rateConfirmed = true;
    }
  }
}
