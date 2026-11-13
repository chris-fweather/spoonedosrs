import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cacheUrl, pickCache, runeliteKeys} from './map-tiles-openrs2.mjs';

const cache = (id, timestamp, extra = {}) => ({id, scope: 'runescape', game: 'oldschool', environment: 'live', language: 'en', builds: [{major: 230, minor: null}], timestamp, indexes: 24, valid_indexes: 24, keys: 1000, valid_keys: 1000, disk_store_valid: true, ...extra});

test('the newest complete live Old School cache is picked', () => {
  const caches = [
    cache(1, '2026-10-01T10:00:00Z'),
    cache(2, '2026-11-01T10:00:00Z'),
    cache(3, '2026-11-05T10:00:00Z', {valid_keys: 600}),// too few map keys yet
    cache(4, '2026-11-06T10:00:00Z', {game: 'runescape'}),
    cache(5, '2026-11-06T10:00:00Z', {environment: 'beta'}),
    cache(6, '2026-11-06T10:00:00Z', {disk_store_valid: false}),
  ];
  const picked = pickCache(caches);
  assert.equal(picked.id, 2); assert.equal(picked.date, '2026-11-01'); assert.equal(picked.build, '230'); assert.equal(picked.warning, null);
  assert.equal(pickCache(caches, '3').id, 3, 'a cache asked for by id is used as is');
  assert.throws(() => pickCache(caches, 99), /no cache 99/);
  assert.equal(cacheUrl(picked, 'disk.zip'), 'https://archive.openrs2.org/caches/runescape/2/disk.zip');
});

test('with no complete cache the newest is used, with a warning', () => {
  const picked = pickCache([cache(1, '2026-10-01T00:00:00Z', {valid_keys: 10}), cache(2, '2026-11-01T00:00:00Z', {valid_keys: 20})]);
  assert.equal(picked.id, 2); assert.match(picked.warning, /99%/);
  assert.throws(() => pickCache([cache(1, '2026-10-01T00:00:00Z', {game: 'runescape'})]), /no live Old School/);
});

test('OpenRS2 keys become RuneLite keys', () => {
  assert.deepEqual(runeliteKeys([{archive: 5, group: 1, name_hash: 1, name: 'l50_50', mapsquare: 12850, key: [1, 2, 3, 4]}, {mapsquare: 1, key: [1]}]), [{region: 12850, keys: [1, 2, 3, 4]}]);
});
