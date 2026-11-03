import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initial,mergeLog,type CollectionLog,type Journal} from './model';

const log=(ids:number[]):CollectionLog=>({obtained:ids.length,total:ids.length,tabs:[{name:'Bosses',pages:[{name:'Test',obtained:ids.length,total:ids.length,items:ids.map(id=>({id,name:String(id),quantity:1}))}]}]});
const journal=()=>{const j=structuredClone(initial) as Journal;j.username='tester';return j;};

test('a first log sync marks pets owned without guessing when they were obtained',()=>{
 const j=journal(),vorki=j.pets.find(p=>p.name==='Vorki')!;vorki.methods[0].kc=900;
 const p=mergeLog(j,log([Number(vorki.id)])).pets.find(x=>x.name==='Vorki')!;
 assert.equal(p.obtained,true);assert.equal(p.date,'');assert.equal(p.obtainedCount??null,null);
});

test('a pet that turns up on a later sync gets an approximate date and count',()=>{
 const j=journal();j.logSyncedAt='2026-10-01T00:00:00.000Z';
 const vorki=j.pets.find(p=>p.name==='Vorki')!;vorki.methods[0].kc=900;
 const heron=j.pets.find(p=>p.name==='Heron')!;j.hiscores.skills=[{name:'Fishing',level:99,xp:30_000_000,rank:1}];
 const out=mergeLog(j,log([Number(vorki.id),Number(heron.id)]));
 const v=out.pets.find(x=>x.name==='Vorki')!,h=out.pets.find(x=>x.name==='Heron')!;
 assert.equal(v.date,new Date().toISOString().slice(0,10));
 assert.deepEqual([v.obtainedMethod,v.obtainedUnit,v.obtainedCount,v.obtainedApproximate],['Vorkath','kills',900,true]);
 assert.deepEqual([h.obtainedUnit,h.obtainedCount,h.obtainedApproximate],['XP',30_000_000,true]);
 // Pets already owned, or with a count the player entered, are left alone.
 const again=mergeLog(out,log([Number(vorki.id)])).pets.find(x=>x.name==='Vorki')!;assert.equal(again.obtainedCount,900);
});
