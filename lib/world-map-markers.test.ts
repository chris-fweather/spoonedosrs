import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {MARKER_PRIORITY, declutter, markerSize} from './world-map-markers.ts';
import {arrivalIcon, groupTeleports, readPlaces, searchPlaces, teleportPlaceName, teleportRowName, townNear} from './world-map-places.ts';
import {teleportArrivals, type TeleportArrival, type TravelData} from './world-map-routing.ts';
import {DEFAULT_TRAVEL} from './world-map-settings.ts';
import {UNDERGROUND, undergroundName} from './world-map-underground.ts';
import {areaFor, exitLabel, readExits, type ExitsFile} from './world-map-exits.ts';

test('markers grow with the zoom: small over the world, 28 to 36 pixels close in', () => {
  assert.equal(markerSize(3), 16);
  for (let z = 4; z <= 11; z++) assert.ok(markerSize(z) >= markerSize(z - 1));
  for (const z of [9, 10, 11]) assert.ok(markerSize(z) >= 28 && markerSize(z) <= 36, `zoom ${z}`);
  assert.equal(markerSize(2), markerSize(3));
  assert.equal(markerSize(14), 36);
});

test('declutter keeps the more important of two overlapping markers and every marker with room', () => {
  const at = (x: number, y: number, priority: number, size = 24) => ({x, y, size, priority});
  // A quest start under a bank: the bank stays. A teleport 30px away has room. Equal priorities: the first stays.
  assert.deepEqual(declutter([at(100, 100, MARKER_PRIORITY.quest), at(104, 102, MARKER_PRIORITY.bank), at(130, 100, MARKER_PRIORITY.teleport)]), [1, 2]);
  assert.deepEqual(declutter([at(0, 0, 5), at(5, 5, 5)]), [0]);
  // A little overlap is fine (a quarter by default), more is not.
  assert.deepEqual(declutter([at(0, 0, 5), at(20, 0, 5)]), [0, 1]);
  assert.deepEqual(declutter([at(0, 0, 5), at(12, 0, 5)]), [0]);
  // Markers another layer drew (exits) win over everything here.
  assert.deepEqual(declutter([at(50, 50, MARKER_PRIORITY.transport)], .25, [at(52, 50, MARKER_PRIORITY.exitArea)]), []);
  // Many markers on one spot leave one; spread out, all stay.
  assert.equal(declutter(Array.from({length: 200}, (_, i) => at(300 + i % 3, 300, 1))).length, 1);
  assert.equal(declutter(Array.from({length: 200}, (_, i) => at(i * 40, (i % 7) * 40, 1))).length, 200);
});

const arrival = (name: string, group: string, groupName: string, cat: string, x: number, y: number, ok = true, item?: number): TeleportArrival => ({x, y, plane: 0, name, group, groupName, cat, ok, ...(item ? {item} : {})});

test('teleports landing on one spot share a marker named for the place, with the clearest usable icon', () => {
  const list = [
    arrival('Lumbridge Home Teleport', 'home', 'Home teleport', 'home', 3222, 3218, false),
    arrival('Lumbridge tablet', 'teleport-tablets', 'Teleport tablets', 'tablets', 3221, 3218),
    arrival('Lumbridge Teleport', 'spells-standard', 'Standard spellbook', 'spells', 3221, 3218),
    arrival('Amulet of glory: Draynor Village', 'amulet-of-glory', 'Amulet of glory', 'jewellery', 3105, 3251),
    arrival('Max cape: Other Teleports: Farming Guild', 'max-cape', 'Max cape', 'capes', 1248, 3725, false, 13280),
  ];
  const spots = groupTeleports(list);
  assert.equal(spots.length, 3);
  const lumbridge = spots[0];
  assert.equal(lumbridge.name, 'Lumbridge');
  assert.equal(lumbridge.kind, 'teleport');
  assert.deepEqual(lumbridge.teleports!.map(t => t.name), ['Lumbridge Teleport', 'Lumbridge tablet', 'Lumbridge Home Teleport']);
  assert.equal(lumbridge.teleports![0].icon, '/icons/spells/lumbridge-teleport.png');
  assert.equal(lumbridge.teleports![1].icon, '/items/8008.png');
  assert.equal(lumbridge.teleports![2].ok, false);
  assert.ok(!lumbridge.off);
  assert.equal(spots[1].teleports![0].icon, '/items/1712.png');
  assert.equal(spots[2].name, 'Farming Guild');
  assert.equal(spots[2].off, true, 'a spot with no usable teleport is dimmed');
});

