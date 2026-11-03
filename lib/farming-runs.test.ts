import assert from 'node:assert/strict';
import test from 'node:test';
import {defaultFarmingRun,farmingRunStats,farmingRunsMethod,validFarmingRun,LEGACY_MIXED_RUN,TREE_RUNS,treeRunStats,treeRunsMethod,isTreeRun,presetTreeRunRate} from './farming-runs.ts';
import {hiscoresCount} from './pet-record.ts';
import {mixedFarmingMethod,normalizeRates} from './estimates.ts';
import {receivedMethod} from './hunt-history.ts';
import {applyPetEdit} from './pet-edit.ts';
import {initial,likelihood,validatePet,expectedHours,type Journal} from './model.ts';

const near=(a:number,b:number,eps=1e-9)=>assert.ok(Math.abs(a-b)<eps,`${a} ≠ ${b}`);
function journal(level?:number):Journal{const j=structuredClone(initial);j.hiscores.skills=level?[{name:'Farming',level,xp:13_034_431,rank:1}]:[];return j;}

test('a saved run’s default trees are the best tree and fruit tree on the 5 + 4 free patches',()=>{
 assert.deepEqual(defaultFarmingRun(99),[{crop:'Magic',count:5},{crop:'Dragonfruit',count:4}]);
 assert.deepEqual(defaultFarmingRun(70),[{crop:'Yew',count:5},{crop:'Palm',count:4}]);
 assert.deepEqual(defaultFarmingRun(20),[{crop:'Oak',count:5}]);
 assert.deepEqual(defaultFarmingRun(5),[]);
});

test('per-run chance multiplies each checked tree’s miss chance at the Farming level',()=>{
 const s=farmingRunStats(defaultFarmingRun(99),99);
 near(s.chance,1-(1-1/(9368-2475))**5*(1-1/(9000-2475))**4,1e-12);
 near(s.xp,5*(145.5+13768.3)+4*(140+17335),1e-6);
 assert.equal(s.patches,9);assert.equal(s.growthHours,16);
 assert.ok(s.runsPerPet!>746&&s.runsPerPet!<748);
 // Lower level, rarer: base − 25 × level grows.
 assert.ok(farmingRunStats(defaultFarmingRun(99),80).runsPerPet!>s.runsPerPet!);
 assert.equal(farmingRunStats([],99).runsPerPet,null);
});

test('a saved Farming runs method counts runs with an example 6 runs/hour pace',()=>{
 const m=farmingRunsMethod(99);
 assert.equal(m.unit,'runs');assert.equal(m.kph,6);assert.equal(m.paceConfirmed,false);assert.equal(m.rateOverride,false);
 near(m.rate!,farmingRunStats(defaultFarmingRun(99),99).runsPerPet!);
 const p={...structuredClone(initial.pets.find(p=>p.name==='Tangleroot')!),methods:[{...m,kc:300}],plannedMethod:0};
 near(likelihood(p)!,1-(1-1/m.rate!)**300,1e-12);near(expectedHours(p)!,m.rate!/6);
});

test('saved runs validate crop names, whole patch counts and no duplicates',()=>{
 for(const run of [undefined,null,[{crop:'Magic',count:5}],defaultFarmingRun(99)])assert.equal(validFarmingRun(run),true);
 for(const run of [[],[{crop:'Redwood',count:1}],[{crop:'Magic',count:0}],[{crop:'Magic',count:21}],[{crop:'Magic',count:1.5}],[{crop:'Magic',count:1},{crop:'Magic',count:2}],'Magic',[null]])assert.equal(validFarmingRun(run),false);
 const p={...structuredClone(initial.pets.find(p=>p.name==='Tangleroot')!)};
 p.methods=[farmingRunsMethod(99)];p.plannedMethod=0;assert.equal(validatePet(p),true);
 p.methods=[{...farmingRunsMethod(99),farmingRun:[{crop:'Nope',count:1}]}];assert.equal(validatePet(p),false);
});

test('the Tree runs default is the old 6 magic + 6 palm run counted in Farming XP',()=>{
 const s=treeRunStats(99),m=treeRunsMethod(99),old=mixedFarmingMethod(99);
 near(s.xp,145046.4,1e-6);near(s.chance,1-(1-1/(9368-2475))**6*(1-1/(9000-2475))**6,1e-12);
 assert.equal(Math.round(s.runsPerPet),559);
 // Same numbers as the old preset: mean XP per pet and the 15-minute example pace.
 near(m.rate!,old.rate!,1e-3);assert.equal(m.kph,old.kph);assert.equal(m.kph,580186);
 assert.equal(m.unit,'XP');assert.equal(m.name,TREE_RUNS);assert.equal(m.rateOverride,false);assert.equal(isTreeRun(m),true);
 // XP chance is exact at whole runs: 1 − exp(−XP / mean XP) = 1 − miss^runs.
 near(-Math.expm1(-10*s.xp/m.rate!),1-(1-s.chance)**10,1e-12);
 assert.ok(treeRunStats(80).xpPerPet>s.xpPerPet);
 assert.equal(presetTreeRunRate(mixedFarmingMethod(87).rate),true);assert.equal(presetTreeRunRate(81_000_000),false);
});

