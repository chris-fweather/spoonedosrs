import test from 'node:test';
import assert from 'node:assert/strict';
import {worldMapData} from './world-map-data.ts';

test('world map data files carry the build, so a deploy never reads a day-old cached copy', () => {
 assert.equal(worldMapData('exits.json', 'abc123'), '/world-map/exits.json?v=abc123');
 assert.equal(worldMapData('collision.dat', ''), '/world-map/collision.dat');
});
