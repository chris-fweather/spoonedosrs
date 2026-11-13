import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Journal,Method,Pet} from './model';
import {initial,likelihood} from './model';
import {CALCULATION_VERSION,normalizeRates,oddsMethod,upgradeEstimates} from './estimates';
import {petProgress,petRateLines} from './pet-rates';
import {petChartRecord} from './odds-chart';
import {toaRaidsPerPet} from './raid-rates';

const TOA="Tumeken's guardian";
const pet=(j:Journal,name:string)=>j.pets.find(p=>p.name===name)!;
const toaScores=[{name:'Tombs of Amascut',score:57,rank:150000},{name:'Tombs of Amascut: Expert Mode',score:12,rank:90000},{name:'Chambers of Xeric',score:30,rank:200000}];
/** A journal saved at calculation version 4: before raid inputs (version 5) and Orion (version 6). */
function version4(toaMethods:Method[]):Journal{
 const j=structuredClone(initial);
 j.calculationVersion=4;
 j.hiscores={skills:[],activities:structuredClone(toaScores)};
 j.pets=j.pets.filter(p=>p.name!=='Orion');
 const toa=pet(j,TOA);toa.methods=toaMethods;toa.plannedMethod=0;
 const olmlet=pet(j,'Olmlet');olmlet.methods=olmlet.methods.filter(m=>m.unit==='uniques').map(m=>({...m,kph:null}));olmlet.plannedMethod=0;
 return j;
}
/** What the pet's pop-out needs to show pace, basis, method and the odds graph. */
function assertPanel(j:Journal,p:Pet,count:number){
 const m=oddsMethod(p)!;
 assert.ok(m,`${p.name} has a method`);
 assert.ok(m.rate&&m.kph,`${p.name} has a rate and a pace`);
 assert.equal(m.kc,count,`${p.name} count`);
 const chart=petChartRecord(p,j);
 assert.ok(chart.method?.rate,`${p.name} has an odds graph`);
 const lines=petRateLines(p,j).lines.map(l=>l.label);
 assert.ok(lines.includes('Mean hunt'),`${p.name}: ${lines.join(', ')}`);
 const progress=petProgress(p,j);
 assert.ok(progress.hours!=null&&progress.hours>0);
 assert.deepEqual(progress.count,{value:count,unit:'raids'});
}

test("Tumeken's guardian saved with no methods (before its catalogue rows) gets its raid methods and counts",()=>{
 const j=upgradeEstimates(version4([]));
 assert.equal(j.calculationVersion,CALCULATION_VERSION);
 const toa=pet(j,TOA);
 assert.deepEqual(toa.methods.map(m=>[m.name,m.kc,m.raid?.kind]),[['Tombs of Amascut',57,'toa'],['Tombs of Amascut: Expert Mode',12,'toa']]);
 assert.equal(toa.plannedMethod,0);
 assert.equal(toa.methods[0].rate,toaRaidsPerPet(20_000,150));
 assertPanel(j,toa,57);
 // The Expert Mode raids count towards the chance across methods too.
 assert.ok(likelihood(toa)!>-Math.expm1(57*Math.log1p(-1/toa.methods[0].rate!)));
 // The other raid pets show the same rows.
 assertPanel(j,pet(j,'Olmlet'),30);
 for(const name of ["Lil' Zik",'Orion'])assert.ok(oddsMethod(pet(j,name))?.kph&&petChartRecord(pet(j,name),j).method?.rate,name);
});

test("Tumeken's guardian saved with the old planning rates (1/371, 1/321) moves to the raid inputs",()=>{
 const planning=(name:string,rate:number,activity:string):Method=>({name,rate,kph:2.5,unit:'raids',activity,kc:null,rateConfirmed:false,paceConfirmed:false,source:'Planning rate'});
 const j=upgradeEstimates(version4([planning('Tombs of Amascut',371,'Tombs of Amascut'),planning('Tombs of Amascut: Expert Mode',321,'Tombs of Amascut: Expert Mode')]));
 const toa=pet(j,TOA);
 assert.deepEqual(toa.methods.map(m=>[m.name,m.rate,m.raid?.kind,m.rateConfirmed]),[['Tombs of Amascut',toaRaidsPerPet(20_000,150),'toa',true],['Tombs of Amascut: Expert Mode',toaRaidsPerPet(20_000,400),'toa',true]]);
 // A planning method's count stays as saved (null until the next sync); the card reads it as 0.
 assert.deepEqual(petProgress(toa,j).count,{value:0,unit:'raids'});
});

test('a journal already at the current version with a method-less catalogue pet is repaired on load',()=>{
 const j=structuredClone(initial);j.hiscores={skills:[],activities:structuredClone(toaScores)};
 pet(j,TOA).methods=[];
 normalizeRates(j);
 assertPanel(j,pet(j,TOA),57);
});

test('pet cards: an uncollected pet with an hours estimate shows its count, 0 when it has none',()=>{
 const j=structuredClone(initial);
 for(const p of j.pets){
  const progress=petProgress(p,j);
  if(p.obtained||progress.hours==null)continue;
  assert.ok(progress.count,`${p.name} shows a count`);
 }
 const mcgroot=petProgress(pet(j,'Mr McGroot'),j);
 assert.deepEqual(mcgroot.count,{value:0,unit:'catches'});
 assert.deepEqual(petProgress(pet(j,'Orion'),j).count,{value:0,unit:'raids'});
 assert.deepEqual(petProgress(pet(j,'Soup'),j).count,{value:0,unit:'tasks'});
 // A skilling pet with lifetime XP and no XP on its method reads the lifetime XP, as its odds graph marks it.
 const xp=structuredClone(initial);xp.hiscores={skills:[{name:'Woodcutting',level:99,xp:13_034_431,rank:1}],activities:[]};
 normalizeRates(xp);
 const beaver=petProgress(pet(xp,'Beaver'),xp);
 assert.equal(beaver.byXp,true);
 assert.deepEqual(beaver.count,{value:13_034_431,unit:'XP'});
 assert.ok(beaver.chance!>0);
 // A recorded count is shown as it is.
 const synced=structuredClone(initial);synced.hiscores={skills:[],activities:[{name:'Mad Angel',score:14,rank:5}]};
 const aggy=pet(synced,'Aggy');aggy.methods[0].kc=14;
 assert.deepEqual(petProgress(aggy,synced).count,{value:14,unit:'kills'});
});
