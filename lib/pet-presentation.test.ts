import test from 'node:test';
import assert from 'node:assert/strict';

import {initial} from './model.ts';
import {collectedDate,companionDescription,petHoverLines,shortMethod,shortXp} from './pet-presentation.ts';
test('companion hover distinguishes acquisition rewards and current completions without unrelated skill XP',()=>{
 const j=structuredClone(initial),p=j.pets.find(p=>p.name==='Tiny tempor')!;
 p.obtained=true;p.obtainedCount=1024;p.obtainedUnit='rolls';p.obtainedMethod='Reward pool';
 p.methods=[{name:'Tempoross rewards',unit:'rolls',kc:2345,activity:null,rate:8000,kph:100,source:'Recorded'}];
 j.hiscores.skills=[{name:'Fishing',level:99,xp:14000000,rank:1}];
 j.hiscores.activities=[{name:'Tempoross',score:400,rank:1}];
 const tip=companionDescription(j,p.id,p.name);
 for(const text of ['Obtained at 1,024 permits · Reward pool','Current: 2,345 permits'])assert.ok(tip.includes(text),text);
 assert.ok(!tip.includes('Fishing'));
 assert.equal(companionDescription({...j,restricted:true},p.id,p.name),p.name);
 delete p.obtainedCount;assert.ok(companionDescription(j,p.id,p.name).split('\n').includes('Obtained'));
});
test('skill pets and boss pets retain distinct units and unknown counts stay unknown',()=>{
 const j=structuredClone(initial),skill=j.pets.find(p=>p.name==='Beaver')!,boss=j.pets.find(p=>p.name==='Baby Mole')!;
 skill.obtained=true;skill.obtainedCount=8500000;skill.obtainedUnit='XP';
 j.hiscores.skills=[{name:'Woodcutting',level:99,xp:13034431,rank:2}];
 assert.ok(companionDescription(j,skill.id,skill.name).includes('Obtained at 8.5M XP'));
 boss.obtained=true;boss.obtainedCount=125;boss.obtainedUnit='kills';boss.methods=[{name:'Giant Mole',unit:'kills',activity:'Giant Mole',kc:400,rate:3000,kph:50,source:'Wiki'}];
 j.hiscores.activities=[{name:'Giant Mole',score:500,rank:2}];
 const tip=companionDescription(j,boss.id,boss.name);assert.ok(tip.includes('Obtained at 125 kills\n'));assert.ok(tip.includes('Current: 500 Giant Mole'));assert.ok(!tip.includes('400'));
});

test('reward pets omit lifetime skill XP while true skilling pets retain it',()=>{
 const j=structuredClone(initial);
 j.hiscores.skills=[{name:'Fishing',level:99,xp:14000000,rank:1},{name:'Runecraft',level:99,xp:14000000,rank:1},{name:'Firemaking',level:99,xp:14000000,rank:1},{name:'Woodcutting',level:99,xp:14000000,rank:1}];
 for(const name of ['Tiny tempor','Abyssal protector','Phoenix']){
  const p=j.pets.find(p=>p.name===name)!;
  assert.ok(!companionDescription(j,p.id,p.name).includes(' XP'),name);
 }
 const beaver=j.pets.find(p=>p.name==='Beaver')!;
 assert.ok(companionDescription(j,beaver.id,beaver.name).includes('Current: 14M Woodcutting XP'));
});

test('pet collection dates retain their recorded day and never appear on private hovers',()=>{
 const j=structuredClone(initial),p=j.pets.find(p=>p.name==='Tiny tempor')!;p.obtained=true;p.date='2025-08-22';
 assert.equal(collectedDate(p.date),'22/08/2025');
 assert.ok(companionDescription(j,p.id,p.name).includes('Collected: 22/08/2025'));
 assert.equal(companionDescription({...j,restricted:true},p.id,p.name),p.name);
});

