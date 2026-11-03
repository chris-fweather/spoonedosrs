/** The player's travel options for the world map route planner, kept in the browser. Everything here is a choice the
 * player makes about their own account; the planner trusts it rather than checking the game. */

export const NETWORKS = [
  {id: 'shortcut', label: 'Agility shortcuts'},
  {id: 'boat', label: 'Boats and ships'},
  {id: 'charter', label: 'Charter ships'},
  {id: 'fairy', label: 'Fairy rings'},
  {id: 'spirit', label: 'Spirit trees'},
  {id: 'glider', label: 'Gnome gliders'},
  {id: 'quetzal', label: 'Quetzals'},
  {id: 'balloon', label: 'Balloons'},
  {id: 'canoe', label: 'Canoes'},
  {id: 'minecart', label: 'Minecarts'},
  {id: 'carpet', label: 'Magic carpets'},
  {id: 'mushtree', label: 'Magic mushtrees'},
  {id: 'portal', label: 'Portals and levers'},
] as const;
export type NetworkId = (typeof NETWORKS)[number]['id'];
/** Which network setting each transport kind in the data belongs to. Passages (doors, stairs) are always on. */
export const KIND_NETWORK: Record<string, NetworkId | null> = {passage: null, shortcut: 'shortcut', boat: 'boat', ship: 'boat', charter: 'charter', canoe: 'canoe', minecart: 'minecart', carpet: 'carpet', lever: 'portal', portal: 'portal', fairy: 'fairy', spirit: 'spirit', glider: 'glider', balloon: 'balloon', mushtree: 'mushtree', quetzal: 'quetzal', house: null};

export const SPELLBOOKS = ['Standard', 'Ancient', 'Lunar', 'Arceuus'] as const;
export const JEWELLERY_BOXES = ['None', 'Basic', 'Fancy', 'Ornate'] as const;

export type HouseSettings = {location: number; teleport: boolean; box: number; glory: boolean; xeric: boolean; digsite: boolean; mythical: boolean; fairy: boolean; spirit: boolean; portals: string[]};
export type TravelSettings = {
  v: 1;
  /** Treat quest-locked routes as open. */
  quests: boolean;
  /** Treat diary and other unlocks (like the Varrock teleport to the Grand Exchange) as done. */
  unlocks: boolean;
  agility: number;
  magic: number;
  spellbooks: number[];
  home: boolean;
  minigames: boolean;
  networks: Record<NetworkId, boolean>;
  /** Teleport item groups the player carries, by group id from travel.json. */
  items: string[];
  house: HouseSettings;
};

export const DEFAULT_TRAVEL: TravelSettings = {
  v: 1, quests: true, unlocks: false, agility: 50, magic: 55, spellbooks: [0], home: false, minigames: false,
  networks: Object.fromEntries(NETWORKS.map(n => [n.id, true])) as Record<NetworkId, boolean>,
  items: ['games-necklace', 'ring-of-dueling', 'amulet-of-glory', 'skills-necklace', 'combat-bracelet', 'ring-of-wealth'],
  house: {location: 0, teleport: false, box: 0, glory: false, xeric: false, digsite: false, mythical: false, fairy: false, spirit: false, portals: []},
};

const bool = (v: unknown, d: boolean) => typeof v === 'boolean' ? v : d;
const level = (v: unknown, d: number) => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 99 ? v : d;
const strings = (v: unknown, d: string[]) => Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.length <= 60).slice(0, 120) : d;

/** Read saved settings, keeping only known values; anything missing or broken falls back to the defaults. */
export function parseTravelSettings(raw: unknown): TravelSettings {
  const d = DEFAULT_TRAVEL;
  if (!raw || typeof raw !== 'object') return structuredClone(d);
  const r = raw as Record<string, unknown>, h = (r.house && typeof r.house === 'object' ? r.house : {}) as Record<string, unknown>, n = (r.networks && typeof r.networks === 'object' ? r.networks : {}) as Record<string, unknown>;
  const books = Array.isArray(r.spellbooks) ? [...new Set(r.spellbooks.filter((b): b is number => typeof b === 'number' && Number.isInteger(b) && b >= 0 && b <= 3))] : d.spellbooks;
  return {
    v: 1, quests: bool(r.quests, d.quests), unlocks: bool(r.unlocks, d.unlocks), agility: level(r.agility, d.agility), magic: level(r.magic, d.magic),
    spellbooks: books, home: bool(r.home, d.home), minigames: bool(r.minigames, d.minigames),
    networks: Object.fromEntries(NETWORKS.map(x => [x.id, bool(n[x.id], d.networks[x.id])])) as Record<NetworkId, boolean>,
    items: strings(r.items, d.items),
    house: {
      location: typeof h.location === 'number' && Number.isInteger(h.location) && h.location >= 0 && h.location <= 20 ? h.location : 0,
      teleport: bool(h.teleport, false), box: typeof h.box === 'number' && [0, 1, 2, 3].includes(h.box) ? h.box : 0,
      glory: bool(h.glory, false), xeric: bool(h.xeric, false), digsite: bool(h.digsite, false), mythical: bool(h.mythical, false),
      fairy: bool(h.fairy, false), spirit: bool(h.spirit, false), portals: strings(h.portals, []),
    },
  };
}

