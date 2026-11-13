import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import template from './log-template.json' with {type: 'json'};
import type {Journal,Method,Pet} from './model';
import {initial,validatePet} from './model';
import {BOOST_SKILL,CALCULATION_VERSION,ORION,boostedName,normalizeRates,upgradeEstimates} from './estimates';
import {petExpectedHours} from './pet-luck';
import {hiscoresCount} from './pet-record';
import {releaseDate} from './release-dates';
import {domRunsPerPet,nightmareKillsPerPet,raidFact,raidRate,validRaid} from './raid-rates';

const close=(a:number|null|undefined,b:number,eps=1e-6)=>assert.ok(a!=null&&Math.abs(a-b)<=eps,`${a} ≈ ${b}`);
const pet=(j:Journal,name:string)=>j.pets.find(p=>p.name===name)!;
const method=(p:Pet,name:string)=>p.methods.find(m=>m.name===name)!;
const withSkill=(name:string,xp:number,level=99)=>{const j=structuredClone(initial);j.hiscores={skills:[{name,level,xp,rank:1}],activities:[]};return normalizeRates(j);};
const combined=(...rates:number[])=>1/(1-rates.reduce((miss,r)=>miss*(1-1/r),1));

test('Orion: the 72nd pet, a flat 1/750 a Fractured Archive completion',()=>{
 assert.equal(initial.pets.length,72);
 const at=initial.pets.findIndex(p=>p.name==='Orion'),orion=initial.pets[at];
 assert.deepEqual([orion.id,orion.category,initial.pets[at-1].name],['34646','Raids',"Tumeken's guardian"]);
 assert.deepEqual(orion.methods.map(m=>[m.name,m.rate,m.unit,m.activity,m.kph,m.rateConfirmed]),[['The Fractured Archive',750,'raids','The Fractured Archive',3,true]]);
 assert.equal(ORION,750);
 close(petExpectedHours(orion,initial),250);
 assert.ok(validatePet(orion));
 // The count fills from the hiscores when they list the raid.
 const synced=structuredClone(initial);synced.hiscores.activities=[{name:'The Fractured Archive',score:42,rank:1}];
 assert.equal(hiscoresCount(orion,synced,orion.methods[0])?.value,42);
 assert.equal(releaseDate('Orion','pets'),'2026-10-20');
 assert.ok(existsSync('public/pets/34646.png'));
});

test('the collection-log template has The Fractured Archive page and Orion on All Pets',()=>{
 const raids=template.tabs.find(t=>t.name==='Raids')!,tfa=raids.pages.find(p=>p.name==='The Fractured Archive')!;
 assert.deepEqual(raids.pages.map(p=>p.name),['Chambers of Xeric','The Fractured Archive','Theatre of Blood','Tombs of Amascut']);
 assert.equal(tfa.total,17);assert.equal(tfa.items.length,17);assert.equal(tfa.items[0].id,34646);
 const pets=template.tabs.flatMap(t=>t.pages).find(p=>p.name==='All Pets')!;
 assert.equal(pets.items.length,72);assert.equal(pets.total,72);
 assert.deepEqual(pets.items.slice(-2).map(i=>i.name),['Aggy','Orion']);
 // Every catalogue pet is on All Pets, and the totals still add up.
 assert.deepEqual(new Set(pets.items.map(i=>String(i.id))),new Set(initial.pets.map(p=>p.id)));
 for(const t of template.tabs)assert.equal(t.total,t.pages.reduce((n,p)=>n+p.total,0),t.name);
 assert.equal(template.total,1734);
 assert.equal(new Set(template.tabs.flatMap(t=>t.pages.flatMap(p=>p.items.map(i=>i.id)))).size,1734);
 for(const item of tfa.items)assert.ok(existsSync(`public/items/${item.id}.png`),item.name);
});

