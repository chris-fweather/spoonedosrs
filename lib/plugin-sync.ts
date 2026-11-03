import type {CollectionLog,Journal,Pet} from './model';
import {accountMode,type AccountMode} from './account-mode';
import {validCollectionDate} from './collection-history';
import {petSkill} from './estimates';
import {xpAtLevel} from './pet-record';
import template from './log-template.json' with {type:'json'};

/** What the RuneLite plugin sends. Everything is validated and bounded here; unknown fields are dropped. */
export type PluginEventType='PET'|'COLLECTION_ITEM'|'COMBAT_TASK';
export type PluginEvent={id:string;type:PluginEventType;occurredAt:number;localDate:string|null;name:string|null;detail:string|null;skills:Record<string,number>;killCounts:Record<string,number>};
export type PluginQuest={id:number;name:string;state:'finished'|'started'|'not_started'};
export type PluginSync={
 pluginVersion:string;
 character:{name:string;account:string;accountType:number};
 sections:Set<string>;
 skills:Record<string,number>|null;
 quests:PluginQuest[]|null;
 collectionLog:{uniqueObtained:number;uniqueTotal:number;complete:boolean;items:Map<number,number>|null}|null;
 /** Game varbits by id, such as the manifest's pet counts. */
 varbits:Record<string,number>;
 events:PluginEvent[];
};

/** Counts the game keeps toward pets the hiscores don't track: the varbit (the manifest's petVarbits), the pet,
 * and the method whose count it is. Barbarian Assault's gamble count is the "High-level gambles" line on the
 * collection log's Barbarian Assault page. */
export const PET_VARBITS=[{varbit:4768,pet:'Pet Penance Queen',method:'High-level gambles',unit:'gambles'}] as const;
export type PluginSyncResult={journal:Journal;accepted:string[];notes:string[]};

const SECTIONS=new Set(['skills','quests','diaries','combat','log','pets']);
const EVENT_TYPES=new Set<PluginEventType>(['PET','COLLECTION_ITEM','COMBAT_TASK']);
const PET_KINDS=new Set(['FOLLOWING','BACKPACK','DUPLICATE']);
const MAX_EVENTS=200;

const record=(v:unknown):Record<string,unknown>|null=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const text=(v:unknown,max:number):string|null=>typeof v==='string'&&v.length>0&&v.length<=max?v:null;
const count=(v:unknown,max=2_000_000_000):number|null=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=max?Number(v):null;
function fail(message:string):never{throw Error(message);}

/** A bounded name-to-number map, such as skill XP or kill counts. */
function numberMap(v:unknown,maxEntries:number,maxValue:number):Record<string,number>{
 const r=record(v);if(!r)return {};
 const out:Record<string,number>={};let n=0;
 for(const [key,value] of Object.entries(r)){
  if(++n>maxEntries)fail('Too many values in the plugin request.');
  const k=text(key,100),c=count(value,maxValue);
  if(k&&c!==null)out[k]=c;
 }
 return out;
}

export function parsePluginSync(raw:unknown):PluginSync{
 const r=record(raw)??fail('Send a JSON object.');
 const plugin=record(r.plugin),character=record(r.character)??fail('The plugin did not say which character this is.');
 const name=text(character.name,12)??fail('The plugin did not send a character name.');
 const account=text(character.account,128);
 if(!account||!/^[a-f0-9]{64}$/.test(account))fail('The plugin did not send a valid account key.');
 const sections=new Set(Array.isArray(r.sections)?r.sections.filter((s):s is string=>typeof s==='string'&&SECTIONS.has(s)):[]);

 let quests:PluginQuest[]|null=null;
 if(Array.isArray(r.quests)){
  if(r.quests.length>500)fail('Too many quests in the plugin request.');
  quests=r.quests.flatMap(q=>{const o=record(q),id=count(o?.id,1_000_000),qn=text(o?.name,200),state=o?.state;
   return o&&id!==null&&qn&&(state==='finished'||state==='started'||state==='not_started')?[{id,name:qn,state}]:[];});
 }

 let collectionLog:PluginSync['collectionLog']=null;
 const log=record(r.collectionLog);
 if(log){
  let items:Map<number,number>|null=null;
  const rawItems=record(log.items);
  if(rawItems){
   const entries=Object.entries(rawItems);
   if(entries.length>5000)fail('Too many collection log items in the plugin request.');
   items=new Map();
   for(const [id,quantity] of entries){const i=count(Number(id),100_000_000),q=count(quantity);if(i!==null&&i>0&&q!==null&&q>0)items.set(i,q);}
  }
  collectionLog={uniqueObtained:count(log.uniqueObtained,100_000)??0,uniqueTotal:count(log.uniqueTotal,100_000)??0,complete:log.complete===true,items};
 }

 const rawEvents=Array.isArray(r.events)?r.events:[];
 if(rawEvents.length>MAX_EVENTS)fail('Too many events in one plugin request.');
 const events:PluginEvent[]=rawEvents.flatMap(e=>{
  const o=record(e);if(!o)return [];
  const id=text(o.id,64),type=o.type as PluginEventType,at=count(o.occurredAt,32_503_680_000_000);
  if(!id||!/^[A-Za-z0-9-]+$/.test(id)||!EVENT_TYPES.has(type)||at===null)return [];
  const detail=text(o.detail,20);
  return [{id,type,occurredAt:at,localDate:text(o.localDate,10),name:text(o.name,200),detail:detail&&PET_KINDS.has(detail)?detail:null,
   skills:numberMap(o.skills,50,200_000_000),killCounts:numberMap(o.killCounts,500,100_000_000)}];
 });

 return {
  pluginVersion:text(plugin?.version,20)??'unknown',
  character:{name,account:account!,accountType:count(character.accountType,20)??0},
  sections,
  skills:r.skills===undefined?null:numberMap(r.skills,50,200_000_000),
  quests,collectionLog,events,
  varbits:numberMap(r.varbits,500,2_000_000_000),
 };
}

