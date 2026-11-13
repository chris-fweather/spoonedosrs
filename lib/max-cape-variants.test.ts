import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync} from 'node:fs';
import {COMPLETIONIST_CAPE,MAX_CAPE,MAX_CAPE_VARIANTS,capeVariantUnlocks,styleGroups,styleLabels} from './item-variants.ts';
import {CUSTOM_FEMALE_MODELS,CUSTOM_WEARABLES} from './custom-wearables.ts';
import {assertFlair,coerceFlair,emptyEquipped,obtainedItems,profileSaveBody,wearables} from './flair.ts';
import {appearanceModels} from './appearance.ts';
import type {Journal} from './model.ts';
import template from './log-template.json' with {type:'json'};

const logIds=new Set(template.tabs.flatMap(t=>t.pages.flatMap(p=>p.items.map(i=>String(i.id)))));
const SKILLS=['Attack','Hitpoints','Mining','Strength','Agility','Smithing','Defence','Herblore','Fishing','Ranged','Thieving','Cooking','Prayer','Crafting','Firemaking','Magic','Fletching','Woodcutting','Runecraft','Slayer','Farming','Construction','Hunter','Sailing'];
type Facts={maxed?:boolean;log?:number[];quests?:string[];diaries?:[string,string,number,number][]};
function journal({maxed=true,log=[],quests=[],diaries=[]}:Facts):Journal {
 return {username:'Test',pets:[],statsSyncedAt:null,logSyncedAt:null,revision:0,
  hiscores:{skills:SKILLS.map(name=>({name,level:maxed?99:98,xp:0,rank:1})),activities:[]},
  log:{obtained:log.length,total:log.length,tabs:[{name:'Bosses',obtained:log.length,total:log.length,pages:[{name:'Test',obtained:log.length,total:log.length,items:log.map(id=>({id,name:String(id),quantity:1}))}]}]},
  profile:{quests:quests.map((name,id)=>({id,name,points:1,type:'members',state:'finished'})),diaries:diaries.map(([area,tier,completed,total],areaId)=>({areaId,area,tiers:[{tier,completed,total}]})),combat:[],syncedAt:''},
 } as unknown as Journal;
}
const cape=(id:string)=>({equipped:{...emptyEquipped(),cape:id}});
const variant=(label:string)=>MAX_CAPE_VARIANTS.find(v=>v.label===label)!;
/** Each version and the facts that unlock it, as the owner asked for them. */
const RULES:[string,Facts][]=[
 ['Fire',{log:[6570]}],['Infernal',{log:[21295]}],['Assembler',{log:[21907]}],['Masori assembler',{log:[21907,27372]}],
 ["Dizana's",{log:[28947]}],['Ardougne',{diaries:[['Ardougne','Elite',8,8]]}],['Mythical',{quests:['Dragon Slayer II']}],
 ['Imbued saradomin',{quests:['Mage Arena II']}],['Imbued zamorak',{quests:['Mage Arena II']}],['Imbued guthix',{quests:['Mage Arena II']}],
 ['Saradomin',{quests:['Mage Arena I']}],['Zamorak',{quests:['Mage Arena I']}],['Guthix',{quests:['Mage Arena I']}],['Accumulator',{quests:['Animal Magnetism']}],
];

test('every max cape version is a cape with male and female models and an icon, and so is its completionist version',()=>{
 assert.equal(RULES.length,MAX_CAPE_VARIANTS.length);
 const ids=MAX_CAPE_VARIANTS.flatMap(v=>[v.id,v.completionist]);
 assert.equal(new Set(ids).size,ids.length);
 for(const v of MAX_CAPE_VARIANTS){
  const item=wearables.items[v.id];
  assert.equal(item.slot,'cape',v.id);assert.match(item.name,/max cape$/i,v.id);
  assert.ok(existsSync('public/models/look/'+item.file),v.id);
  assert.ok(existsSync('public/models/look/'+appearanceModels.femaleItems[v.id]),v.id+' female');
  const comp=CUSTOM_WEARABLES[v.completionist];
  assert.equal(comp.file,item.file);assert.equal(CUSTOM_FEMALE_MODELS[v.completionist],appearanceModels.femaleItems[v.id]);
  assert.equal(comp.effect,'embers');assert.equal(comp.name,`${v.label} completionist cape`);
  for(const id of [v.id,v.completionist])assert.ok(existsSync(`public/items/${id}.png`),id+' icon');
  for(const need of v.needs)if(/^\d+$/.test(need))assert.ok(logIds.has(need),need+' is a collection log item');
 }
});

