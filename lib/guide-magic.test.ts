import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {guideMagic,guideMagicNames,magicNeeds,magicRunes} from './guide-magic';
import {GUIDE_PRAYERS,GUIDE_SPELLS,guideReference} from './guide-references';
import {guideItems,guideQuests} from './guides';

/** Spells the guide editor offers that have no card yet (their values are not checked against the Wiki). */
const NO_CARD_YET=new Set(['Ward of Arceuus','Lesser Corruption','Greater Corruption']);
const file=(path:string)=>existsSync('public'+path);

test('every prayer and every non-travel spell the editor offers has a card',()=>{
 for(const p of GUIDE_PRAYERS)assert.ok(guideMagic('prayer',p),p);
 for(const s of GUIDE_SPELLS){
  const r=guideReference(s);
  if(r.kind==='travel'||NO_CARD_YET.has(s))continue;
  assert.equal(r.kind,'spell',s);assert.ok(guideMagic('spell',s),s);
 }
 // And nothing in the data that the editor cannot name.
 for(const n of guideMagicNames('prayer'))assert.ok(GUIDE_PRAYERS.includes(n),n);
 for(const n of guideMagicNames('spell'))assert.ok(GUIDE_SPELLS.includes(n),n);
});
test('summaries stay on one line and every icon, item and quest exists',()=>{
 for(const kind of ['prayer','spell'] as const)for(const name of guideMagicNames(kind)){
  const m=guideMagic(kind,name)!;
  // The card is 296px wide inside: about 44 characters of its 11.5px text.
  assert.ok(m.effect.length<=44,`${name}: "${m.effect}" is ${m.effect.length} characters`);
  assert.ok(m.level>=1&&m.level<=99,name);
  for(const n of magicNeeds(m)){assert.ok(file(n.icon),`${name}: ${n.icon}`);assert.ok(n.text.length<=34,`${name}: ${n.text}`);}
  for(const q of m.quests??[])assert.ok(guideQuests.includes(q),`${name}: ${q}`);
  for(const id of m.items??[])assert.ok(guideItems[id],`${name}: item ${id}`);
  const runes=magicRunes(m);
  assert.ok(runes.length<=4,name);
  for(const r of runes){assert.match(r.name,/ rune$/,`${name}: ${r.id}`);assert.ok(r.amount>0&&file(r.icon),`${name}: ${r.id}`);}
 }
});
test('a prayer card lists its level, skills, quest and unlock',()=>{
 const piety=guideMagic('prayer','piety')!;
 assert.equal(piety.name,'Piety');
 assert.deepEqual(magicNeeds(piety).map(n=>n.text),['70 Prayer','70 Defence',"King's Ransom",'Knight Waves Training Grounds']);
 assert.deepEqual(magicNeeds(guideMagic('prayer','Protect from Melee')!).map(n=>n.text),['43 Prayer']);
 assert.deepEqual(magicNeeds(guideMagic('prayer','Augury')!).map(n=>n.text),['77 Prayer','70 Defence','Arcane prayer scroll']);
});
test('a spell card lists its level, spellbook, quest and runes',()=>{
 const barrage=guideMagic('spell','Ice Barrage')!;
 assert.deepEqual(magicNeeds(barrage).map(n=>n.text),['94 Magic','Ancient Magicks','Desert Treasure I']);
 assert.deepEqual(magicRunes(barrage).map(r=>`${r.amount} ${r.name}`),['6 Water rune','2 Blood rune','4 Death rune']);
 // The standard spellbook needs no unlock line.
 const crumble=guideMagic('spell','Crumble Undead')!;
 assert.deepEqual(magicNeeds(crumble).map(n=>n.text),['39 Magic']);
 assert.deepEqual(magicRunes(crumble).map(r=>`${r.amount} ${r.name}`),['2 Earth rune','2 Air rune','1 Chaos rune']);
 assert.deepEqual(magicNeeds(guideMagic('spell','Vengeance')!).map(n=>n.text),['94 Magic','40 Defence','Lunar spellbook','Lunar Diplomacy']);
 assert.equal(guideMagic('spell','Not a spell'),null);
});