/** The IRONMAN varbit's values, as the site's account types. */
const ACCOUNT_TYPES:Record<number,AccountMode>={0:'normal',1:'ironman',2:'ultimate_ironman',3:'hardcore_ironman',4:'group_ironman',5:'hardcore_group_ironman',6:'unranked_group_ironman'};
export function pluginAccountMode(accountType:number):AccountMode|null{return accountMode(ACCOUNT_TYPES[accountType]??null);}

export function levelForXp(xp:number):number{let level=1;while(level<99&&xpAtLevel(level+1)<=xp)level++;return level;}

const normal=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ');
/** Collection-log item ids by in-game name. Names shared by several items are left out: they cannot be resolved from a message. */
const ITEM_IDS=(()=>{
 const ids=new Map<string,Set<number>>();
 for(const t of (template as CollectionLog).tabs)for(const p of t.pages)for(const i of p.items){const k=normal(i.name);if(!ids.has(k))ids.set(k,new Set());ids.get(k)!.add(i.id);}
 return new Map([...ids].filter(([,s])=>s.size===1).map(([k,s])=>[k,[...s][0]]));
})();
export function itemIdForName(name:string|null):number|null{return name?ITEM_IDS.get(normal(name))??null:null;}

/** The calendar day the player saw the event. Their clock can be a day ahead of the server's; such a day falls back to the server's. */
export function eventDate(e:PluginEvent):string{
 if(e.localDate&&validCollectionDate(e.localDate))return e.localDate;
 return new Date(e.occurredAt).toISOString().slice(0,10);
}

function skillsWith(j:Journal,xp:Record<string,number>):Journal['hiscores']['skills']{
 const skills=j.hiscores.skills.map(s=>({...s}));
 for(const [name,value] of Object.entries(xp)){
  if(name==='Overall')continue;
  const existing=skills.find(s=>s.name.toLowerCase()===name.toLowerCase());
  const level=levelForXp(value);
  if(existing){if(value>=existing.xp||existing.xp<0){existing.xp=value;existing.level=level;}}
  else skills.push({name,level,xp:value,rank:-1});
 }
 const parts=skills.filter(s=>s.name!=='Overall'&&s.xp>=0);
 const overall=skills.find(s=>s.name==='Overall');
 const total={name:'Overall',level:parts.reduce((n,s)=>n+s.level,0),xp:parts.reduce((n,s)=>n+s.xp,0),rank:overall?.rank??-1};
 if(overall){if(total.xp>=overall.xp){overall.level=total.level;overall.xp=total.xp;}}
 else skills.unshift(total);
 return skills;
}

/** Applies items to the saved log. Quantities only grow; an unlock is never removed. */
function logWith(j:Journal,items:Map<number,number>):CollectionLog{
 const log=structuredClone(j.log??template) as CollectionLog;
 const owned=new Set<number>(),known=new Set<number>();
 for(const t of log.tabs)for(const p of t.pages){
  for(const i of p.items){known.add(i.id);const q=items.get(i.id);if(q&&q>i.quantity)i.quantity=q;if(i.quantity>0)owned.add(i.id);}
  p.obtained=p.items.filter(i=>i.quantity>0).length;p.total=p.items.length;
 }
 log.obtained=owned.size;log.total=known.size;
 return log;
}

/** Kill count or XP at the moment of the drop, matched to one of the pet's methods. */
function acquisition(pet:Pet,e:PluginEvent):Partial<Pet>{
 const skill=petSkill[pet.name];
 if(skill&&e.skills[skill]!==undefined)return {obtainedUnit:'XP',obtainedCount:e.skills[skill],obtainedApproximate:false};
 const kcs=new Map(Object.entries(e.killCounts).map(([k,v])=>[normal(k),v]));
 for(const m of pet.methods){
  const kc=m.activity?kcs.get(normal(m.activity)):undefined;
  if(kc!==undefined&&m.unit!=='XP')return {obtainedMethod:m.name,obtainedUnit:m.unit,obtainedCount:kc,obtainedApproximate:false};
 }
 return {};
}

