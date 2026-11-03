import assert from 'node:assert/strict';
import test from 'node:test';
import {initial,likelihood,validatePet} from './model.ts';
import {acquisitionEffort,migrateHuntHistory,validHuntHistory} from './hunt-history.ts';
import {effortTime,normalizeRates,oddsMethod} from './estimates.ts';
import {petEfficientHours} from './pet-luck.ts';
import {syncJournal} from './sync-journal.ts';
import {journalForViewer,DEFAULT_DETAILS} from './profile-privacy.ts';
import {accountMode} from './account-mode.ts';
import {releaseDate,releaseOrder} from './release-dates.ts';
import {publicBoardMemo} from './public-board-cache.ts';
import {wearables} from './flair.ts';
import {headModel} from './appearance.ts';
import {displayedBadgeLabel} from './staff-appearance.ts';
import {chanceAfter} from './ui.ts';
const pet=()=>({...structuredClone(initial.pets[0]),obtained:true,obtainedCount:85,obtainedStartCount:10,obtainedUnit:'kills',obtainedMethod:'Test boss',methods:[{name:'Test boss',rate:75,kph:25,kc:2000,activity:'Test boss',unit:'kills',source:'Test'}]});
test('time to pet uses received count minus start, never a later live KC',()=>{
 const p=pet();assert.equal(acquisitionEffort(p).hours,3);assert.equal(oddsMethod(p)?.kc,75);assert.equal(effortTime(p),3);
 p.obtainedCount=null as any;assert.equal(effortTime(p),null);assert.equal(likelihood(p),null);
});
const near=(a:number|null,b:number|null)=>{assert.ok(a!==null&&b!==null&&Math.abs(a-b)<1e-12*Math.max(1,b),`${a} ≠ ${b}`);};
test('history on a pet not yet collected moves into Your methods with the same chance and time',()=>{
 const p={...pet(),obtained:false,obtainedCount:null,methods:[{...pet().methods[0],kc:null}],huntHistory:[{method:'A',unit:'kills',count:20,pace:10,rate:100},{method:'B',unit:'rolls',count:10,pace:5,rate:50},{method:'A',unit:'kills',count:30,pace:10,rate:100}]};
 const chance=1-(99/100)**50*(49/50)**10;
 migrateHuntHistory(p);
 assert.equal(p.huntHistory,undefined);
 assert.deepEqual(p.methods.slice(1).map(m=>[m.name,m.unit,m.kc,m.kph,m.rate,m.rateOverride,m.activity]),[['A','kills',50,10,100,true,null],['B','rolls',10,5,50,true,null]]);
 near(likelihood(p),chance);near(effortTime(p),7);
 const again=JSON.stringify(p);migrateHuntHistory(p);assert.equal(JSON.stringify(p),again);
});
test('a collected pet keeps its mixed history: the received method becomes the acquisition record, the rest count beside it',()=>{
 const p={...pet(),obtainedCount:null,obtainedStartCount:null,huntHistory:[{method:'Side boss',unit:'kills',count:10,pace:5,rate:50},{method:'Test boss',unit:'kills',count:75,pace:25,rate:75}]};
 const chance=1-(74/75)**75*(49/50)**10,hours=10/5+75/25;
 const j=structuredClone(initial);j.pets[0]=p;normalizeRates(j);
 assert.equal(p.huntHistory,undefined);assert.equal(p.obtainedCount,75);assert.equal(p.obtainedMethod,'Test boss');
 assert.equal(p.methods[0].kc,2000,'the live count is untouched');
 near(likelihood(p),chance);near(effortTime(p),hours);near(acquisitionEffort(p).hours,hours);
 // Running the load again changes nothing.
 const once=JSON.stringify(p);normalizeRates(j);assert.equal(JSON.stringify(p),once);
});
test('a saved acquisition record wins for the received method; a different historical rate becomes its own method',()=>{
 const p={...pet(),huntHistory:[{method:'Test boss',unit:'kills',count:75,pace:25,rate:75},{method:'Test boss',unit:'kills',count:40,pace:20,rate:150}]};
 migrateHuntHistory(p);
 assert.equal(p.obtainedCount,85);assert.equal(p.methods.length,2);
 assert.deepEqual([p.methods[1].name,p.methods[1].kc,p.methods[1].rate,p.methods[1].kph,p.methods[1].activity],['Test boss (earlier)',40,150,20,null]);
 near(likelihood(p),1-(74/75)**75*(149/150)**40);near(effortTime(p),75/25+40/20);
});
test('history pace replaces a default pace; a pace the player set stays and the segment gets its own method',()=>{
 const base=()=>({...pet(),obtained:false,obtainedCount:null,methods:[{...pet().methods[0],kc:null,activity:null}]});
 const p={...base(),huntHistory:[{method:'Test boss',unit:'kills',count:30,pace:15,rate:75}]};migrateHuntHistory(p);
 assert.equal(p.methods.length,1);assert.equal(p.methods[0].kc,30);assert.equal(p.methods[0].kph,15);assert.equal(p.methods[0].paceConfirmed,true);
 const q={...base(),huntHistory:[{method:'Test boss',unit:'kills',count:30,pace:15,rate:75}]};q.methods[0].paceConfirmed=true;migrateHuntHistory(q);
 assert.equal(q.methods.length,2);assert.equal(q.methods[0].kph,25);assert.equal(q.methods[1].kc,30);near(effortTime(q),2);
});
test('hours already spent replace count ÷ pace everywhere, collected or not',()=>{
 const p={...pet(),obtained:false,obtainedCount:null,recordedHours:20,huntHistory:[{method:'Test boss',unit:'kills',count:300,pace:30,rate:3000}]};
 assert.equal(effortTime(p),20);migrateHuntHistory(p);assert.equal(effortTime(p),20);assert.equal(acquisitionEffort(p).hours,20);
 near(petEfficientHours(p),20,);
 assert.equal(effortTime({...pet(),recordedHours:12}),12);
});
test('level records produce a range and do not invent exact time',()=>{
 const p={...pet(),obtainedCount:95,obtainedStartCount:0,obtainedUnit:'level',historicalXph:100000};
 const result=acquisitionEffort(p);assert.equal(result.hours,null);assert.ok(result.range&&result.range[1]>result.range[0]);assert.equal(likelihood(p),null);
});
test('old history still validates, rejecting fractional actions and invalid paces, preserving zero and fractional XP',()=>{
 const segment={method:'A',unit:'kills',count:0,pace:1,rate:1};assert.equal(validHuntHistory([segment]),true);
 for(const bad of [{...segment,count:.5},{...segment,pace:0},{...segment,rate:Infinity},{...segment,method:''}])assert.equal(validHuntHistory([bad]),false);
 assert.equal(validHuntHistory([{...segment,unit:'XP',count:.5}]),true);assert.equal(validatePet({...pet(),huntHistory:new Array(31).fill(segment)}),false);
 const zero={...pet(),obtained:false,huntHistory:[segment]};migrateHuntHistory(zero);assert.equal(zero.huntHistory,undefined);assert.equal(zero.methods.length,1);
});
test('current effort does not count lifetime XP or duplicate the same activity twice',()=>{
 const p={...pet(),obtained:false,historicalXph:100000};p.name='Beaver';p.methods=[];
 const j=structuredClone(initial);j.hiscores.skills=[{name:'Woodcutting',xp:200000000,level:99,rank:1}];assert.equal(effortTime(p,j),null);
 const boss={...pet(),obtained:false};boss.methods.push({...boss.methods[0],name:'Alternative mode',rate:150,kph:50});assert.equal(effortTime(boss),80);boss.plannedMethod=1;assert.equal(effortTime(boss),40);assert.ok(Math.abs(likelihood(boss)!-(1-(149/150)**2000))<1e-12);
});
test('sync moves old history into methods and records confirmed account mode',async()=>{
 const j=structuredClone(initial);j.username='History QA';const p=pet();Object.assign(j.pets[0],p,{huntHistory:[{method:'Side boss',unit:'kills',count:75,pace:25,rate:75}]});
 const result=await syncJournal('runeprofile',j,null,(async()=>Response.json({accountType:{key:'hardcore_ironman'},collectionLog:{obtained:0,total:0,tabs:[]}})) as typeof fetch);
 assert.equal(result.pets[0].huntHistory,undefined);assert.equal(result.pets[0].methods.find(m=>m.name==='Side boss')?.kc,75);assert.equal(result.pets[0].obtainedStartCount,10);assert.equal(result.accountMode,'hardcore_ironman');
 assert.equal(accountMode({key:'unknown'}),null);assert.equal(accountMode({id:3}),null);assert.equal(accountMode('Group Ironman'),'group_ironman');
});
test('hidden pet records remove history and starting counters from public responses',()=>{
 const j=structuredClone(initial);j.pets[0]={...pet(),huntHistory:[{method:'A',unit:'kills',count:75,pace:25,rate:75}]};
 const guest=journalForViewer(j,'public',false,{...DEFAULT_DETAILS,petRecords:false});assert.equal(guest.pets[0].huntHistory,undefined);assert.equal(guest.pets[0].obtainedStartCount,null);
 assert.deepEqual(journalForViewer(j,'private',false).pets,[]);assert.equal(journalForViewer(j,'private',true).pets[0].huntHistory?.length,1);
});
test('pet release ordering covers the catalogue, keeps ties stable and puts first pet first',()=>{
 for(const p of initial.pets)assert.match(releaseDate(p.name,'pets')??'',/^\d{4}-\d{2}-\d{2}$/);
 const sorted=[...initial.pets].sort(releaseOrder('pets'));assert.equal(sorted[0].name,'Pet chaos elemental');
 assert.equal(releaseDate('Chambers of Xeric: Challenge Mode','bosses'),'2018-05-17');
 assert.equal(releaseOrder('pets')({name:'Not known'},{name:sorted[0].name}),1);
});
test('derived board cache is isolated and privacy revisions cannot reuse older output',()=>{
 let calls=0;const first=publicBoardMemo('test-public',()=>{calls++;return {donation:100};});first.donation=999;
 assert.equal(publicBoardMemo('test-public',()=>({donation:0})).donation,100);assert.equal(calls,1);
 assert.equal(publicBoardMemo('test-hidden',()=>({donation:null})).donation,null);
});
test('open angler hats retain coloured hair while helmets can hide it',()=>{
 const a={body:'female',hair:'blonde'} as const;
 assert.equal(wearables.items['13258'].wear.includes(8),false);assert.match(headModel(a,wearables.items['13258'].wear.includes(8)),/female-blonde/);
 assert.equal(wearables.items['1163'].wear.includes(8),true);assert.equal(headModel(a,true),null);
});
test('the 1 in 75 item graph shows cumulative chance at 85 eligible KC',()=>{
 assert.ok(Math.abs(chanceAfter(85,1/75)-(1-(74/75)**85))<1e-12);assert.equal(chanceAfter(0,1/75),0);
});

test('cosmetic badge hover follows displayed rank without disclosing the underlying owner role',()=>{
 const owner={role:'owner',displayRole:'moderator',prefix:null} as const;
 assert.equal(displayedBadgeLabel(owner),'Site Moderator');
 assert.equal(displayedBadgeLabel(owner,{badge:'gilded',hidden:false,amountMinor:10000,currency:'USD'}),'Gilded supporter');
 assert.equal(displayedBadgeLabel({...owner,displayRole:'owner'}),'Site Owner');
});
