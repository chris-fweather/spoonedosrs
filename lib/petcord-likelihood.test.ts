import test from 'node:test';
import assert from 'node:assert/strict';
import {driestLikelihood,driestRecord} from './petcord.ts';
import raw from './petcord-driest.json' with {type:'json'};

test('a driest record gets its likelihood worked out from the sheet rarity',()=>{
 assert.equal(driestLikelihood('1/1,400',5567,'kc'),'98.12%');
 assert.equal(driestLikelihood('1/300',3213,'kc'),'99.99%','very dry records stop at 99.99%');
 assert.equal(driestLikelihood('1/~11.4m XP (tuna/swordfish)',22_800_000,'xp'),'86.46%');
 assert.equal(driestLikelihood('1/1,000 ; 1/67',500,'kc'),null,'two rates give no single figure');
 assert.equal(driestLikelihood('1/~13m XP',1000,'kc'),null,'an XP rate needs an XP count');
 assert.equal(driestLikelihood(undefined,10,'kc'),null);
});
test('every record in the sheet now shows a likelihood unless its rarity is not one plain rate',()=>{
 const records=(raw as {records:{pet:string;rarity:string;likelihood?:string}[]}).records;
 const missing=records.filter(r=>!driestRecord(r.pet)?.likelihood).map(r=>r.rarity);
 assert.ok(missing.every(r=>r.includes(';')),'only multi-rate rows lack one: '+missing.join(' | '));
 assert.equal(driestRecord('Nid')?.likelihood,'99.91%','the sheet figure wins where it has one');
});
