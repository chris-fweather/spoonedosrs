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
 // Plain terms have no card: they keep their Wiki link.
 assert.equal(referenceTarget(guideReference('Crandor')),null);
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
test('other requirements with an item icon show its price card; the rest show none',()=>{
 assert.equal(hoverCard({kind:'other-requirement',label:'Anti-venom+',iconItem:'12913'}),'price');
 assert.equal(hoverCard({kind:'other-requirement',label:'Slayer task',iconItem:null}),null);
 // The published requirement tiles follow it: an Other requirements row with an item goes through the shared hover.
 const parts=readFileSync('app/GuideParts.tsx','utf8'),row=parts.split('\n').find(l=>l.includes("['Other requirements'"));
 assert.ok(row&&row.includes('title={r.label}'));
 assert.match(row!,/EntityHover target=\{\{kind:'other-requirement'/);
});

test('quests show their quest card, inline and as requirements',()=>{
 assert.equal(hoverCard({kind:'quest',name:'Regicide'}),'quest');
 assert.equal(hoverCard({kind:'quest',name:'Not a quest'}),null);
 assert.deepEqual(referenceTarget(guideReference('Regicide')),{kind:'quest',name:'Regicide'});
});