test('teleport icons: the game\'s spell, the tablet or item art, and minigames', () => {
  assert.equal(arrivalIcon(arrival('Varrock Teleport: Grand Exchange', 'spells-standard', 'Standard spellbook', 'spells', 0, 0)), '/icons/spells/varrock-teleport.png');
  assert.equal(arrivalIcon(arrival('Varrock tablet: GE', 'teleport-tablets', 'Teleport tablets', 'tablets', 0, 0, true, 8007)), '/items/8007.png');
  assert.equal(arrivalIcon(arrival('Kourend Castle Teleport', 'spells-standard', 'Standard spellbook', 'spells', 0, 0)), '/icons/spells/kourend-castle-teleport.png');
  assert.equal(arrivalIcon(arrival('Ape Atoll Teleport', 'spells-arceuus', 'Arceuus spellbook', 'spells', 0, 0)), '/icons/spells/ape-atoll-teleport.png');
  assert.equal(arrivalIcon(arrival('Respawn Teleport', 'spells-arceuus', 'Arceuus spellbook', 'spells', 0, 0)), '/icons/spells/respawn-teleport.png');
  assert.equal(arrivalIcon(arrival('Edgeville Home Teleport', 'home', 'Home teleport', 'home', 0, 0)), '/icons/spells/lumbridge-home-teleport.png');
  assert.equal(arrivalIcon(arrival('Rat Pits: Ardougne', 'minigames', 'Minigame teleports', 'minigame', 0, 0)), '/icons/game/minigame.png');
  assert.equal(arrivalIcon(arrival('Games necklace: Burthorpe', 'games-necklace', 'Games necklace', 'jewellery', 0, 0, true, 3853)), '/items/3853.png');
  assert.equal(arrivalIcon(arrival('Ectophial', 'ectophial', 'Ectophial', 'quest', 0, 0, true, 4251)), '/items/4251.png');
  assert.equal(teleportPlaceName('Games necklace: Burthorpe'), 'Burthorpe');
  assert.equal(teleportPlaceName('Varrock tablet: GE'), 'Grand Exchange');
  assert.equal(teleportPlaceName('Rat Pits Minigame Teleport: 1. Ardougne'), 'Ardougne');
  assert.equal(teleportPlaceName('Ectophial'), 'Ectophial');
});

test('a marker\'s teleport rows drop the place its title already names, and stay short', () => {
  assert.equal(teleportRowName('Master scroll book: Tai bwo wannai teleport', 'Teleport scrolls', 'Tai bwo wannai'), 'Master scroll book');
  assert.equal(teleportRowName('Tai bwo wannai teleport', 'Teleport scrolls', 'Tai bwo wannai'), 'Teleport scroll');
  assert.equal(teleportRowName('Varrock tablet', 'Teleport tablets', 'Varrock'), 'Teleport tablet');
  assert.equal(teleportRowName('Varrock Teleport', 'Standard spellbook', 'Varrock'), 'Standard spellbook');
  assert.equal(teleportRowName('Amulet of glory: Edgeville', 'Amulet of glory', 'Edgeville'), 'Amulet of glory');
  assert.equal(teleportRowName('Varrock Teleport: Grand Exchange', 'Standard spellbook', 'Grand Exchange'), 'Varrock Teleport');
  assert.equal(teleportRowName('Trinket of fairies: Tool Lep - Tai Bwo Wannai', 'Trinket of fairies', 'Tai bwo wannai'), 'Trinket of fairies: Tool Lep - Tai Bwo Wannai', 'another name for the place stays whole');
});