test('pet hovers keep each record to one compact line',()=>{
 const j=structuredClone(initial);
 j.hiscores.skills=[{name:'Agility',level:99,xp:13_400_000,rank:1}];
 j.hiscores.activities=[{name:'Theatre of Blood',score:0,rank:-1},{name:'Theatre of Blood: Hard Mode',score:0,rank:-1},{name:'Tempoross',score:1132,rank:1},{name:'Hespori',score:123,rank:1}];
 const zik=j.pets.find(p=>p.name==="Lil' Zik")!;for(const m of zik.methods)m.kc=0;
 assert.deepEqual(petHoverLines(j,zik),{obtained:null,current:'Current: 0 ToB · 0 Hard'});
 const tempor=j.pets.find(p=>p.name==='Tiny tempor')!;Object.assign(tempor,{obtained:true,obtainedCount:4503,obtainedUnit:'rolls',obtainedMethod:'Permits'});
 tempor.methods[0].kc=4800;
 assert.deepEqual(petHoverLines(j,tempor),{obtained:'Obtained at 4,503 permits',current:'Current: 4,800 permits'});
 Object.assign(tempor,{obtainedUnit:'completions',obtainedCount:600,obtainedMethod:'Tempoross'});
 assert.deepEqual(petHoverLines(j,tempor),{obtained:'Obtained at 600 completions',current:'Current: 1,132 Tempoross'});
 const squirrel=j.pets.find(p=>p.name==='Giant Squirrel')!;Object.assign(squirrel,{obtained:true,obtainedCount:13_234_567,obtainedUnit:'XP',obtainedMethod:'Ardougne Rooftop'});
 assert.deepEqual(petHoverLines(j,squirrel),{obtained:'Obtained at 13.2M XP · Ardougne',current:'Current: 13.4M Agility XP'});
 const mole=j.pets.find(p=>p.name==='Baby Mole')!;Object.assign(mole,{obtained:true,obtainedCount:412,obtainedUnit:'kills',obtainedMethod:'Giant Mole'});
 assert.equal(petHoverLines(j,mole).obtained,'Obtained at 412 kills');
 Object.assign(zik,{obtained:true,obtainedCount:40,obtainedUnit:'raids',obtainedMethod:"Lil' zik (Hard Mode)"});
 assert.equal(petHoverLines(j,zik).current,'Current: 0 ToB Hard');
 Object.assign(zik,{obtainedMethod:'Theatre of Blood'});
 assert.equal(petHoverLines(j,zik).current,'Current: 0 ToB · 0 Hard');
 const cub=j.pets.find(p=>p.name==='Callisto cub')!;Object.assign(cub,{obtained:true,obtainedCount:120,obtainedUnit:'attempts',obtainedMethod:'Callisto cub (Artio)',obtainedApproximate:true});
 assert.equal(petHoverLines(j,cub).obtained,'Obtained at ~120 attempts · Artio');
 j.hiscores.activities.push({name:'Callisto',score:300,rank:1},{name:'Artio',score:150,rank:1});
 assert.equal(petHoverLines(j,cub).current,'Current: 150 Artio');
 Object.assign(cub,{obtainedUnit:'kills',obtainedMethod:'Callisto',obtainedApproximate:false});
 assert.equal(petHoverLines(j,cub).current,'Current: 300 Callisto');
 // By unit, for the plugin: the unit instead of the boss or activity; XP keeps its skill.
 assert.equal(petHoverLines(j,cub,true).current,'Current: 300 kills');
 assert.equal(petHoverLines(j,squirrel,true).current,'Current: 13.4M Agility XP');
 Object.assign(tempor,{obtainedUnit:'completions',obtainedCount:600,obtainedMethod:'Tempoross'});
 assert.equal(petHoverLines(j,tempor,true).current,'Current: 1,132 Tempoross');
 Object.assign(squirrel,{obtainedUnit:'level',obtainedCount:85});
 assert.deepEqual(petHoverLines(j,squirrel),{obtained:'Obtained at level 85 · Ardougne',current:'Current: level 99 Agility'});
 for(const [method,short] of [['Ardougne Rooftop','Ardougne'],["Seers' Village Rooftop (no teleport)","Seers'"],['Shark (2t w/ Shark Lures)','Shark'],['Tree runs','Tree runs'],['Palm tree','Palm tree'],['Draynor Village Rooftop','Draynor']])assert.equal(shortMethod(method),short);
 assert.equal(shortMethod("Lil' zik (Hard Mode)","Lil' Zik"),'Hard Mode');
 assert.deepEqual([shortXp(13_249_999),shortXp(850_400),shortXp(9_500),shortXp(200_000_000)],['13.2M','850K','9,500','200M']);
});