test('new and old journals get Tree runs once, and it becomes the default over untouched catalogue methods',()=>{
 const j=journal(99),p=j.pets.find(p=>p.name==='Tangleroot')!;
 assert.equal(p.methods.filter(m=>m.name===TREE_RUNS).length,1);assert.equal(p.methods[p.plannedMethod!].name,TREE_RUNS);
 assert.equal(p.methods.some(m=>m.name==='Farming runs'),false);
 const before=p.methods.length;normalizeRates(j);normalizeRates(j);assert.equal(p.methods.length,before);
 // The rate follows the level unless the player overrode it.
 const at=p.methods.findIndex(m=>m.name===TREE_RUNS);
 j.hiscores.skills=[{name:'Farming',level:85,xp:3_300_000,rank:1}];normalizeRates(j);
 near(p.methods[at].rate!,treeRunStats(85).xpPerPet);
 p.methods[at]={...p.methods[at],rate:1234,rateOverride:true};normalizeRates(j);assert.equal(p.methods[at].rate,1234);
 // Hiscores Farming XP is offered as the count.
 assert.deepEqual(hiscoresCount(p,j,p.methods[at]),{value:3_300_000,label:'Farming XP'});
});

test('a planned method the player used keeps its place',()=>{
 const j=journal(99),p=j.pets.find(p=>p.name==='Tangleroot')!;
 p.methods=p.methods.filter(m=>m.name!==TREE_RUNS);p.methods[2]={...p.methods[2],kc:40};p.plannedMethod=2;
 normalizeRates(j);assert.equal(p.plannedMethod,2);assert.ok(p.methods.some(m=>m.name===TREE_RUNS));
});

test('the old XP preset becomes Tree runs with its count and acquisition record; its hunt history folds into it',()=>{
 for(const name of ['Farming runs',LEGACY_MIXED_RUN]){
  const j=journal(99),p=j.pets.find(p=>p.name==='Tangleroot')!;
  Object.assign(p,{obtained:true,obtainedCount:7942614,obtainedUnit:'XP',obtainedMethod:name,plannedMethod:0,methods:[{...mixedFarmingMethod(99),name,farmingRunsPerDay:.5}],
   huntHistory:[{method:name,unit:'XP',count:7942614,pace:580186,rate:mixedFarmingMethod(99).rate}]});
  const chance=likelihood({...p,huntHistory:undefined})!;
  normalizeRates(j);
  assert.equal(p.methods.length,1);assert.equal(p.methods[0].name,TREE_RUNS);assert.equal(p.methods[0].unit,'XP');assert.equal(p.methods[0].farmingRunsPerDay,.5);
  assert.equal(p.methods[0].rateOverride,false);
  assert.equal(p.obtainedMethod,TREE_RUNS);assert.equal(receivedMethod(p),p.methods[0]);assert.equal(p.huntHistory,undefined);
  near(likelihood(p)!,chance,1e-9);
  assert.equal(p.plannedMethod,0);
 }
 // A rate the player typed stays theirs.
 const j=journal(99),p=j.pets.find(p=>p.name==='Tangleroot')!;
 p.methods=[{...mixedFarmingMethod(99),name:'Farming runs',rate:50_000_000}];p.plannedMethod=0;normalizeRates(j);
 assert.equal(p.methods[0].name,TREE_RUNS);assert.equal(p.methods[0].rate,50_000_000);assert.equal(p.methods[0].rateOverride,true);
});

test('the briefly default Farming runs (runs) is dropped while untouched and kept once used',()=>{
 const j=journal(99),p=j.pets.find(p=>p.name==='Tangleroot')!;
 p.methods=[...p.methods.filter(m=>m.name!==TREE_RUNS),farmingRunsMethod(90)];p.plannedMethod=p.methods.length-1;
 normalizeRates(j);
 assert.equal(p.methods.some(m=>m.name==='Farming runs'),false);assert.equal(p.methods[p.plannedMethod!].name,TREE_RUNS);
 const k=journal(99),q=k.pets.find(p=>p.name==='Tangleroot')!;
 const used={...farmingRunsMethod(99,[{crop:'Palm',count:6},{crop:'Yew',count:5}]),kc:120};
 q.methods=[...q.methods.filter(m=>m.name!==TREE_RUNS),used];q.plannedMethod=q.methods.length-1;
 normalizeRates(k);
 const kept=q.methods.find(m=>m.name==='Farming runs')!;
 assert.equal(kept.kc,120);assert.deepEqual(kept.farmingRun,[{crop:'Palm',count:6},{crop:'Yew',count:5}]);
 assert.equal(q.methods[q.plannedMethod!],kept);assert.ok(q.methods.some(m=>m.name===TREE_RUNS));
 // Default trees but a received-from record: kept.
 const r=journal(99),t=r.pets.find(p=>p.name==='Tangleroot')!;
 t.methods=[...t.methods.filter(m=>m.name!==TREE_RUNS),farmingRunsMethod(99)];Object.assign(t,{obtained:true,obtainedMethod:'Farming runs',obtainedUnit:'runs',obtainedCount:300});
 normalizeRates(r);assert.ok(t.methods.some(m=>m.name==='Farming runs'));assert.equal(receivedMethod(t)?.name,'Farming runs');
});

test('saving keeps the trees on a saved run and drops anything else on it',()=>{
 const j=journal(99),p=structuredClone(j.pets.find(p=>p.name==='Tangleroot')!);
 p.methods=[...p.methods,{...farmingRunsMethod(99),kc:5,farmingRun:[{crop:'Palm',count:6,extra:'x'} as never]}];
 applyPetEdit(j,p);
 assert.deepEqual(j.pets.find(x=>x.id===p.id)!.methods.at(-1)!.farmingRun,[{crop:'Palm',count:6}]);
});
