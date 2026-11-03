import assert from 'node:assert/strict';
import test from 'node:test';
import {validFarmingSchedule} from './farming-timing.ts';
import {mixedFarmingMethod} from './estimates.ts';
import {initial,validatePet,expectedHours,likelihood} from './model.ts';

test('a saved runs-a-day value still loads and never changes odds or hours',()=>{
 const p={...structuredClone(initial.pets.find(p=>p.name==='Tangleroot')!),obtained:false,plannedMethod:0,methods:[{...mixedFarmingMethod(99),kc:7942614}]};
 const hours=expectedHours(p),chance=likelihood(p);
 p.methods[0]={...p.methods[0],farmingRunsPerDay:.5};
 assert.equal(expectedHours(p),hours);assert.equal(likelihood(p),chance);
});
test('saved schedule validation rejects invalid values',()=>{
 const m=mixedFarmingMethod(99),p={...structuredClone(initial.pets.find(p=>p.name==='Tangleroot')!),methods:[m],plannedMethod:0};
 for(const value of [0,-1,3.1,Infinity,NaN,'1']){
  assert.equal(validFarmingSchedule(value),false);
  assert.equal(validatePet({...p,methods:[{...m,farmingRunsPerDay:value as number}]}),false);
 }
 for(const value of [undefined,null,.01,.5,1,1.5,2,3])assert.equal(validatePet({...p,methods:[{...m,farmingRunsPerDay:value}]}),true);
});
