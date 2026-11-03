import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guideDiaryAreas,guideItems} from './guides.ts';
import {itemSource} from './item-sources.ts';

test('each achievement diary reward names its area and tier',()=>{
 assert.deepEqual(itemSource('Fremennik sea boots 4'),{kind:'diary',area:'Fremennik',tier:'Elite'});
 assert.deepEqual(itemSource("Explorer's ring 1"),{kind:'diary',area:'Lumbridge & Draynor',tier:'Easy'});
 assert.equal(itemSource('Fremennik sea boots'),null);
 assert.equal(itemSource('Rune platebody'),null);
 assert.equal(itemSource(undefined),null);
});

test('every diary area has its reward item at all four tiers',()=>{
 const sources=Object.values(guideItems).map(itemSource).filter(s=>!!s);
 for(const area of guideDiaryAreas)for(const tier of ['Easy','Medium','Hard','Elite'])
  assert.ok(sources.some(s=>s.area===area&&s.tier===tier),`${area} ${tier}`);
});