test('200M XP: every boosted pet has one method at 1/15 of its fastest, counted only at 200 million XP',()=>{
 assert.equal(BOOST_SKILL.Herbi,undefined);
 assert.deepEqual([BOOST_SKILL.Phoenix,BOOST_SKILL['Mr McGroot'],BOOST_SKILL.Quetzin,BOOST_SKILL.Beaver],['Firemaking','Hunter','Hunter','Woodcutting']);
 for(const [name,skill] of Object.entries(BOOST_SKILL)){
  const p=pet(initial,name),boosted=p.methods.filter(m=>m.xp200m);
  assert.equal(boosted.length,1,name);
  if(name==='Phoenix')continue;
  const base=method(p,boosted[0].name.slice(boostedName(skill,'').length));
  assert.equal(boosted[0].name,boostedName(skill,base.name));
  close(boosted[0].rate,base.rate!/15);assert.equal(boosted[0].kph,base.kph);assert.equal(boosted[0].unit,base.unit);
  // Not counted without hiscores, nor below 200M; at 200M the expected hours are a fifteenth.
  const before=petExpectedHours(p,initial)!;
  close(before,base.rate!/base.kph!);
  const below=withSkill(skill,199_999_999),at200=withSkill(skill,200_000_000);
  close(petExpectedHours(pet(below,name),below),before);
  close(petExpectedHours(pet(at200,name),at200),before/15);
  // Lifetime XP is never offered as the boosted method's count.
  assert.equal(hiscoresCount(pet(at200,name),at200,boosted[0]),null);
 }
 assert.equal(pet(initial,'Herbi').methods.some(m=>m.xp200m),false);
 // Mr McGroot at 200M Hunter: about 1/2,501, the Wiki's figure; below 99 the base moves and the boosted method with it.
 close(method(pet(initial,'Mr McGroot'),boostedName('Hunter','Goat hunting')).rate,37525/15);
 const low=withSkill('Hunter',13_034_431,70);
 close(method(pet(low,'Mr McGroot'),boostedName('Hunter','Goat hunting')).rate,(40000-25*70)/15);
 // A rate the player typed on the boosted method stays.
 const j=structuredClone(initial),m=method(pet(j,'Beaver'),boostedName('Woodcutting','Teak (1.5t)'));
 Object.assign(m,{rate:1_000_000,rateOverride:true});normalizeRates(j);
 assert.equal(m.rate,1_000_000);
});

test('Tangleroot: expected hours use the palm tree, not trees with only a few patches',()=>{
 const t=pet(initial,'Tangleroot');
 close(petExpectedHours(t,initial),(9000-25*99)/80);
 // A pace the player set on a few-patch tree counts.
 const j=structuredClone(initial),spirit=method(pet(j,'Tangleroot'),'Spirit tree');
 spirit.paceConfirmed=true;
 close(petExpectedHours(pet(j,'Tangleroot'),j),(5000-25*99)/80);
 spirit.kph=10;
 close(petExpectedHours(pet(j,'Tangleroot'),j),(9000-25*99)/80);
 assert.equal(method(t,boostedName('Farming','Palm tree')).xp200m,true);
});

test('Little Nightmare: 1/800 times the team size, 1/4,000 from five; Phosani solo 1/1,400',()=>{
 assert.deepEqual([1,2,3,4,5,8].map(nightmareKillsPerPet),[800,1600,2400,3200,4000,4000]);
 assert.equal(nightmareKillsPerPet(0),null);
 const ln=pet(initial,'Little Nightmare'),nm=method(ln,'The Nightmare'),phosani=method(ln,"Phosani's Nightmare");
 assert.deepEqual([nm.rate,nm.raid,nm.activity],[800,{kind:'nightmare',team:1},'Nightmare']);
 assert.deepEqual([phosani.rate,phosani.raid],[1400,undefined]);
 const j=structuredClone(initial),m=()=>method(pet(j,'Little Nightmare'),'The Nightmare');
 m().raid={kind:'nightmare',team:3};normalizeRates(j);
 assert.equal(m().rate,2400);
 assert.equal(raidFact(m().raid!),'Team of 3: 1/800 × 3');
 Object.assign(m(),{rate:1000,rateOverride:true,raid:{kind:'nightmare',team:5}});normalizeRates(j);
 assert.equal(m().rate,1000);
 assert.ok(validatePet(pet(j,'Little Nightmare')));
});

