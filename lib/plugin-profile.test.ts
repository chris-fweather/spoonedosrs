import test from 'node:test';
import assert from 'node:assert/strict';
import {initial} from './model.ts';
import {journalForViewer,DEFAULT_DETAILS} from './profile-privacy.ts';
import {pluginPetCatalogue,pluginProfile} from './plugin-profile.ts';
import type {StoredFlair} from './flair.ts';
import {achievementDescription} from './presentation.ts';
import {releaseOrder} from './release-dates.ts';

function journal(){
 const j=structuredClone(initial);j.username='Rocky';
 j.pets=j.pets.map((p,i)=>i===0?{...p,obtained:true,date:'2026-01-02',obtainedCount:812,obtainedUnit:'kills',notes:'secret plan'}:{...p,obtained:false,date:''});
 j.hiscores={skills:[{name:'Overall',level:2000,xp:300_000_000,rank:5},{name:'Attack',level:99,xp:13_034_431,rank:900}],activities:[]};
 j.log={obtained:2,total:3,tabs:[{name:'Bosses',pages:[{name:'A',obtained:2,total:2,items:[{id:1,name:'a',quantity:1},{id:2,name:'b',quantity:3}]},{name:'B',obtained:1,total:2,items:[{id:2,name:'b',quantity:3},{id:3,name:'c',quantity:0}]}]}]};
 j.profile={quests:[{id:1,name:'Q',points:1,type:'',state:'finished'},{id:2,name:'R',points:1,type:'',state:'started'}],diaries:[{areaId:1,area:'Ardougne',tiers:[{tier:'Easy',completed:10,total:10},{tier:'Medium',completed:3,total:12}]}],combat:[{id:1,name:'Easy',completed:3,total:4}],syncedAt:''};
 j.logSyncedAt='2026-01-03';j.statsSyncedAt='2026-01-03';
 return j;
}
const flair={companionPet:null,displayPiece:null,equipped:{} as StoredFlair['equipped'],pinnedMark:null,title:'the Generous',supporter:true,
 staff:{role:'owner',prefix:null,displayRole:'admin',displayPrefix:null},showcase:{badge:null,pet:null,achievementTitle:'the Pet Collector'}} as unknown as StoredFlair;

test('the plugin profile carries titles in their site colours, the staff badge and ranked skills', ()=>{
 const p=pluginProfile(journalForViewer(journal(),'public',false,DEFAULT_DETAILS),flair);
 assert.deepEqual(p.title,{text:'the Generous',colour:'#dfbe79'});
 assert.deepEqual(p.achievementTitle,{text:'the Pet Collector',colour:'#81cc91',description:achievementDescription('the Pet Collector')});
 assert.deepEqual(p.badge,{label:'Site Admin',icon:'/icons/ranks/dragon-scimitar.png'});
 assert.equal(p.nameColour,'#f0675c');
 assert.equal(p.skills?.find(s=>s.name==='Overall')?.tier,'gold');
 assert.equal(p.skills?.find(s=>s.name==='Attack')?.tier,'bronze');
 assert.deepEqual(p.quests,{finished:1,total:2});
 assert.deepEqual(p.diaries,{completed:1,total:2});
 assert.deepEqual(p.combat,[{name:'Easy',completed:3,total:4}]);
});

test('collection log counts each item once, across pages', ()=>{
 const p=pluginProfile(journalForViewer(journal(),'public',false,DEFAULT_DETAILS),flair);
 assert.deepEqual({obtained:p.log?.obtained,total:p.log?.total},{obtained:2,total:3});
 assert.deepEqual(p.log?.tabs,[{name:'Bosses',obtained:2,total:3}]);
});

test('pets carry the date and count they were obtained at, and never notes', ()=>{
 const p=pluginProfile(journalForViewer(journal(),'public',false,DEFAULT_DETAILS),flair);
 const pet=p.pets!.find(x=>x.obtained)!;
 assert.equal(pet.date,'2026-01-02');assert.equal(pet.count,812);assert.equal(pet.unit,'kills');
 assert.equal(pet.obtainedAt,'812 kills');assert.ok(pet.category);assert.equal(pet.progress,null);
 assert.ok(!JSON.stringify(p).includes('secret plan'));
});

test('hidden pet records leave the hover without counts', ()=>{
 const p=pluginProfile(journalForViewer(journal(),'public',false,{...DEFAULT_DETAILS,petRecords:false}),flair);
 const pet=p.pets!.find(x=>x.obtained)!;
 assert.equal(pet.count,null);assert.equal(pet.obtainedAt,null);assert.equal(pet.method,null);
});

test('hidden sections and private profiles show nothing', ()=>{
 const hidden=pluginProfile(journalForViewer(journal(),'public',false,{...DEFAULT_DETAILS,pets:false,skills:false}),flair);
 assert.equal(hidden.pets,null);assert.equal(hidden.skills,null);assert.ok(hidden.log);
 const priv=pluginProfile(journalForViewer(journal(),'private',false,DEFAULT_DETAILS),flair);
 assert.equal(priv.restricted,true);assert.equal(priv.found,true);
 assert.equal(priv.diaries,null);assert.equal(priv.pets,null);assert.equal(priv.log,null);assert.equal(priv.combat,null);assert.equal(priv.quests,null);
});

test('pets come in the overview order, with its hover lines and luck', ()=>{
 const j=journal();
 const p=pluginProfile(journalForViewer(j,'public',false,DEFAULT_DETAILS),flair);
 assert.deepEqual(p.pets!.map(x=>x.name),[...j.pets].sort(releaseOrder('pets')).map(x=>x.name));
 const got=p.pets!.find(x=>x.obtained)!;
 assert.match(got.obtainedLine??'',/^Obtained at 812 /);
 for(const pet of p.pets!)assert.ok(pet.luck===null||(Number.isFinite(pet.luck)&&pet.luck!==0));
 const hidden=pluginProfile(journalForViewer(j,'public',false,{...DEFAULT_DETAILS,petRecords:false}),flair);
 assert.ok(hidden.pets!.every(x=>x.luck===null&&x.expectedHours===null&&x.obtainedLine===null&&x.currentLine===null));
});

test('the plugin pet catalogue says where each count comes from', ()=>{
 const all=pluginPetCatalogue(),find=(name:string)=>all.find(p=>p.name===name)!;
 assert.deepEqual(all.map(p=>p.name),[...initial.pets].sort(releaseOrder('pets')).map(p=>p.name));
 assert.deepEqual({skill:find('Heron').skill,activity:find('Heron').activity},{skill:'Fishing',activity:null});
 assert.deepEqual({activity:find('Tiny tempor').activity,unit:find('Tiny tempor').unit},{activity:'Tempoross',unit:null});
 assert.equal(find('Pet chaos elemental').unit,'kills');
});
