import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CompositeMap, displayRuns, readMaps, sheetMaps, type MapRecord, type MapsFile} from './world-maps';

const record = (r: Partial<MapRecord>): MapRecord => ({id: 1, name: 'Test', planes: 2, bounds: [0, 0, 0, 0], centre: [0, 0], home: [0, 0, 0], squares: [], zones: [], ...r});
// The surface: two squares where they are (all floors). Misthalin Underground: the Lumbridge basement square (50,150)
// moved under Lumbridge (50,50), one zone of another dungeon moved next to it, and a dungeon whose only floor is the
// game's floor 1 (square 40,150) shown as the map's ground floor at 49,50.
const FILE: MapsFile = {v: 1, version: 'spooned-maps-test', maps: [
  record({id: 0, name: 'Gielinor Surface', surface: true, planes: 4, home: [3222, 3218, 0], squares: [0, 4, 50, 50, 50, 50, 0, 4, 51, 50, 51, 50]}),
  record({id: 3, name: 'Misthalin Underground', home: [3210, 9616, 0], squares: [0, 1, 50, 150, 50, 50, 1, 1, 40, 150, 49, 50], zones: [0, 1, 60 * 8 + 2, 160 * 8 + 5, 51 * 8, 50 * 8 + 7]}),
]};

test('game tiles become display tiles on the map that shows them, and back', () => {
  const maps = readMaps(FILE), surface = maps.byId(0)!, under = maps.byId(3)!;
  assert.deepEqual(surface.toDisplay({x: 3222, y: 3218, plane: 2}), {x: 3222, y: 3218, plane: 2}, 'the surface moves nothing');
  // Lumbridge basement (3210, 9616): square 50,150 at 50,50, 6400 tiles south.
  assert.deepEqual(under.toDisplay({x: 3210, y: 9616, plane: 0}), {x: 3210, y: 3216, plane: 0});
  assert.deepEqual(under.toGame({x: 3210, y: 3216, plane: 0}), {x: 3210, y: 9616, plane: 0});
  // The moved zone: game zone (482, 1285), its tile 3 east and 6 north, drawn in display zone (408, 407).
  const g = {x: 482 * 8 + 3, y: 1285 * 8 + 6, plane: 0}, d = under.toDisplay(g)!;
  assert.deepEqual(d, {x: 408 * 8 + 3, y: 407 * 8 + 6, plane: 0});
  assert.deepEqual(under.toGame(d), g);
  assert.equal(under.toDisplay({x: 482 * 8 + 8, y: 1285 * 8, plane: 0}), null, 'the next zone of that dungeon is not on the map');
  // The game's floor 1 dungeon is the map's ground floor.
  assert.deepEqual(under.toDisplay({x: 40 * 64 + 10, y: 150 * 64 + 20, plane: 1}), {x: 49 * 64 + 10, y: 50 * 64 + 20, plane: 0});
  assert.equal(under.toDisplay({x: 40 * 64 + 10, y: 150 * 64 + 20, plane: 0}), null, 'nothing below its first floor');
  assert.deepEqual(under.toGame({x: 49 * 64 + 10, y: 50 * 64 + 20, plane: 0}), {x: 40 * 64 + 10, y: 150 * 64 + 20, plane: 1});
  assert.equal(under.toGame({x: 52 * 64, y: 50 * 64, plane: 0}), null, 'black where the map draws nothing');
  assert.equal(under.toDisplay({x: 3222, y: 3218, plane: 0}), null, 'the surface is not underground');
});

test('a tile shows on the map on screen if it can, else the surface, else the map that has it', () => {
  const maps = readMaps(FILE), surface = maps.byId(0)!, under = maps.byId(3)!;
  assert.equal(maps.mapOf({x: 3222, y: 3218, plane: 0}), surface);
  assert.equal(maps.mapOf({x: 3210, y: 9616, plane: 0}), under);
  assert.equal(maps.mapOf({x: 3210, y: 9616, plane: 0}, surface), under, 'going underground switches map');
  assert.equal(maps.mapOf({x: 100, y: 100, plane: 0}), null);
  assert.deepEqual(maps.choices.map(m => m.name), ['Gielinor Surface', 'Misthalin Underground']);
  assert.ok(under.dark && !surface.dark && under.ownTiles);
});

test('where two parts could draw a spot, the one whose own floors hold it wins', () => {
  // One dungeon square with two floors, each its own display square; the ground-floor square reaches up a floor too.
  const map = new CompositeMap(record({squares: [0, 1, 40, 150, 10, 10, 1, 1, 40, 150, 11, 10]}));
  assert.deepEqual(map.toDisplay({x: 40 * 64, y: 150 * 64, plane: 1}), {x: 11 * 64, y: 10 * 64, plane: 0}, 'floor 1 is its own square');
  assert.deepEqual(map.toGame({x: 10 * 64, y: 10 * 64, plane: 1}), {x: 40 * 64, y: 150 * 64, plane: 1}, 'the floor above still reads back');
  // A zone placed over part of a square wins there.
  const over = new CompositeMap(record({squares: [0, 1, 50, 150, 50, 50], zones: [0, 1, 70 * 8, 160 * 8, 50 * 8, 50 * 8]}));
  assert.deepEqual(over.toGame({x: 50 * 64 + 1, y: 50 * 64 + 1, plane: 0}), {x: 70 * 64 + 1, y: 160 * 64 + 1, plane: 0});
  assert.equal(over.toDisplay({x: 50 * 64 + 1, y: 150 * 64 + 1, plane: 0}), null, 'the covered part of the square is hidden');
  assert.deepEqual(over.toDisplay({x: 50 * 64 + 9, y: 150 * 64 + 1, plane: 0}), {x: 50 * 64 + 9, y: 50 * 64 + 1, plane: 0});
});

test('paths split where they leave the map or jump between zones placed apart', () => {
  const under = readMaps(FILE).byId(3)!;
  const runs = displayRuns(under, 0, [[3208, 9616], [3209, 9616], [3210, 9616], [3222, 3218], [3211, 9616], [3212, 9616]], 0);
  assert.deepEqual(runs, [[[3208, 3216], [3209, 3216], [3210, 3216]], [[3211, 3216], [3212, 3216]]]);
  // Across the edge of the moved zone the path leaves the map.
  const edge = displayRuns(under, 0, [[482 * 8 + 6, 1285 * 8 + 1], [482 * 8 + 7, 1285 * 8 + 1], [482 * 8 + 8, 1285 * 8 + 1]], 0);
  assert.deepEqual(edge, [[[408 * 8 + 6, 407 * 8 + 1], [408 * 8 + 7, 407 * 8 + 1]]]);
});

test('a single sheet in game tiles: the surface and the rest as two maps that move nothing', () => {
  const maps = sheetMaps(), surface = maps.surface;
  assert.equal(maps.mapOf({x: 3222, y: 3218, plane: 1}), surface);
  const under = maps.mapOf({x: 2884, y: 9798, plane: 0})!;
  assert.ok(under !== surface && under.dark && !under.ownTiles);
  assert.deepEqual(under.toDisplay({x: 2884, y: 9798, plane: 0}), {x: 2884, y: 9798, plane: 0});
  assert.equal(surface.toDisplay({x: 2884, y: 9798, plane: 0}), null);
  assert.equal(under.toGame({x: 3222, y: 3218, plane: 0}), null);
});
