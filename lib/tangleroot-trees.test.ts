import assert from 'node:assert/strict';
import test from 'node:test';
import {TANGLEROOT_TREES,TREE_SOURCE,treeFact,treeMethod,treeRate,treeRow} from './tangleroot-trees.ts';
import {TREE_RUNS} from './farming-runs.ts';
import {normalizeRates} from './estimates.ts';
import {hiscoresCount} from './pet-record.ts';
import {initial,expectedHours,likelihood,type Journal} from './model.ts';

function journal(level?:number):Journal{const j=structuredClone(initial);j.hiscores.skills=level?[{name:'Farming',level,xp:13_034_431,rank:1}]:[];return j;}
const tangleroot=(j:Journal)=>j.pets.find(p=>p.name==='Tangleroot')!;

test('per-tree rates, paces and hours match the PetCord sheet at 99',()=>{
 // Sheet: Drop Rate (99) and Hours Taken = rate ÷ rolls/hr.
 const sheet:Record<string,[number,number,number]>={'Palm tree':[6525,80,81.5625],'Magic tree':[6893,80,86.1625],'Teak tree':[2525,80,31.5625],'Spirit tree':[2525,80,31.5625],
  'Calquat tree':[3525,80,44.0625],'Cactus':[4525,60,75.41666666666667],'Mushroom':[5025,60,83.75],'Giant seaweed':[5025,60,83.75],'Belladonna':[5525,60,92.08333333333333],
  'Yew tree':[8767,80,109.5875],'Maple tree':[11577,80,144.7125],'Hespori':[4525,30,150.83333333333334],'Hespori seeds (no contracts)':[500,6.1,81.96721311475410]};
 for(const [name,[rate,pace,hours]] of Object.entries(sheet)){
  const m=treeMethod(treeRow(name)!,99);
  assert.equal(m.rate,rate,name);assert.equal(m.kph,pace,name);assert.ok(Math.abs(m.rate!/m.kph!-hours)<1e-9,name);
 }
 assert.equal(TANGLEROOT_TREES.length,21);
 assert.equal(treeRate(treeRow('Palm tree')!,70),9000-25*70);assert.equal(treeRate(treeRow('Hespori seeds (no contracts)')!,50),500);
 assert.equal(treeMethod(treeRow('Palm tree')!,99).unit,'trees');assert.equal(treeMethod(treeRow('Hespori')!,99).unit,'kills');
 assert.equal(treeFact({name:'Palm tree',unit:'trees'}),'10,510 XP per tree');assert.equal(treeFact({name:'Hespori seeds (no contracts)',unit:'seeds'}),null);
});

test('Tree runs stays the default; the spreadsheet rows become trees with the sheet pace and rate',()=>{
 const j=journal(99),p=tangleroot(j);
 assert.equal(p.methods[p.plannedMethod!].name,TREE_RUNS);
 assert.equal(p.methods.some(m=>m.unit==='plants'),false);
 const palm=p.methods.find(m=>m.name==='Palm tree')!;
 assert.equal(palm.unit,'trees');assert.equal(palm.rate,6525);assert.equal(palm.kph,80);assert.ok(palm.source.startsWith(TREE_SOURCE));
 // The old catalogue had rates and paces one row out of place (Redwood Tree at 1/500 and 6.1/hour).
 const redwood=p.methods.find(m=>m.name==='Redwood tree')!;assert.equal(redwood.rate,2525);assert.equal(redwood.kph,80);
 assert.ok(p.methods.some(m=>m.name==='Spirit tree')&&p.methods.some(m=>m.name==='Belladonna')&&p.methods.some(m=>m.name==='Hespori'));
 const before=JSON.stringify(p.methods);normalizeRates(j);assert.equal(JSON.stringify(p.methods),before);
 // Level changes follow, own rates stay.
 j.hiscores.skills=[{name:'Farming',level:80,xp:2_000_000,rank:1}];normalizeRates(j);
 assert.equal(p.methods.find(m=>m.name==='Palm tree')!.rate,7000);assert.equal(p.methods.find(m=>m.name==='Hespori seeds (no contracts)')!.rate,500);
 const at=p.methods.findIndex(m=>m.name==='Magic tree');p.methods[at]={...p.methods[at],rate:4000,rateOverride:true};normalizeRates(j);assert.equal(p.methods[at].rate,4000);
});

test('a used spreadsheet row keeps its count, own pace and the acquisition record',()=>{
 const j=structuredClone(initial),p=tangleroot(j);
 // As saved before: catalogue name, plants, misplaced pace edited by the player.
 p.methods=[...p.methods.filter(m=>m.name!=='Spirit tree'),{name:'Spirit seed',unit:'plants',kc:640,rate:null,kph:50,paceConfirmed:true,rateConfirmed:false,activity:null,source:'Spreadsheet level-99 estimate; verify method and level on Wiki'}];
 Object.assign(p,{obtained:true,obtainedMethod:'Spirit seed',obtainedUnit:'plants',obtainedCount:640,plannedMethod:p.methods.length-1,huntHistory:[{method:'Spirit seed',unit:'plants',count:640,pace:50,rate:2525}]});
 normalizeRates(j);
 const spirit=p.methods.find(m=>m.name==='Spirit tree')!;
 assert.equal(spirit.kc,640);assert.equal(spirit.kph,50);assert.equal(spirit.rate,2525);assert.equal(spirit.unit,'trees');
 assert.equal(p.obtainedMethod,'Spirit tree');assert.equal(p.obtainedUnit,'trees');assert.equal(p.huntHistory,undefined);assert.equal(p.obtainedCount,640);
 assert.equal(p.methods[p.plannedMethod!],spirit);
});

test('tree counts give the chance and hours like any other method; Hespori offers its KC',()=>{
 const j=journal(99),p=tangleroot(j);
 const palm=p.methods.findIndex(m=>m.name==='Palm tree');
 p.methods[palm]={...p.methods[palm],kc:1000};p.plannedMethod=palm;
 assert.ok(Math.abs(likelihood({...p,methods:[p.methods[palm]],plannedMethod:0})!-(1-(1-1/6525)**1000))<1e-12);
 assert.ok(Math.abs(expectedHours({...p,methods:[p.methods[palm]],plannedMethod:0})!-81.5625)<1e-9);
 j.hiscores.activities=[{name:'Hespori',score:212,rank:1}];
 assert.deepEqual(hiscoresCount(p,j,p.methods.find(m=>m.name==='Hespori')!),{value:212,label:'Hespori KC'});
});
