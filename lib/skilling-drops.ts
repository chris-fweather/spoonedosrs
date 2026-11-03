// A skilling pet's own "drop table": every activity that can roll it, with its chance at the player's level.
import raw from './skill-pet-rates.json';
import icons from './skilling-drop-icons.json';
import {atLevel, type WikiMethod} from './skill-rates';
import {treeRunStats} from './farming-runs';
import {petSkill} from './estimates';
import type {Journal, Pet} from './model';
import type {DropRow, DropSource} from './ui';

const data = raw as {pets: Record<string, {skill: string; methods: WikiMethod[]}>};
/** Official item art for what each row catches, mines, cuts or steals (`public/items`, `public/drops`). Agility
 * courses all use the Mark of grace; rows with no item art keep the pet icon. */
const ICONS = icons as Record<string, Record<string, string>>;
/** The tree run row: magic logs, the run's main tree. */
const TREE_RUN_ICON = '/items/1513.png';
const WIKI = 'https://oldschool.runescape.wiki/w/';

/** What one roll is, per skill. Thieving splits stalls, pickpockets and other actions. */
const PER: Record<string, string> = {Fishing: 'catch', Agility: 'lap', Mining: 'ore', Woodcutting: 'log', Hunter: 'catch', Runecraft: 'craft', Farming: 'patch', Thieving: 'action'};
const PICKPOCKETS = /^(Watchman|Paladin|Gnome|Hero|Vyre|Elf|TzHaar-Hur|Pickpocketing)/;
function perWhat(skill: string, name: string) {
  if (name === 'Fishing Trawler') return 'game';
  if (skill === 'Thieving') return /stall/i.test(name) ? 'theft' : PICKPOCKETS.test(name) ? 'pickpocket' : 'action';
  return PER[skill] ?? 'action';
}
const PLURAL: Record<string, string> = {catch: 'catches', patch: 'patches', theft: 'thefts'};

export type SkillingDrops = {source: DropSource; level: number; known: boolean; skill: string;
  /** What one roll is, for the probability graph: catches, laps, or actions when the table mixes them. */
  unit: string;
  /** Odds bar width: best chance in the table is full, the rarest a sliver, on a log scale. */
  bar: (p: number) => number};

/** Rows: each Wiki method at the player's level (99 when unknown), best chance first; methods above the player's
 * level go last, by level. Tangleroot adds the standard tree run (6 magic + 6 palm trees). Pets without Wiki methods use their saved rates. */
export function skillingDrops(pet: Pet, journal: Journal): SkillingDrops | null {
  const skill = petSkill[pet.name];
  if (!skill) return null;
  const synced = journal.hiscores.skills.find(s => s.name === skill && s.level > 0);
  const level = synced?.level ?? 99, petIcon = `/pets/${pet.id}.png`, own = ICONS[pet.name] ?? {};
  const groups = new Map<string, {row: DropRow; denom: number; req: number}[]>();
  const add = (per: string, name: string, req: number | null, denom: number, icon = own[name] ?? petIcon) => {
    const list = groups.get(per) ?? [];
    list.push({row: [name, req == null ? '—' : String(req), `1/${Math.round(denom).toLocaleString('en-US')}`, 1 / denom, icon], denom, req: req ?? 0});
    groups.set(per, list);
  };
  const methods = data.pets[pet.name]?.methods ?? [];
  if (pet.name === 'Tangleroot') add('tree run', 'Tree run', 75, treeRunStats(level).runsPerPet, TREE_RUN_ICON);
  for (const w of methods) {
    const calc = atLevel(w, level);
    if (calc) add(perWhat(skill, w.name), w.name, w.level, calc.actions);
  }
  if (!methods.length) for (const m of pet.methods) if (m.rate && m.rate >= 1 && m.unit !== 'XP') add(m.unit.replace(/s$/, ''), m.name, null, m.rate);
  if (!groups.size) return null;
  const tabs = [...groups].map(([per, rows]) => ({
    h: `Per ${per}`,
    r: rows.sort((a, b) => Number(a.req > level) - Number(b.req > level) || (a.req > level ? a.req - b.req : a.denom - b.denom) || a.row[0].localeCompare(b.row[0])).map(x => x.row),
  }));
  const all = [...groups.values()].flat().map(x => Math.log(x.denom)), lo = Math.min(...all), hi = Math.max(...all);
  const bar = (p: number) => hi > lo ? 8 + 92 * (hi + Math.log(p)) / (hi - lo) : 100;
  const pers = [...groups.keys()], unit = pers.length === 1 ? PLURAL[pers[0]] ?? pers[0] + 's' : 'actions';
  return {source: {t: pet.name, u: WIKI + encodeURIComponent(pet.name.replaceAll(' ', '_')), tabs}, level, known: !!synced, skill, unit, bar};
}