test('Dom: delve runs roll at every delve from 6, with the Wiki rate for each',()=>{
 assert.equal(domRunsPerPet(5),null);
 close(domRunsPerPet(6),1000);
 // The Wiki's cumulative column: ~1/429 to delve 7, ~1/231 to 8, ~1/120 to 9.
 assert.equal(Math.round(domRunsPerPet(7)!),429);assert.equal(Math.round(domRunsPerPet(8)!),231);assert.equal(Math.round(domRunsPerPet(9)!),120);
 close(domRunsPerPet(10),combined(1000,750,500,250,250));
 const dom=pet(initial,'Dom'),runs=method(dom,'Delve runs');
 assert.equal(dom.methods[dom.plannedMethod??0],runs);
 assert.deepEqual([runs.unit,runs.kph,runs.raid,runs.activity],['runs',6,{kind:'dom',delve:8},null]);
 close(runs.rate,combined(1000,750,500));
 close(petExpectedHours(dom,initial),250/32);
 // Shallower than 6 leaves no rate; deeper follows.
 const j=structuredClone(initial),m=()=>method(pet(j,'Dom'),'Delve runs');
 m().raid={kind:'dom',delve:5};normalizeRates(j);assert.equal(m().rate,null);
 m().raid={kind:'dom',delve:12};normalizeRates(j);close(m().rate,raidRate({kind:'dom',delve:12})!);
 assert.ok(validRaid({kind:'dom',delve:8})&&validRaid({kind:'nightmare',team:5}));
 for(const bad of [{kind:'dom',delve:0},{kind:'dom',delve:8.5},{kind:'nightmare',team:0},{kind:'nightmare',team:2,points:1},{kind:'dom'}])assert.equal(validRaid(bad),false);
});

test('awakened DT2 kills and Yami contracts',()=>{
 for(const [name,boss,rate] of [['Baron','Duke Sucellus',2500],['Butch','Vardorvis',3000],["Lil'viathan",'The Leviathan',2500],['Wisp','The Whisperer',2000]] as const){
  const p=pet(initial,name),normal=method(p,boss),awakened=method(p,`Awakened ${boss}`);
  assert.deepEqual([normal.rate,awakened.rate,awakened.unit,awakened.activity],[rate,rate,'kills',null],name);
 }
 const contract=method(pet(initial,'Yami'),'Yami (Contract)');
 assert.deepEqual([contract.rate,contract.unit,contract.activity],[100,'contracts',null]);
});

test('small fixes: Heron dark crabs follow the Wiki row, Chompy chick names its diary',()=>{
 const crabs=method(pet(initial,'Heron'),'Dark crabs');
 close(crabs.rate,(149434-25*99)*130);assert.equal(crabs.rateConfirmed,true);
 assert.match(method(pet(initial,'Chompy chick'),'Chompy').source,/elite Western Provinces Diary/);
});

/** A journal as version 5 saved it: no Orion, no 200M or delve-run or awakened methods, Nightmare without a team size,
 * Yami contracts in kills. */
function savedV5():Journal{
 const j=structuredClone(initial);
 j.calculationVersion=5;
 j.pets=j.pets.filter(p=>p.name!=='Orion');
 for(const p of j.pets){
  p.methods=p.methods.filter(m=>!(m.xp200m&&m.name!=='200 million Firemaking')&&m.name!=='Delve runs'&&!m.name.startsWith('Awakened '));
  for(const m of p.methods)if(m.raid?.kind==='nightmare')delete m.raid;
  if(p.name==='Dom')p.plannedMethod=0;
 }
 const contract=method(pet(j,'Yami'),'Yami (Contract)');Object.assign(contract,{unit:'kills',kc:30});
 Object.assign(pet(j,'Yami'),{obtained:true,obtainedMethod:'Yami (Contract)',obtainedUnit:'kills',obtainedCount:12});
 return j;
}