/** Whether a house feature from travel.json (box1, glory, portal:Varrock, house-fairy…) is built in this house. */
export function houseHas(house: HouseSettings, feature: string): boolean {
  if (!house.location) return false;
  if (feature.startsWith('portal:')) return house.portals.includes(feature.slice(7));
  if (/^box[123]$/.test(feature)) return house.box >= Number(feature[3]);
  if (feature === 'house-fairy') return house.fairy;
  if (feature === 'house-spirit') return house.spirit;
  return feature === 'glory' || feature === 'xeric' || feature === 'digsite' || feature === 'mythical' ? house[feature] : false;
}

/** One-click sets of house portals (portal chamber and nexus) for Travel options, by spellbook. Every name is one of the
 * travel data's house portals (`portals` in public/world-map/travel.json; checked by a test). Standard has both ends of
 * the redirectable portals (Camelot or Seers' Village, Watchtower or Yanille, Varrock or the Grand Exchange). Portals of
 * other teleports (Troll Stronghold, Weiss) come only with All. */
export const HOUSE_PORTAL_PRESETS = [
  {id: 'standard', label: 'Standard', portals: ['Varrock', 'Grand Exchange', 'Lumbridge', 'Falador', 'Camelot', "Seers' Village", 'Ardougne', 'Watchtower', 'Yanille', 'Trollheim', 'Marim', 'Kourend', 'Civitas illa Fortis']},
  {id: 'ancient', label: 'Ancient', portals: ['Paddewwa', 'Senntisten', 'Kharyrll', 'Lassar', 'Dareeyak', 'Carrallanger', 'Annakarl', 'Ghorrock']},
  {id: 'lunar', label: 'Lunar', portals: ['Lunar Isle', 'Ourania', 'Waterbirth Island', 'Barbarian Outpost', 'Port Khazard', 'Fishing Guild', 'Catherby', 'Ice Plateau']},
  {id: 'arceuus', label: 'Arceuus', portals: ['Arceuus Library', 'Draynor Manor', 'Battlefront', 'Mind Altar', 'Salve Graveyard', "Fenkenstrain's Castle", 'West Ardougne', 'Harmony Island', 'Cemetery', 'Barrows', 'Ape Atoll Dungeon']},
] as const;
export type PortalPresetId = (typeof HOUSE_PORTAL_PRESETS)[number]['id'] | 'all' | 'none';

/** The house portals a preset switches on, out of the ones the travel data has (`all`: every one, `none`: none). */
export function portalPreset(id: PortalPresetId, available: readonly string[]): string[] {
  if (id === 'none') return [];
  if (id === 'all') return [...available];
  const set = new Set<string>(HOUSE_PORTAL_PRESETS.find(p => p.id === id)?.portals ?? []);
  return available.filter(p => set.has(p));
}
/** Whether every portal of a preset is on (`none`: no portal is on). */
export function presetOn(id: PortalPresetId, portals: readonly string[], available: readonly string[]): boolean {
  const have = portals.filter(p => available.includes(p)), want = portalPreset(id, available);
  return id === 'none' ? have.length === 0 : want.length > 0 && want.every(p => have.includes(p));
}
/** A preset button: All and None replace the portals; a spellbook adds its portals, or takes them away when all are on. */
export function applyPortalPreset(id: PortalPresetId, portals: readonly string[], available: readonly string[]): string[] {
  if (id === 'all' || id === 'none') return portalPreset(id, available);
  const want = portalPreset(id, available);
  if (presetOn(id, portals, available)) return portals.filter(p => !want.includes(p));
  return available.filter(p => portals.includes(p) || want.includes(p));
}
