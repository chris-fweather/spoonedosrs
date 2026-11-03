import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {buildGraph, decodeCollision, findRoute, planRoutes, snap, travelTime, walkMask, wildernessLevel, type Collision, type TravelData} from './world-map-routing.ts';
import {DEFAULT_TRAVEL, houseHas, parseTravelSettings, type TravelSettings} from './world-map-settings.ts';

/** An open field of size×size tiles from (base, base) with optional blocked tiles. */
function field(size: number, blocked: [number, number][] = [], base = 3200): Collision {
  const wall = new Set(blocked.map(([x, y]) => x + ',' + y));
  const open = (x: number, y: number) => x >= base && y >= base && x < base + size && y < base + size && !wall.has(x + ',' + y);
  return {flag: (x, y, p, f) => p === 0 && open(x, y) && (f === 0 ? open(x, y + 1) : open(x + 1, y))};
}
const t = (x: number, y: number, plane = 0) => ({x, y, plane});
function data(partial: Partial<TravelData> = {}): TravelData {
  return {v: 1, kinds: ['passage', 'boat', 'fairy', 'house'], features: ['', 'house-fairy', 'box1'], names: ['Door', 'Boat to the east', 'Fairy ring AIQ', 'Games necklace: Burthorpe', 'Varrock Teleport', 'Teleport to house', 'Burthorpe'], reqs: [{}, {q: ['Sea Slug']}, {s: [['Magic', 25]]}],
    edges: [], groups: [{id: 'games-necklace', name: 'Games necklace', cat: 'jewellery'}, {id: 'spells-standard', name: 'Standard spellbook', cat: 'spells'}, {id: 'house', name: 'Teleport to house', cat: 'house'}],
    teleports: [], houses: {'1': {name: 'Rimmington', x: 3205, y: 3205, p: 0}}, portals: [], house: [1858, 7051, 0], ...partial};
}
const settings = (patch: Partial<TravelSettings> = {}): TravelSettings => ({...structuredClone(DEFAULT_TRAVEL), ...patch});

test('diagonal steps need both flanking moves open', () => {
  const c = field(5, [[3201, 3200]]);
  const mask = walkMask(c, 3200, 3200, 0);
  assert.equal(mask & 2, 0, 'no north-east past a blocked east tile');
  assert.ok(mask & 1, 'north is open');
  assert.equal(walkMask(c, 3201, 3200, 0), 0, 'a blocked tile has no moves');
});

test('walking takes half a tick per tile and snaps markers onto the path', () => {
  const c = field(40);
  const r = findRoute(c, buildGraph(data(), settings()), t(3200, 3200), t(3230, 3210));
  assert.equal(r.ticks, 15);
  assert.equal(r.steps.length, 1);
  assert.equal(r.steps[0].type, 'walk');
  assert.deepEqual(snap(field(5, [[3202, 3202]]), t(3202, 3202)), t(3201, 3201));
  assert.equal(snap(c, t(3000, 3000)), null);
});

test('a boat is taken when quicker, and skipped when its network or quest is off', () => {
  const c = field(200);
  const boat: TravelData['edges'][number] = [3201, 3201, 0, 3390, 3390, 0, 10, 1, 1, 1, 0];
  const d = data({edges: [boat]});
  const r = findRoute(c, buildGraph(d, settings()), t(3200, 3200), t(3395, 3395));
  assert.equal(r.steps.map(s => s.type).join(','), 'walk,travel,walk');
  assert.ok(r.ticks < 40);
  const noBoats = settings({networks: {...DEFAULT_TRAVEL.networks, boat: false}});
  assert.equal(findRoute(c, buildGraph(d, noBoats), t(3200, 3200), t(3395, 3395)).ticks, 98);
  assert.equal(findRoute(c, buildGraph(d, settings({quests: false})), t(3200, 3200), t(3395, 3395)).ticks, 98);
});

test('teleports start from the first tile where the Wilderness level allows them', () => {
  // A long north–south strip through the Wilderness (level 1 starts at y 3520).
  const c: Collision = {flag: (x, y, p, f) => p === 0 && x >= 3000 && x <= 3001 && y >= 3400 && y < 3800 && (f === 0 ? y + 1 < 3800 : x === 3000)};
  const d = data({teleports: [{x: 3000, y: 3400, p: 0, t: 4, g: 0, n: 3, r: 0, w: 20}]});
  const g = buildGraph(d, settings());
  const start = t(3000, 3700);
  assert.equal(wildernessLevel(start), 23);
  const r = findRoute(c, g, start, t(3000, 3402));
  // Walk south out of level 23 to level 20 (y 3679), teleport, then walk two tiles.
  assert.deepEqual(r.steps.map(s => s.type), ['walk', 'teleport', 'walk']);
  assert.equal(r.steps[0].to.y, 3679);
});

