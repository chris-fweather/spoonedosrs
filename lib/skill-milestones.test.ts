import test from 'node:test';
import assert from 'node:assert/strict';
import {initial} from './model.ts';
import {crossedMilestones,mergeMilestones,milestoneEvents,milestoneFromAchievement,SKILLS,validMilestones,womMilestones} from './skill-milestones.ts';
import {journalForViewer,DEFAULT_DETAILS} from './profile-privacy.ts';

test('Wise Old Man achievement names map to the milestones we show, and nothing else',()=>{
 const cases:[string,string|null][]=[['99 Attack','Attack:99'],['99 Runecrafting','Runecraft:99'],['99 Sailing','Sailing:99'],['92 Slayer','Slayer:92'],['70 Hunter','Hunter:70'],
  ['Base 70 Stats','base:70'],['Base 80 Stats','base:80'],['Base 90 Stats','base:90'],['Base 99 Stats','maxed'],['Maxed Overall','maxed'],
  ['Base 60 Stats',null],['95 Attack',null],['99 Overall',null],['500m Overall Exp.',null],['50m Attack Exp.',null],['500 Zulrah kills',null],['1k Barrows Chests kills',null]];
 for(const [name,key] of cases)assert.equal(milestoneFromAchievement(name),key,name);
});
test('undated WOM achievements are skipped and loosely dated ones are approximate',()=>{
 const raw=[{name:'99 Attack',createdAt:'2024-03-01T23:59:00Z',accuracy:600_000},{name:'99 Strength',createdAt:'1970-01-01T00:00:00Z',accuracy:null},
  {name:'99 Defence',createdAt:'2012-05-01T00:00:00Z'},{name:'Base 70 Stats',createdAt:'2023-06-02T00:00:00Z',accuracy:-1},{name:'99 Magic',createdAt:'2099-01-01T00:00:00Z'},{name:7},null];
 assert.deepEqual(womMilestones(raw,'2026-10-21'),{'Attack:99':'2024-03-01','base:70':'~2023-06-02'});
 assert.deepEqual(womMilestones({error:'not found'}),{});
});
test('merging keeps exact days over approximate ones, and the earlier of two alike',()=>{
 assert.deepEqual(mergeMilestones({'Attack:99':'~2024-01-05',maxed:'2025-01-01'},{'Attack:99':'2024-02-01',maxed:'2024-12-01','base:70':'~2023-01-01'}),
  {'Attack:99':'2024-02-01',maxed:'2024-12-01','base:70':'~2023-01-01'});
 assert.deepEqual(mergeMilestones({'Attack:99':'2024-02-01'},{'Attack:99':'~2024-01-01'}),{'Attack:99':'2024-02-01'});
 assert.equal(mergeMilestones(undefined,{}),undefined);
});
test('levels crossed between syncs: each skill step, base levels only with every skill known, maxed at all 99',()=>{
 const all=(level:number,overrides:Record<string,number>={})=>SKILLS.map(name=>({name,level:overrides[name]??level,xp:1}));
 assert.deepEqual(crossedMilestones(all(98,{Attack:9}),all(99,{Attack:21}),'2026-10-21'),
  {'Attack:10':'~2026-10-21','Attack:20':'~2026-10-21',...Object.fromEntries(SKILLS.filter(s=>s!=='Attack').map(s=>[`${s}:99`,'~2026-10-21'])),});
 assert.deepEqual(crossedMilestones(all(89),all(99),'2026-10-21').maxed,'~2026-10-21');
 assert.equal(crossedMilestones(all(69),all(91),'2026-10-21')['base:90'],'~2026-10-21');
 const missing=all(69).filter(s=>s.name!=='Sailing');
 const partial=crossedMilestones(missing,all(75),'2026-10-21');
 assert.equal(partial['base:70'],undefined,'an unranked skill hides the base level');assert.equal(partial['Sailing:70'],undefined);assert.equal(partial['Attack:70'],'~2026-10-21');
 assert.deepEqual(crossedMilestones(all(80),all(80),'2026-10-21'),{});
});
test('timeline milestones are validated and hidden with the profile skills',()=>{
 const j={...structuredClone(initial),skillMilestones:{'Attack:99':'2024-02-01','base:70':'~2023-01-01',maxed:'2025-01-01'}};
 assert.ok(validMilestones(j.skillMilestones));assert.ok(!validMilestones({'Attack:95':'2024-02-01'}));assert.ok(!validMilestones({'Attack:99':'soon'}));
 assert.deepEqual(milestoneEvents(j).map(e=>[e.name,e.date,e.approximate,e.image]),[['Base 70','2023-01-01',true,'/icons/navigation/stats-icon.png'],['99 Attack','2024-02-01',false,'/icons/skills/attack.png'],['Maxed','2025-01-01',false,'/items/13280.png']]);
 const hidden=journalForViewer(j,'public',false,{...DEFAULT_DETAILS,skills:false});
 assert.equal(hidden.skillMilestones,undefined);assert.deepEqual(milestoneEvents(hidden),[]);
 assert.equal(milestoneEvents(journalForViewer(j,'public',false)).length,3);
 assert.equal(journalForViewer(j,'private',false).skillMilestones,undefined);
 assert.deepEqual(milestoneEvents({...j,details:{...DEFAULT_DETAILS,skills:false}}),[]);
});
