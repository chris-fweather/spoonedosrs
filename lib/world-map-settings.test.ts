import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HOUSE_PORTAL_PRESETS, applyPortalPreset, portalPreset, presetOn} from './world-map-settings.ts';

const travel = JSON.parse(readFileSync('public/world-map/travel.json', 'utf8')) as {portals: string[]};
const options = JSON.parse(readFileSync('public/world-map/travel-options.json', 'utf8')) as {portals: string[]};
const available = options.portals;

test('house portal presets only name portals the travel data has', () => {
  assert.deepEqual([...travel.portals].sort(), [...available].sort());
  const seen = new Set<string>();
  for (const preset of HOUSE_PORTAL_PRESETS) for (const p of preset.portals) {
    assert.ok(available.includes(p), `${preset.label}: ${p}`);
    assert.ok(!seen.has(p), `${p} is in one spellbook only`);
    seen.add(p);
  }
  assert.deepEqual(portalPreset('all', available), available);
  assert.deepEqual(portalPreset('none', available), []);
  assert.ok(portalPreset('ancient', available).includes('Senntisten'));
  assert.ok(portalPreset('standard', available).includes('Varrock'));
});

test('spellbook presets add their portals, or take them away when all are on; All and None replace', () => {
  let portals = applyPortalPreset('standard', ['Barrows'], available);
  assert.ok(presetOn('standard', portals, available));
  assert.ok(portals.includes('Barrows') && portals.includes('Lumbridge'));
  portals = applyPortalPreset('ancient', portals, available);
  assert.ok(presetOn('ancient', portals, available) && presetOn('standard', portals, available));
  portals = applyPortalPreset('standard', portals, available);
  assert.equal(presetOn('standard', portals, available), false);
  assert.ok(portals.includes('Barrows') && portals.includes('Senntisten') && !portals.includes('Lumbridge'));
  assert.equal(applyPortalPreset('all', portals, available).length, available.length);
  assert.ok(presetOn('all', available, available));
  assert.deepEqual(applyPortalPreset('none', portals, available), []);
  assert.ok(presetOn('none', [], available));
});
