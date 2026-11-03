import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {GUIDE_SKILLS} from './guides';
import {SKILL_INFO,SKILL_MAX_LEVEL,skillInfo} from './skill-info';

test('every skill has a short rundown for its hover card',()=>{
 assert.deepEqual(Object.keys(SKILL_INFO).sort(),[...GUIDE_SKILLS].sort());
 // The 23 skills of the original game, plus Sailing.
 assert.equal(GUIDE_SKILLS.length,24);
 for(const skill of GUIDE_SKILLS){
  const info=SKILL_INFO[skill];
  // The summary is one line of the card, never two.
  assert.ok(info.summary.length>=10&&info.summary.length<=48,`${skill}: keep the summary to one line (${info.summary.length} characters)`);
  assert.ok(info.facts.length>=1&&info.facts.length<=3,skill+' facts');
  // Each fact fits one cell of the card's two-column grid.
  for(const fact of info.facts)assert.ok(fact.label.length<=20&&fact.value.length<=17,`${skill}: keep "${fact.label}: ${fact.value}" short`);
  assert.ok(existsSync(`public/icons/skills/${skill.toLowerCase()}.png`),skill+' icon');
 }
 assert.equal(SKILL_MAX_LEVEL,99);
});
test('fact icons are the game things they name, and exist on disk',()=>{
 for(const skill of GUIDE_SKILLS)for(const fact of SKILL_INFO[skill].facts)if(fact.icon){
  assert.match(fact.icon,/^\/[a-z0-9/_.-]+\.png$/i,`${skill}: ${fact.label} icon path`);
  assert.ok(existsSync('public'+fact.icon),`${skill}: ${fact.label} icon ${fact.icon} missing`);
 }
 const magic=SKILL_INFO.Magic.facts;
 assert.equal(magic.find(f=>f.label==='High Level Alchemy')?.icon,'/icons/spells/high-level-alchemy.png');
 assert.equal(magic.find(f=>f.label==='Ice Barrage')?.icon,'/icons/spells/ice-barrage.png');
 assert.equal(SKILL_INFO.Prayer.facts.find(f=>f.label==='Piety')?.icon,'/icons/prayers/piety.png');
 // Most facts name something with an icon.
 const all=GUIDE_SKILLS.flatMap(s=>SKILL_INFO[s].facts);
 assert.ok(all.filter(f=>f.icon).length>=all.length*0.8,'most facts have an icon');
});
test('skills are grouped as the OSRS Wiki groups them',()=>{
 const group=(c:string)=>GUIDE_SKILLS.filter(s=>SKILL_INFO[s].category===c).sort();
 assert.deepEqual(group('Combat'),['Attack','Defence','Hitpoints','Magic','Prayer','Ranged','Strength']);
 assert.deepEqual(group('Gathering'),['Farming','Fishing','Hunter','Mining','Woodcutting']);
 assert.deepEqual(group('Artisan'),['Construction','Cooking','Crafting','Firemaking','Fletching','Herblore','Runecraft','Smithing']);
 assert.deepEqual(group('Support'),['Agility','Slayer','Thieving']);
});
test('free-to-play and members skills are marked',()=>{
 const free=GUIDE_SKILLS.filter(s=>!SKILL_INFO[s].members).sort();
 assert.deepEqual(free,['Attack','Cooking','Crafting','Defence','Firemaking','Fishing','Hitpoints','Magic','Mining','Prayer','Ranged','Runecraft','Smithing','Strength','Woodcutting']);
});
test('skills are found by name in any case, other words are not',()=>{
 assert.equal(skillInfo('magic')?.name,'Magic');
 assert.match(skillInfo('Magic')!.summary,/teleport/);
 assert.equal(skillInfo('Shark'),null);
});