test('settings decide which teleports and house features exist', () => {
  const d = data({teleports: [
    {x: 3300, y: 3300, p: 0, t: 4, g: 0, n: 3, r: 0, w: 20},
    {x: 3300, y: 3300, p: 0, t: 4, g: 1, n: 4, r: 2, w: 20, b: 0},
    {x: 1858, y: 7051, p: 0, t: 4, g: 2, n: 5, r: 0, w: 20, in: 1},
  ], edges: [[1858, 7051, 0, 3220, 3220, 0, 5, 2, 2, 0, 1]]});
  const names = (s: TravelSettings) => buildGraph(d, s).teleports.map(x => x.name).sort();
  assert.deepEqual(names(settings({items: [], spellbooks: []})), []);
  assert.deepEqual(names(settings({items: ['games-necklace'], spellbooks: [0], magic: 30})), ['Games necklace: Burthorpe', 'Varrock Teleport']);
  assert.deepEqual(names(settings({items: [], spellbooks: [0], magic: 20})), [], 'Magic level gates spells');
  const house = {...DEFAULT_TRAVEL.house, location: 1, teleport: true, fairy: true};
  assert.deepEqual(names(settings({items: [], spellbooks: [], house})), ['Teleport to house']);
  const g = buildGraph(d, settings({items: [], spellbooks: [], house}));
  assert.equal(g.links.get(1858 + 7051 * 16384)?.length, 2, 'house fairy ring and the way out');
  assert.equal(buildGraph(d, settings({house: {...house, fairy: false}})).links.get(1858 + 7051 * 16384)?.length, 1);
  assert.ok(houseHas({...house, box: 3}, 'box1'));
  assert.ok(!houseHas({...house, box: 1}, 'box2'));
  assert.ok(houseHas({...house, portals: ['Varrock']}, 'portal:Varrock'));
});

test('alternatives avoid the main teleport of a quicker route', () => {
  const c = field(300);
  const d = data({teleports: [{x: 3480, y: 3480, p: 0, t: 4, g: 0, n: 3, r: 0, w: 20}, {x: 3470, y: 3440, p: 0, t: 4, g: 1, n: 4, r: 0, w: 20, b: 0}]});
  const routes = planRoutes(c, buildGraph(d, settings({items: ['games-necklace'], spellbooks: [0], magic: 99})), t(3200, 3200), t(3485, 3485));
  assert.ok(routes.length >= 3);
  assert.equal((routes[0].steps[0] as {name: string}).name, 'Games necklace: Burthorpe');
  assert.equal((routes[1].steps[0] as {name: string}).name, 'Varrock Teleport');
  assert.equal(routes[2].steps.length, 1, 'walking only');
  assert.ok(routes[0].ticks <= routes[1].ticks && routes[1].ticks <= routes[2].ticks);
  assert.equal(new Set(routes.map(r => r.signature)).size, routes.length);
  // The teleport is drawn as a hop from where it is cast to where it lands, then the walk.
  assert.deepEqual(routes[0].legs[0], {mode: 'teleport', plane: 0, points: [[3200, 3200], [3480, 3480]]});
  assert.equal(routes[0].legs[1].mode, 'walk');
});

test('saved settings are cleaned', () => {
  const s = parseTravelSettings({agility: 500, magic: 70, spellbooks: [0, 9, 2], items: ['a', 3], networks: {fairy: false}, house: {location: 1, box: 7, portals: ['Varrock']}, extra: 1});
  assert.equal(s.agility, DEFAULT_TRAVEL.agility);
  assert.equal(s.magic, 70);
  assert.deepEqual(s.spellbooks, [0, 2]);
  assert.deepEqual(s.items, ['a']);
  assert.equal(s.networks.fairy, false);
  assert.equal(s.networks.spirit, true);
  assert.equal(s.house.box, 0);
  assert.deepEqual(s.house.portals, ['Varrock']);
  assert.deepEqual(parseTravelSettings('nonsense'), DEFAULT_TRAVEL);
});

test('travel times read like a clock', () => {
  assert.equal(travelTime(10), '6 s');
  assert.equal(travelTime(300), '3 min');
  assert.equal(travelTime(208), '2 min 5 s');
  assert.equal(travelTime(1500), '15 min');
  assert.equal(travelTime(6500), '1 h 5 min');
});

test('the shipped map plans real trips', () => {
  const c = decodeCollision(gunzipSync(readFileSync('public/world-map/collision.dat')));
  const d = JSON.parse(readFileSync('public/world-map/travel.json', 'utf8')) as TravelData;
  const lumbridge = t(3222, 3218), varrock = t(3212, 3424);
  const onFoot = settings({items: [], spellbooks: [], networks: Object.fromEntries(Object.keys(DEFAULT_TRAVEL.networks).map(k => [k, false])) as TravelSettings['networks']});
  const walk = findRoute(c, buildGraph(d, onFoot), lumbridge, varrock);
  assert.ok(walk.ticks > 100 && walk.ticks < 160, `walking Lumbridge to Varrock takes ${walk.ticks} ticks`);
  assert.ok(walk.steps.every(s => s.type === 'walk' || s.type === 'travel'));
  const routes = planRoutes(c, buildGraph(d, settings({spellbooks: [0], magic: 60})), lumbridge, t(2965, 3380));
  assert.equal(routes[0].steps[0].type, 'teleport', 'Falador is a teleport away');
  assert.ok(routes[0].ticks < 20);
  assert.ok(routes.length >= 2);
});