test('the shipped travel data: every teleport is on the layer, travel options decide which are usable, every icon exists', () => {
  const data = JSON.parse(readFileSync('public/world-map/travel.json', 'utf8')) as TravelData;
  const all = teleportArrivals(data, DEFAULT_TRAVEL);
  assert.equal(all.length, data.teleports.filter(t => !t.in && data.groups[t.g].cat !== 'house').length);
  assert.ok(all.length > 400);
  assert.ok(all.some(a => a.ok) && all.some(a => !a.ok));
  assert.ok(all.filter(a => a.group === 'games-necklace').some(a => a.ok), 'a carried item counts');
  assert.ok(all.filter(a => a.group === 'spells-ancient').every(a => !a.ok), 'another spellbook does not');
  const ancient = teleportArrivals(data, {...DEFAULT_TRAVEL, spellbooks: [1], magic: 99});
  assert.ok(ancient.filter(a => a.group === 'spells-ancient').some(a => a.ok));
  const spots = groupTeleports(all);
  assert.ok(spots.length < all.length && spots.length > 300);
  assert.equal(spots.reduce((n, s) => n + s.teleports!.length, 0), all.length);
  const varrock = spots.find(s => s.name === 'Varrock' && Math.abs(s.x - 3213) < 4)!;
  assert.ok(varrock.teleports!.length >= 2 && varrock.teleports![0].icon === '/icons/spells/varrock-teleport.png');
  for (const icon of new Set(spots.flatMap(s => s.teleports!.map(t => t.icon)))) assert.ok(existsSync('public' + icon), icon);
});

test('dungeons are named, found by search and land underground in their own area', () => {
  const file = JSON.parse(readFileSync('public/world-map/exits.json', 'utf8')) as ExitsFile, {exits, areas} = readExits(file);
  for (const u of UNDERGROUND) {
    assert.ok(areas.some(a => u.x >= a.x0 && u.x < a.x1 && u.y >= a.y0 && u.y < a.y1), `${u.name} is in a known area`);
    assert.equal(undergroundName(u, areas), u.name);
  }
  assert.equal(new Set(UNDERGROUND.map(u => u.name)).size, UNDERGROUND.length);
  const places = readPlaces({v: 1, places: [], quests: []});
  const found = searchPlaces(places, 'taverley dungeon')[0];
  assert.equal(found.name, 'Taverley Dungeon');
  assert.equal(found.kind, 'dungeon');
  assert.ok(areaFor(found, areas).y0 > 9000, 'the search lands underground');
  // The Taverley Dungeon ladder says where it goes, and the ladder back says which town it comes up in.
  const names = {town: (t: {x: number; y: number}) => townNear(places, t), area: (t: {x: number; y: number}) => undergroundName(t, areas)};
  const down = exits.find(e => e.to.x === 2884 && e.to.y === 9798 && e.dir === 'down')!;
  assert.equal(exitLabel(down, names), 'Climb down — Taverley Dungeon');
  const up = exits.find(e => Math.abs(e.from.x - 2884) <= 2 && Math.abs(e.from.y - 9798) <= 2 && e.dir === 'up')!;
  assert.equal(exitLabel(up, names), 'Climb up — Taverley');
  const castle = exits.find(e => e.name === 'Climb-up Staircase' && e.from.x >= 3200 && e.from.x <= 3215 && e.from.y >= 3205 && e.from.y <= 3230 && e.from.plane === 0)!;
  assert.equal(exitLabel(castle, names), 'Climb up — Lumbridge 1st floor');
  const trapdoor = exits.find(e => e.from.x === 3210 && e.from.y === 3216)!;
  assert.equal(exitLabel(trapdoor, names), 'Climb down — Lumbridge Castle basement');
});
