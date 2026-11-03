import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Journal,Method,Pet} from './model';
import {luckRanking,petEfficientHours,petExpectedHours,petLuck,petSummary} from './pet-luck';

const method=(o:Partial<Method>):Method=>({name:'Boss',kc:null,rate:null,kph:null,activity:null,unit:'kills',source:'test',...o});
const pet=(o:Partial<Pet>):Pet=>({id:'x',name:'Test pet',category:'Bossing',obtained:false,methods:[],notes:'',priority:false,date:'',source:'',sourceRow:'',...o});
const close=(a:number|null,b:number)=>assert.ok(a!==null&&Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);

test('a single-method pet matches the sheet: EH = rate ÷ pace, hours = kc ÷ pace',()=>{
 const p=pet({methods:[method({rate:300,kph:100,kc:150})]});
 close(petExpectedHours(p),3);close(petEfficientHours(p),1.5);
 assert.equal(petLuck(p).luck,-1.5);
});

test('slow methods count as efficient hours of the fastest method',()=>{
 // Fast: 1/1000 at 100/h (10 h). Slow: 1/1000 at 50/h (20 h). 1,000 slow kills = 20 real hours = 10 efficient hours.
 const p=pet({methods:[method({name:'Fast',rate:1000,kph:100}),method({name:'Slow',rate:1000,kph:50,kc:1000})]});
 close(petExpectedHours(p),10);close(petEfficientHours(p),10);
});

test('an obtained pet is lucky by its expected hours minus the time it took',()=>{
 const p=pet({obtained:true,obtainedMethod:'Boss',obtainedCount:100,methods:[method({rate:300,kph:100,kc:5000})]});
 close(petEfficientHours(p),1);close(petLuck(p).luck,2);
 assert.equal(petLuck(pet({obtained:true,methods:[method({rate:300,kph:100})]})).luck,null);
 // Without a count at the drop, the current count is used, as the sheet does.
 close(petLuck(pet({obtained:true,methods:[method({rate:300,kph:100,kc:600})]})).luck,-3);
});

test('the summary adds luck, hours and progress across the account',()=>{
 const j={pets:[
  pet({id:'a',obtained:true,obtainedMethod:'Boss',obtainedCount:600,methods:[method({rate:300,kph:100})]}),// EH 3, spent 6: −3
  pet({id:'b',methods:[method({rate:5000,kph:100,kc:1000})]}),// EH 50, spent 10: −10
  pet({id:'c',obtained:true,methods:[method({rate:1000,kph:100})]}),// EH 10, no count
 ]} as Journal;
 const s=petSummary(j);
 assert.equal(s.obtained,2);close(s.luck,-13);assert.equal(s.luckPets,2);assert.equal(s.missingCounts,1);
 close(s.totalHours,16);close(s.hoursGained,13);close(s.hoursLeft,50);close(s.progress,13/63);
 assert.deepEqual(luckRanking(j).map(r=>r.pet.id),['a']);
});