/**
 * Merges a plugin sync into a journal. Sections the player switched off are left as they are.
 * Witnessed pets and item dates are written as unconfirmed; anything the player already entered wins.
 * Every well-formed event is accepted, even when there is nothing to change, so the plugin can forget it.
 */
export function applyPluginSync(original:Journal,sync:PluginSync,now=new Date()):PluginSyncResult{
 const j:Journal=structuredClone(original);
 const notes:string[]=[];
 const at=now.toISOString();
 const mode=pluginAccountMode(sync.character.accountType);
 if(mode)j.accountMode=mode;

 if(sync.sections.has('skills')&&sync.skills&&Object.keys(sync.skills).length){
  j.hiscores={...j.hiscores,skills:skillsWith(j,sync.skills)};
  j.statsSyncedAt=at;
 }

 if(sync.sections.has('quests')&&sync.quests?.length){
  // Quest points are not sent by the game, so only quests the profile already lists are updated.
  if(j.profile){
   const byId=new Map(sync.quests.map(q=>[q.id,q])),byName=new Map(sync.quests.map(q=>[normal(q.name),q]));
   j.profile={...j.profile,quests:j.profile.quests.map(q=>{const p=byId.get(q.id)??byName.get(normal(q.name));return p?{...q,state:p.state}:q;}),syncedAt:at};
  }else notes.push('Quest progress will show once your quest list is imported.');
 }

 const logOn=sync.sections.has('log'),petsOn=sync.sections.has('pets');
 const items=new Map<number,number>();
 if((logOn||petsOn)&&sync.collectionLog?.items)for(const [id,q] of sync.collectionLog.items)items.set(id,q);

 const accepted:string[]=[];
 const dates:Record<string,string>={...j.collectionDates};
 const unconfirmed=new Set(j.unconfirmedDates??[]);
 const petUpdates=new Map<string,Partial<Pet>>();
 for(const e of sync.events){
  accepted.push(e.id);
  if(e.type==='COMBAT_TASK')continue;
  const id=itemIdForName(e.name);
  if(id===null)continue;
  const pet=j.pets.find(p=>p.id===String(id));
  if(e.type==='PET'||pet){
   if(!petsOn||!pet||e.detail==='DUPLICATE')continue;
   items.set(id,Math.max(items.get(id)??0,1));
   if(pet.obtained&&pet.date)continue;
   petUpdates.set(pet.id,{obtained:true,date:eventDate(e),source:'RuneLite plugin',unconfirmed:true,...acquisition(pet,e)});
  }else if(logOn){
   items.set(id,Math.max(items.get(id)??0,1));
   if(!dates[String(id)]){dates[String(id)]=eventDate(e);unconfirmed.add(String(id));}
  }
 }

 // Pet counts from the game: the method's count, and the count a pet that dropped in this sync came at.
 const gameCounts=new Map<string,{method:string;unit:string;value:number}>();
 if(petsOn)for(const v of PET_VARBITS){
  const value=sync.varbits[String(v.varbit)];
  const pet=value===undefined?undefined:j.pets.find(p=>p.name===v.pet);
  if(!pet)continue;
  gameCounts.set(pet.id,{method:v.method,unit:v.unit,value});
  const update=petUpdates.get(pet.id);
  if(update&&update.obtainedCount==null)petUpdates.set(pet.id,{...update,obtainedUnit:v.unit,obtainedCount:value,obtainedApproximate:false});
 }

 if(items.size){
  j.log=logWith(j,items);
  j.logSyncedAt=at;
  const owned=new Set(j.log.tabs.flatMap(t=>t.pages.flatMap(p=>p.items.filter(i=>i.quantity>0).map(i=>String(i.id)))));
  j.pets=j.pets.map(p=>{
   const update=petUpdates.get(p.id);
   if(update)return {...p,...update};
   return owned.has(p.id)&&!p.obtained&&petsOn?{...p,obtained:true,source:'RuneLite plugin'}:p;
  });
 }
 if(gameCounts.size)j.pets=j.pets.map(p=>{
  const c=gameCounts.get(p.id);
  return c?{...p,methods:p.methods.map(m=>m.name===c.method?{...m,kc:c.value}:m)}:p;
 });
 if(logOn){
  j.collectionDates=Object.keys(dates).length?dates:undefined;
  const marked=[...unconfirmed].filter(id=>!!dates[id]);
  j.unconfirmedDates=marked.length?marked:undefined;
 }
 return {journal:j,accepted,notes};
}
