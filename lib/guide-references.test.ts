import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyGuide,parseGuide,guideInline,guidePlainText,newGuideSetup} from './guides.ts';
import {existsSync} from 'node:fs';
import {GUIDE_SPELLS,guideReference,guideSpellIcon,searchGuideReferences} from './guide-references.ts';
const valid=()=>({...emptyGuide(),title:'Kraken setup',activity:'Kraken',summary:'A sample inventory and equipment setup.',strategy:'Use this strategy with your preferred combat setup.'});

test('[[game terms]] become references; anything else stays text',()=>{
 assert.deepEqual(guideInline('Pray [[Protect from Magic]] now'),['Pray ',{kind:'ref',name:'Protect from Magic'},' now']);
 assert.deepEqual(guideInline('empty [[ ]] and [[unclosed'),['empty [[ ]] and [[unclosed']);
 assert.equal(guidePlainText('Use a [[Dramen staff]].'),'Use a Dramen staff.');
});
test('references resolve skills, prayers, quests and items to icons and Wiki pages',()=>{
 assert.equal(guideReference('slayer').icon,'/icons/skills/slayer.png');
 assert.equal(guideReference('Protect from Magic').icon,'/icons/prayers/protect-from-magic.png');
 assert.equal(guideReference('Dramen staff').kind,'item');
 const unknown=guideReference('Kraken Cove');assert.equal(unknown.kind,'term');assert.equal(unknown.icon,null);
 assert.equal(unknown.href,'https://oldschool.runescape.wiki/w/Kraken_Cove');
 assert.ok(searchGuideReferences('protect').some(r=>r.name==='Protect from Magic'));
});
test('skill and custom requirements are validated',()=>{
 const g=parseGuide({...valid(),requiredSkills:[{skill:'Slayer',level:87}],requiredOther:[{label:'Krack on unlocked',itemId:null},{label:'Fairy ring access',itemId:'772'}]});
 assert.deepEqual(g.requiredSkills,[{skill:'Slayer',level:87}]);assert.equal(g.requiredOther?.length,2);
 assert.throws(()=>parseGuide({...valid(),requiredSkills:[{skill:'Slayer',level:100}]}));
 assert.throws(()=>parseGuide({...valid(),requiredSkills:[{skill:'Slayer',level:80},{skill:'Slayer',level:90}]}));
 assert.throws(()=>parseGuide({...valid(),requiredSkills:[{skill:'Dancing',level:5}]}));
 assert.throws(()=>parseGuide({...valid(),requiredOther:[{label:'x',itemId:null}]}));
 assert.throws(()=>parseGuide({...valid(),requiredOther:[{label:'Bad icon',itemId:'javascript:1'}]}));
});
test('gear tiers name saved loadouts only, once each; setup notes are bounded',()=>{
 const setups=[{...newGuideSetup('Early','early'),note:'Cheap.'},newGuideSetup('Max','max')];
 const g=parseGuide({...valid(),setups,blocks:[{id:'t',kind:'loadouts',setupIds:['early','max']}]});
 assert.equal(g.setups?.[0].note,'Cheap.');
 assert.throws(()=>parseGuide({...valid(),setups,blocks:[{id:'t',kind:'loadouts',setupIds:['early','missing']}]}));
 assert.throws(()=>parseGuide({...valid(),setups,blocks:[{id:'t',kind:'loadouts',setupIds:['early','early']}]}));
 assert.throws(()=>parseGuide({...valid(),setups:[{...setups[0],note:'x'.repeat(401)}]}));
});

test('a plural after a game term stays inside its link',()=>{
 assert.deepEqual(guideInline('a few [[Shark]]s per trip'),['a few ',{kind:'ref',name:'Shark',suffix:'s'},' per trip']);
 assert.equal(guidePlainText('[[Fire rune]]s'),'Fire runes');
});

test('spells show their own spellbook icon, with the Magic icon only as a fallback',()=>{
 assert.equal(guideReference('Crumble Undead').icon,'/icons/spells/crumble-undead.png');
 assert.equal(guideReference('ice barrage').icon,'/icons/spells/ice-barrage.png');
 assert.equal(guideReference("Fenkenstrain's Castle Teleport").icon,'/icons/spells/fenkenstrain-s-castle-teleport.png');
 assert.equal(guideSpellIcon('Not a spell'),'/icons/skills/magic.png');
 for(const name of GUIDE_SPELLS){const icon=guideSpellIcon(name);assert.notEqual(icon,'/icons/skills/magic.png',name);assert.ok(existsSync(new URL('../public'+icon,import.meta.url)),`${name}: ${icon}`);}
});

test('teleports, fairy ring codes and transport stops are travel references with a hover card',()=>{
 const fally=guideReference('Falador Teleport');
 assert.equal(fally.kind,'travel');assert.equal(fally.icon,'/icons/spells/falador-teleport.png');assert.equal(fally.href,'https://oldschool.runescape.wiki/w/Falador_Teleport');
 assert.deepEqual(fally.travel,{kind:'spell',name:'Falador Teleport'});
 const blp=guideReference('blp');assert.equal(blp.name,'BLP');assert.equal(blp.kind,'travel');assert.equal(blp.icon,'/items/772.png');assert.equal(blp.detail,'Fairy ring · TzHaar area');
 const tree=guideReference('Grand Exchange spirit tree');assert.equal(tree.name,'Grand Exchange spirit tree');assert.deepEqual(tree.travel,{kind:'spirit',name:'Grand Exchange'});
 // The travel data spells Carrallanger its own way; the spell keeps its spellbook icon.
 assert.equal(guideReference('Carrallangar Teleport').travel?.name,'Carrallanger Teleport');
 // Items keep their price card, even when a teleport shares the name; spells that go nowhere fixed stay spells.
 assert.equal(guideReference('Amulet of glory').kind,'item');assert.equal(guideReference('Ectophial').kind,'item');
 assert.equal(guideReference('Amulet of glory: Edgeville').kind,'travel');
 assert.equal(guideReference('Teleport to House').kind,'spell');
 assert.equal(guideReference('AKG').kind,'term');
});
test('the editor search finds fairy rings by code or area, and spirit trees',()=>{
 assert.equal(searchGuideReferences('cip')[0].name,'CIP');
 assert.ok(searchGuideReferences('tzhaar',8).some(r=>r.name==='BLP'));
 assert.ok(searchGuideReferences('spirit tree',8).some(r=>r.name==='Grand Exchange spirit tree'));
 assert.equal(searchGuideReferences('falador tele')[0].name,'Falador Teleport');
});