test('each max cape version needs the max cape and the item that makes it',()=>{
 for(const [label,facts] of RULES){
  const {id,completionist}=variant(label);
  assert.ok(obtainedItems(journal(facts)).has(id),label);
  assert.equal(assertFlair(journal(facts),cape(id)).equipped.cape,id,label);
  assert.ok(!obtainedItems(journal({...facts,maxed:false})).has(id),`${label} needs the max cape`);
  assert.ok(!obtainedItems(journal({})).has(id),`${label} needs its cape`);
  // A completionist version needs the completionist cape (admins and the owner) as well.
  assert.ok(!obtainedItems(journal(facts)).has(completionist),label);
  assert.ok(obtainedItems(journal({...facts,maxed:false}),{staffRole:'admin'}).has(completionist),label);
  assert.ok(!obtainedItems(journal({}),{staffRole:'owner'}).has(completionist),`${label} completionist needs its cape`);
  assert.ok(!obtainedItems(journal(facts),{staffRole:'moderator'}).has(completionist),label);
 }
 // Half a recipe or half a diary tier is not enough; unfinished quests do not count.
 assert.ok(!obtainedItems(journal({log:[27372]})).has(variant('Masori assembler').id));
 assert.ok(!obtainedItems(journal({diaries:[['Ardougne','Elite',7,8]]})).has(variant('Ardougne').id));
 assert.ok(!obtainedItems(journal({diaries:[['Ardougne','Hard',8,8]]})).has(variant('Ardougne').id));
 const started=journal({quests:['Dragon Slayer II']});started.profile!.quests[0].state='in_progress';
 assert.ok(!obtainedItems(started).has(variant('Mythical').id));
 assert.ok(obtainedItems(journal({diaries:[['ardougne','elite',8,8]]})).has(variant('Ardougne').id),'names match in any case');
 assert.deepEqual(capeVariantUnlocks(new Set(['6570'])),[],'no versions without a base cape');
 assert.deepEqual(capeVariantUnlocks(new Set([MAX_CAPE,COMPLETIONIST_CAPE,'6570'])),['13329','990002']);
});

test('saving a max or completionist cape version is refused unless it is unlocked',()=>{
 const fire=variant('Fire'),infernal=variant('Infernal');
 const j=journal({log:[6570]});
 assert.equal(assertFlair(j,cape(fire.id)).equipped.cape,fire.id);
 assert.throws(()=>assertFlair(j,cape(infernal.id)),/Equip a collection log item this account can wear/);
 assert.throws(()=>assertFlair(journal({maxed:false,log:[6570]}),cape(fire.id)));
 assert.throws(()=>assertFlair(j,cape(fire.completionist)),'the completionist version needs the rank');
 assert.equal(assertFlair(j,cape(fire.completionist),{staffRole:'admin'}).equipped.cape,fire.completionist);
 assert.throws(()=>assertFlair(j,cape(infernal.completionist),{staffRole:'admin'}),'and the cape that makes it');
 // A stored version the player can no longer wear is dropped when the profile is shown or saved.
 assert.equal(coerceFlair(journal({}),cape(fire.id)).equipped.cape,null);
 const next={companionPet:null,displayPiece:null,equipped:{...emptyEquipped(),cape:infernal.id},pinnedMark:null,title:null};
 assert.equal(profileSaveBody(j,next,false).equipped.cape,null);
});

test('the picker shows the versions as styles of the max cape and of the completionist cape',()=>{
 const owned=obtainedItems(journal({log:[6570,21295,21907,27372,28947],quests:['Dragon Slayer II','Mage Arena I','Mage Arena II','Animal Magnetism'],diaries:[['Ardougne','Elite',8,8]]}),{staffRole:'owner'});
 const capes=Object.entries(wearables.items).filter(([id,item])=>item.slot==='cape'&&owned.has(id)).map(([id,item])=>({id,name:item.name}));
 const groups=styleGroups(capes,id=>wearables.items[id].name);
 const max=groups.find(g=>g[0].id===MAX_CAPE)!,comp=groups.find(g=>g[0].id===COMPLETIONIST_CAPE)!;
 assert.equal(max.length,MAX_CAPE_VARIANTS.length+1);assert.equal(comp.length,MAX_CAPE_VARIANTS.length+1);
 assert.deepEqual(styleLabels(max),styleLabels(comp));
 assert.deepEqual(styleLabels(max),['Standard',...MAX_CAPE_VARIANTS.map(v=>v.label)]);
});
