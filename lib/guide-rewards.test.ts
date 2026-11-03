import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {emptyGuide,guideItemImage,guideItems,parseGuide,GUIDE_REWARD_LIMITS,GUIDE_REWARD_SOURCES,GUIDE_REWARD_TIERS} from './guides';

const guide=(blocks:unknown[])=>({...emptyGuide(),title:'Dragon Slayer I',activity:'Dragon Slayer I',summary:'Rebuild the map to Crandor and slay Elvarg.',strategy:'Talk to the Guildmaster in the Champions\' Guild.',blocks});
const quest={id:'r1',kind:'rewards',variant:'quest',title:' Dragon Slayer I ',itemId:'11279',questPoints:2,xp:[{skill:'Strength',amount:18650},{skill:'Defence',amount:18650}],lines:['The right to wear a [[Rune platebody]]','  ','Access to Crandor']};
const parse=(b:unknown)=>{const g=parseGuide(guide([b]));return g.blocks![0];};

test('a quest rewards section keeps its scroll: title, picture, quest points, XP and lines',()=>{
 assert.deepEqual(parse(quest),{id:'r1',kind:'rewards',variant:'quest',title:'Dragon Slayer I',itemId:'11279',questPoints:2,xp:[{skill:'Strength',amount:18650},{skill:'Defence',amount:18650}],lines:['The right to wear a [[Rune platebody]]','Access to Crandor']});
});
test('chest, casket and diary rewards parse, with lamp XP in any skill',()=>{
 assert.deepEqual(parse({id:'c',kind:'rewards',variant:'casket',title:'Reward casket (hard)',items:[{id:'995',quantity:48210},{id:'1127',quantity:1}]}),{id:'c',kind:'rewards',variant:'casket',title:'Reward casket (hard)',items:[{id:'995',quantity:48210},{id:'1127',quantity:1}]});
 assert.equal((parse({id:'b',kind:'rewards',variant:'chest',title:'Barrows chest',items:[{id:'995',quantity:3000}]}) as {variant:string}).variant,'chest');
 const diary=parse({id:'d',kind:'rewards',variant:'diary',title:'Varrock Hard',items:[{id:'13106',quantity:1}],xp:[{skill:'Any',amount:13500}],lines:['10% chance to mine 2 ores at once']});
 assert.deepEqual((diary as {xp:unknown}).xp,[{skill:'Any',amount:13500}]);
});
test('a casket keeps its tier and a chest its source; older sections without them still parse',()=>{
 for(const tier of GUIDE_REWARD_TIERS)assert.equal((parse({id:'c',kind:'rewards',variant:'casket',tier,title:'Reward casket',items:[{id:'995',quantity:5000}]}) as {tier?:string}).tier,tier);
 for(const source of GUIDE_REWARD_SOURCES)assert.equal((parse({id:'b',kind:'rewards',variant:'chest',source,title:'Loot',items:[{id:'995',quantity:5000}]}) as {source?:string}).source,source);
 const old=parse({id:'c',kind:'rewards',variant:'casket',title:'Reward casket (hard)',items:[{id:'995',quantity:1}]}) as {tier?:string;source?:string};
 assert.equal(old.tier,undefined);assert.equal(old.source,undefined);
 // A tier only belongs to a casket and a source to a chest: on other rewards they are dropped.
 assert.equal('tier' in parse({...quest,tier:'hard'}),false);
 assert.equal('source' in parse({id:'c',kind:'rewards',variant:'casket',source:'barrows',title:'Casket',items:[{id:'995',quantity:1}]}),false);
 assert.throws(()=>parse({id:'c',kind:'rewards',variant:'casket',tier:'grandmaster',title:'Casket',items:[{id:'995',quantity:1}]}),/beginner, easy, medium, hard, elite or master/);
 assert.throws(()=>parse({id:'b',kind:'rewards',variant:'chest',source:'nex',title:'Nex',items:[{id:'995',quantity:1}]}),/where the chest/);
});
test('every casket tier and chest window has its picture on disk',()=>{
 for(const tier of GUIDE_REWARD_TIERS)assert.ok(existsSync(`public/icons/ui-reward/casket-${tier}.png`),tier);
 for(const f of ['steelborder','tradebacking','steelborder-divider'])assert.ok(existsSync(`public/icons/ui-reward/${f}.png`),f);
 for(const boss of ['barrows-chests','chambers-of-xeric','theatre-of-blood','tombs-of-amascut','lunar-chests','the-gauntlet'])assert.ok(existsSync(`public/bosses/${boss}.png`),boss);
});
test('rewards sections are checked',()=>{
 assert.throws(()=>parse({...quest,variant:'shop'}),/quest, chest, casket or diary/);
 assert.throws(()=>parse({...quest,title:'  '}),/Name the rewards/);
 assert.throws(()=>parse({...quest,questPoints:11}),/quest points/);
 assert.throws(()=>parse({...quest,xp:[{skill:'Cooking skill',amount:10}]}),/XP rewards/);
 assert.throws(()=>parse({...quest,xp:[{skill:'Magic',amount:0}]}),/XP rewards/);
 assert.throws(()=>parse({...quest,itemId:'not-an-item'}),/rewards picture/);
 assert.throws(()=>parse({...quest,items:[{id:'995',quantity:1.5}]}),/reward items/);
 assert.throws(()=>parse({...quest,items:Array.from({length:GUIDE_REWARD_LIMITS.items+1},(_,i)=>({id:Object.keys(guideItems)[i],quantity:1}))}),/reward items/);
 assert.throws(()=>parse({...quest,lines:['x'.repeat(GUIDE_REWARD_LIMITS.line+1)]}),/reward line/);
 assert.throws(()=>parse({id:'e',kind:'rewards',variant:'quest',title:'Cook\'s Assistant',questPoints:0,lines:['']}),/at least one reward/);
});
test('a rewards section can sit in a column',()=>{
 const g=parseGuide(guide([{id:'cols',kind:'columns',split:'1:1',columns:[{id:'t',kind:'text',text:'Rewards',style:'body',tone:'default'},quest]}]));
 assert.equal((g.blocks![0] as {columns:{kind:string}[]}).columns[1].kind,'rewards');
});
test('the map pieces and the Ghost\'s skull are guide items with their official icons',()=>{
 for(const [id,name] of [['1535','Map part (Melzar)'],['1536','Map part (Thalzar)'],['1537','Map part (Lozar)'],['1538','Crandor map'],['553',"Ghost's skull"]]){
  assert.equal(guideItems[id],name);assert.equal(guideItemImage(id),`/items/${id}.png`);
  const png=readFileSync(`public/items/${id}.png`);assert.equal(png.subarray(1,4).toString(),'PNG');assert.ok(existsSync(`public/items/${id}.png`));
 }
});
