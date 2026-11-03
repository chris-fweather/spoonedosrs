import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hoverCard,referenceTarget} from './guide-hovers';
import {guideReference} from './guide-references';

test('items show their price card and skills their skill card',()=>{
 assert.equal(hoverCard({kind:'item',id:'563'}),'price');
 assert.equal(hoverCard({kind:'skill',name:'Magic'}),'skill');
 assert.deepEqual(referenceTarget(guideReference('Magic')),{kind:'skill',name:'Magic'});
 assert.equal(referenceTarget(guideReference('Law rune'))?.kind,'item');
 // Quests and plain terms have no card yet: they keep their Wiki link.
 for(const term of ['Dragon Slayer I','Crandor'])assert.equal(referenceTarget(guideReference(term)),null,term);
});
test('prayers and spells show their magic card; teleport spells keep the travel card',()=>{
 assert.deepEqual(referenceTarget(guideReference('Piety')),{kind:'prayer',name:'Piety'});
 assert.deepEqual(referenceTarget(guideReference('ice barrage')),{kind:'spell',name:'Ice Barrage'});
 assert.equal(hoverCard({kind:'prayer',name:'Protect from Melee'}),'magic');
 assert.equal(hoverCard({kind:'spell',name:'Crumble Undead'}),'magic');
 assert.equal(referenceTarget(guideReference('Varrock Teleport'))?.kind,'travel');
 // A spell without an entry (yet) shows no card rather than an empty one.
 assert.equal(hoverCard({kind:'spell',name:'Ward of Arceuus'}),null);
 assert.equal(referenceTarget(guideReference('Ward of Arceuus')),null);
});
test('travel shows its travel card',()=>{
 assert.deepEqual(referenceTarget(guideReference('Falador Teleport')),{kind:'travel',travel:'spell',name:'Falador Teleport'});
 assert.deepEqual(referenceTarget(guideReference('BLP')),{kind:'travel',travel:'fairy',name:'BLP'});
 assert.equal(hoverCard({kind:'travel',travel:'spirit',name:'Grand Exchange'}),'travel');
});
test('other requirements show no price card, even with an item icon',()=>{
 assert.equal(hoverCard({kind:'other-requirement',label:'10,000 coins, or 33 Magic for Telekinetic Grab',iconItem:'563'}),null);
 // The published requirement tiles follow it: the Other requirements row has no price or skill hover.
 const parts=readFileSync('app/GuideParts.tsx','utf8'),row=parts.split('\n').find(l=>l.includes("['Other requirements'"));
 assert.ok(row&&row.includes('title={r.label}'));
 assert.doesNotMatch(row!,/ItemHover|EntityHover/);
});
