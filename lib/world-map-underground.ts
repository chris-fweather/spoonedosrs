/** Names for underground areas (dungeons, cellars, caves), for search and for exit tooltips. Each name sits on the tile
 * an entrance from the surface arrives at, so a search result lands at the entrance; the area around it comes from
 * public/world-map/exits.json. */
import {areaFor, far, inBox, type Box} from './world-map-exits';

export type UndergroundPlace = {name: string; x: number; y: number; plane: number};

export const UNDERGROUND: UndergroundPlace[] = ([
  ['Lumbridge Castle basement', 3210, 9616], ['Lumbridge Swamp Caves', 3169, 9571], ['Draynor Sewers', 3118, 9644],
  ['Draynor Manor basement', 3117, 9753], ['HAM Hideout', 3149, 9652], ["Wizards' Tower basement", 3104, 9576],
  ['Edgeville Dungeon', 3096, 9867], ['Varrock Sewers', 3237, 9858], ['Varrock Museum basement', 1759, 4958],
  ['Stronghold of Security', 1859, 5243], ['Dwarven Mine', 3018, 9850], ['Mining Guild', 3021, 9739],
  ['Asgarnian Ice Dungeon', 3009, 9550], ['Taverley Dungeon', 2884, 9798], ['Burthorpe Games Room', 2205, 4933, 1],
  ["Rogues' Den", 3061, 4985, 1], ['Mole Hole', 1752, 5237], ['Ruins of Camdozaal', 2952, 5762],
  ['Deep Wilderness Dungeon', 3044, 10322], ['Revenant Caves', 3197, 10056], ['Corporeal Beast lair', 2964, 4382, 2],
  ['God Wars Dungeon', 2882, 5311, 2], ['Troll Stronghold', 2837, 10090, 2], ['Fremennik Slayer Dungeon', 2808, 10002],
  ['Keldagrim', 2773, 10162], ['Miscellania Dungeon', 2509, 10245], ['Lighthouse Dungeon', 2518, 9994],
  ['Waterfall Dungeon', 2575, 9861], ['Elemental Workshop', 2716, 9888], ["Legends' Guild basement", 2727, 9774],
  ['Tree Gnome Village Dungeon', 2533, 9556], ['Ardougne Sewers', 2570, 9682], ['Underground Pass', 2495, 9714],
  ['Yanille Agility Dungeon', 2601, 9478], ['Observatory Dungeon', 2355, 9394], ['Shadow Dungeon', 2630, 5071],
  ['Ancient Cavern', 1768, 5366, 1], ['Brimhaven Dungeon', 2713, 9564], ['Karamja Volcano', 2855, 9569],
  ['Shilo Village Gem Mine', 2838, 9387], ['Corsair Cove Dungeon', 1971, 9035, 1], ['Abyss', 3035, 4852],
  ['Kalphite Lair', 3483, 9510, 2], ['Kalphite Cave', 3305, 9497], ['Smoke Dungeon', 3206, 9379],
  ['Sophanem Dungeon', 2800, 5160], ['Experiment Cave', 3577, 9927], ['Slayer Tower basement', 3412, 9932, 3],
  ['Ectofuntus basement', 3669, 9888, 3], ['Haunted Mine', 3436, 9637], ["Mos Le'Harmless Caves", 3748, 9373],
  ['Catacombs of Kourend', 1650, 9987], ['Chasm of Fire', 1435, 10077, 2], ['Forthos Dungeon', 1830, 9973],
  ['Crabclaw Caves', 1646, 9848], ['Shayzien Crypts', 1483, 9951, 3], ['The Warrens', 1813, 10145], ['Cam Torum', 1439, 9509, 1],
] as [string, number, number, number?][]).map(([name, x, y, plane = 0]) => ({name, x, y, plane}));

/** The name of the underground area a tile is in: the named place in the same area nearest the tile, or null. */
export function undergroundName(t: {x: number; y: number}, areas: Box[] = []): string | null {
  const box = areaFor(t, areas);
  let best: UndergroundPlace | null = null;
  for (const p of UNDERGROUND) if (inBox(box, p.x, p.y) && (!best || far(p, t) < far(best, t))) best = p;
  return best?.name ?? null;
}
