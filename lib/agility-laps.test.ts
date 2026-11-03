import assert from 'node:assert/strict';
import test from 'node:test';
import {lapMethod,lapUpgrade,lapsPerHour} from './agility-laps.ts';
import {normalizeRates} from './estimates.ts';
import {initial,likelihood,expectedHours,type Journal,type Method} from './model.ts';
import seed from './catalogue.json' with {type:'json'};
import {skillMethodChoice,methodsForSkill} from './pet-rates.ts';
import {hiscoresCount,unitShort} from './pet-record.ts';
import {wikiMethod} from './skill-rates.ts';

function journal(level=92):Journal{const j=structuredClone(initial);j.hiscores.skills=[{name:'Agility',level,xp:6_812_345,rank:1},{name:'Fishing',level:99,xp:14_250_310,rank:1}];j.hiscores.activities=[{name:'Vorkath',score:812,rank:1}];return normalizeRates(j);}

test('a course counts laps: 1/(base − 25 × level) per lap and the Wiki lap time as pace',()=>{
 const m=lapMethod('Ardougne Rooftop',92)!;
 assert.equal(m.unit,'laps');assert.equal(m.rate,34440-25*92);assert.equal(m.kph,lapsPerHour(45.6));assert.equal(m.kph,78.9);
 // Mean hunt matches the Wiki's "time to reach drop rate" at 99 (405 hours).
 assert.equal(Math.round(lapMethod('Ardougne Rooftop',99)!.rate!/(3600/45.6)),405);
 assert.equal(lapMethod('Not a course',99),null);
});

test('untouched spreadsheet XP courses become lap methods; anything the player used stays as saved',()=>{
 const j=journal(),p=j.pets.find(p=>p.name==='Giant Squirrel')!;
 const ard=p.methods.find(m=>m.name==='Ardougne Rooftop')!;
 assert.equal(ard.unit,'laps');assert.equal(ard.rate,34440-25*92);assert.equal(ard.paceConfirmed,false);
 assert.ok(p.methods.some(m=>m.name==="Seers' Village Rooftop (no teleport)"&&m.unit==='laps'&&m.rate===35205-25*92));
 assert.equal(wikiMethod('Giant Squirrel',"Seers' Village Rooftop (no teleport)")?.name,"Seers' Village Rooftop");
 // Hallowed Sepulchre and Brimhaven have no lap, so they keep counting XP.
 assert.equal(p.methods.find(m=>m.name==='Sepulchre')!.unit,'XP');assert.equal(p.methods.find(m=>m.name==='Brimhaven')!.unit,'XP');
 const old=seed.pets.find(p=>p.name==='Giant Squirrel')!.methods.find(m=>m.name==='Ardougne')! as Method;
 assert.equal(lapUpgrade(old,92,false).name,'Ardougne Rooftop');
 for(const kept of [{...old,kc:5_000_000},{...old,rateOverride:true},{...old,paceConfirmed:true}])assert.equal(lapUpgrade(kept,92,false),kept);
 assert.equal(lapUpgrade(old,92,true),old);
 const before=p.methods.map(m=>m.name);normalizeRates(j);assert.deepEqual(p.methods.map(m=>m.name),before);
});

test('a lap count drives chance and hours like any discrete roll',()=>{
 const j=journal(),p=j.pets.find(p=>p.name==='Giant Squirrel')!;
 const at=p.methods.findIndex(m=>m.name==='Ardougne Rooftop');p.plannedMethod=at;p.methods[at].kc=10000;
 const r=34440-25*92;
 assert.ok(Math.abs(likelihood(p)!-(1-(1-1/r)**10000))<1e-12);
 assert.ok(Math.abs(expectedHours(p)!-r/78.9)<1e-9);
});

test('added Wiki methods count laps for courses and XP where the Wiki gives XP per action',()=>{
 const course=methodsForSkill('Agility')!.methods.find(m=>m.name==='Ardougne Rooftop')!;
 assert.equal(skillMethodChoice('Agility',course,92).unit,'laps');
 const fish=methodsForSkill('Fishing')!.methods.find(m=>m.name==='Shrimps')!;
 const f=skillMethodChoice('Fishing',fish,99);assert.equal(f.unit,'XP');assert.equal(f.rate,(870330-2475)*10);
 const tree=methodsForSkill('Farming')!.methods.find(m=>m.name==='Magic tree')!;
 assert.deepEqual([skillMethodChoice('Farming',tree,99).unit,skillMethodChoice('Farming',tree,99).rate],['plants',9368-2475]);
});

test('hiscores offer the skill XP for XP methods and the KC for kill methods, and unit labels stay short',()=>{
 const j=journal(),heron=j.pets.find(p=>p.name==='Heron')!,vorki=j.pets.find(p=>p.name==='Vorki')!,sq=j.pets.find(p=>p.name==='Giant Squirrel')!;
 assert.deepEqual(hiscoresCount(heron,j,heron.methods[0]),{value:14_250_310,label:'Fishing XP'});
 assert.deepEqual(hiscoresCount(vorki,j,vorki.methods.find(m=>m.activity==='Vorkath')!),{value:812,label:'Vorkath KC'});
 assert.equal(hiscoresCount(sq,j,sq.methods.find(m=>m.unit==='laps')!),null);
 assert.equal(unitShort(heron,'pickpockets'),'picks');assert.equal(unitShort(heron,'laps'),'laps');
 assert.equal(unitShort(j.pets.find(p=>p.name==='Tiny tempor')!,'rolls'),'permits');
 assert.equal(unitShort(j.pets.find(p=>p.name==='Abyssal protector')!,'rewards'),'searches');
});