test('version 6 reaches saved journals without overwriting what the player set',()=>{
 const v5=savedV5();
 // One player typed their own Nightmare rate; another measured their Orion-free Dom kill pace.
 const nm=method(pet(v5,'Little Nightmare'),'The Nightmare');Object.assign(nm,{rate:2000,rateOverride:true,kc:150});
 const lnPhosani=method(pet(v5,'Little Nightmare'),"Phosani's Nightmare");Object.assign(lnPhosani,{kph:12,paceConfirmed:true});
 const domKills=method(pet(v5,'Dom'),'Doom of Mokhaiotl');Object.assign(domKills,{kc:300});
 const beaverTeak=method(pet(v5,'Beaver'),'Teak (1.5t)');Object.assign(beaverTeak,{kc:9_000_000});
 const up=upgradeEstimates(v5);
 assert.equal(up.calculationVersion,CALCULATION_VERSION);assert.equal(CALCULATION_VERSION,6);
 // Orion joins after Tumeken's guardian.
 const at=up.pets.findIndex(p=>p.name==='Orion');
 assert.equal(up.pets[at-1].name,"Tumeken's guardian");assert.equal(up.pets.length,72);
 assert.deepEqual(up.pets[at].methods.map(m=>[m.name,m.rate,m.kph]),[['The Fractured Archive',750,3]]);
 // The typed Nightmare rate and count stay, with no team size forced on it; Phosani's pace stays theirs.
 const nmAfter=method(pet(up,'Little Nightmare'),'The Nightmare');
 assert.deepEqual([nmAfter.rate,nmAfter.kc,nmAfter.raid],[2000,150,undefined]);
 assert.equal(method(pet(up,'Little Nightmare'),"Phosani's Nightmare").kph,12);
 // Dom: the counted kill method stays selected; delve runs are added beside it.
 const dom=pet(up,'Dom');
 assert.equal(dom.methods[dom.plannedMethod??0].name,'Doom of Mokhaiotl');assert.equal(method(dom,'Doom of Mokhaiotl').kc,300);
 assert.ok(method(dom,'Delve runs'));
 // Yami's contract count and obtained record keep their numbers, now in contracts.
 const yami=pet(up,'Yami');
 assert.deepEqual([method(yami,'Yami (Contract)').unit,method(yami,'Yami (Contract)').kc,yami.obtainedUnit,yami.obtainedCount],['contracts',30,'contracts',12]);
 // New methods: 200M, awakened. Existing counts untouched.
 assert.ok(method(pet(up,'Beaver'),boostedName('Woodcutting','Teak (1.5t)')).xp200m);
 assert.equal(method(pet(up,'Beaver'),'Teak (1.5t)').kc,9_000_000);
 assert.ok(method(pet(up,'Wisp'),'Awakened The Whisperer'));
 // An untouched Nightmare method gets the team-size input.
 const plain=upgradeEstimates(savedV5());
 assert.deepEqual(method(pet(plain,'Little Nightmare'),'The Nightmare').raid,{kind:'nightmare',team:1});
 assert.equal(pet(plain,'Dom').methods[pet(plain,'Dom').plannedMethod??0].name,'Delve runs');
 for(const p of up.pets)assert.ok(validatePet(p),p.name);
 // Once is enough.
 const again=upgradeEstimates(structuredClone(up));
 assert.deepEqual(again.pets.map(p=>[p.name,p.methods.map((m:Method)=>m.name)]),up.pets.map(p=>[p.name,p.methods.map((m:Method)=>m.name)]));
});
