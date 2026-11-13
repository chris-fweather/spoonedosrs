import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial} from './model.ts';
import {SPOILS_OF_WAR,ZEAL_PER_CRATE,normalizeRates,upgradeEstimates} from './estimates.ts';
import {petExpectedHours} from './pet-luck.ts';

test("Lil' Creator hunts with Spoils of war at 150 Zeal an hour (5 crates), 80 h", () => {
  const j = upgradeEstimates(structuredClone(initial));
  const p = j.pets.find(x => x.name === "Lil' Creator")!;
  const m = p.methods.find(x => x.name === SPOILS_OF_WAR)!;
  assert.equal(m.unit, 'crates');
  assert.equal(m.rate, 400);
  assert.equal(m.kph! * ZEAL_PER_CRATE, 150);
  assert.equal(Math.round(petExpectedHours(p, j)!), 80);
  assert.ok(!p.methods.some(x => /example/i.test(x.name)));
});

test('a saved "150 Zeal/hour example" method is renamed, keeping its count, pace and record', () => {
  const j = upgradeEstimates(structuredClone(initial));
  const p = j.pets.find(x => x.name === "Lil' Creator")!;
  const old = 'Spoils of war · 150 Zeal/hour example';
  p.methods = p.methods.map(m => m.name === SPOILS_OF_WAR ? {...m, name: old, kc: 120, kph: 8, paceConfirmed: true} : m);
  p.obtained = true; p.obtainedMethod = old;
  normalizeRates(j);
  const m = p.methods.find(x => x.name === SPOILS_OF_WAR)!;
  assert.equal(m.kc, 120); assert.equal(m.kph, 8);
  assert.equal(p.obtainedMethod, SPOILS_OF_WAR);
  assert.ok(!p.methods.some(x => x.name === old));
});
