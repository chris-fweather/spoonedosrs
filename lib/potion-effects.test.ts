import {test} from 'node:test';
import assert from 'node:assert/strict';
import guideItems from './guide-item-catalogue.json' with {type:'json'};
import {POTION_EFFECTS,potionEffect} from './potion-effects.ts';

test('every potion with an effect is a real four-dose item',()=>{
 const names=new Set(Object.values(guideItems as Record<string,string>));
 for(const potion of Object.keys(POTION_EFFECTS))assert.ok(names.has(potion+'(4)'),potion);
});

test('a potion at any dose shows its effect; other items show none',()=>{
 assert.equal(potionEffect('Super attack(3)'),POTION_EFFECTS['Super attack']);
 assert.equal(potionEffect('Prayer potion(1)'),POTION_EFFECTS['Prayer potion']);
 assert.equal(potionEffect('Shark'),null);
 assert.equal(potionEffect(undefined),null);
});
