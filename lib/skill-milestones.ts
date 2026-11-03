import type {Journal} from './model';

/** Skill milestones on the Player timeline, stored compactly in the journal as `skillMilestones`:
 * key → 'YYYY-MM-DD', or '~YYYY-MM-DD' when the day is approximate.
 * Keys: `Attack:99` (each skill at 10, 20 … 90, 92 and 99), `base:70` (every skill at least 70, 80 or 90) and `maxed`. */
export type SkillMilestones=Record<string,string>;
type Skill={name:string;level:number;xp:number};

export const SKILLS=['Attack','Hitpoints','Mining','Strength','Agility','Smithing','Defence','Herblore','Fishing','Ranged','Thieving','Cooking','Prayer','Crafting','Firemaking','Magic','Fletching','Woodcutting','Runecraft','Slayer','Farming','Construction','Hunter','Sailing'] as const;
export const SKILL_LEVELS=[10,20,30,40,50,60,70,80,90,92,99];
export const BASE_LEVELS=[70,80,90];
const FIRST_DAY='2013-02-22';
const KEY=new RegExp(`^(?:(${SKILLS.join('|')}):(${SKILL_LEVELS.join('|')})|base:(${BASE_LEVELS.join('|')})|maxed)$`);
const DATE=/^~?\d{4}-\d{2}-\d{2}$/;

export function validMilestones(value:unknown):value is SkillMilestones {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const entries=Object.entries(value as Record<string,unknown>);
 return entries.length<=SKILLS.length*SKILL_LEVELS.length+BASE_LEVELS.length+1&&entries.every(([k,v])=>KEY.test(k)&&typeof v==='string'&&DATE.test(v));
}

/** A Wise Old Man achievement name as one of our milestones, or null: "99 Attack" → Attack:99, "Base 70 Stats" →
 * base:70, "Maxed Overall" (or "Base 99 Stats") → maxed. XP, boss and other achievements are not milestones. */
export function milestoneFromAchievement(name:string):string|null {
 const text=name.trim();
 if(/^maxed( overall)?$/i.test(text)||/^base 99 stats$/i.test(text))return 'maxed';
 const base=text.match(/^base (\d+) stats$/i);
 if(base)return BASE_LEVELS.includes(Number(base[1]))?`base:${Number(base[1])}`:null;
 const level=text.match(/^(\d+) ([a-z]+)$/i);
 if(!level||!SKILL_LEVELS.includes(Number(level[1])))return null;
 const word=level[2].toLowerCase()==='runecrafting'?'runecraft':level[2].toLowerCase();
 const skill=SKILLS.find(s=>s.toLowerCase()===word);
 return skill?`${skill}:${Number(level[1])}`:null;
}

/** Milestones from Wise Old Man's `/players/{name}/achievements`. Achievements WOM could not date (the epoch, or a
 * day before the game launched) are skipped; ones it dated only within a window of more than two days are approximate. */
export function womMilestones(raw:unknown,today=new Date().toISOString().slice(0,10)):SkillMilestones {
 const out:SkillMilestones={};
 if(!Array.isArray(raw))return out;
 for(const item of raw.slice(0,2000)){
  if(!item||typeof item!=='object')continue;
  const a=item as {name?:unknown;createdAt?:unknown;accuracy?:unknown};
  if(typeof a.name!=='string'||a.name.length>100)continue;
  const key=milestoneFromAchievement(a.name),time=Date.parse(String(a.createdAt));
  if(!key||!Number.isFinite(time))continue;
  const day=new Date(time).toISOString().slice(0,10);
  if(day<FIRST_DAY||day>today)continue;
  const approximate=typeof a.accuracy==='number'&&(a.accuracy<0||a.accuracy>2*86_400_000);
  out[key]=merged(out[key],(approximate?'~':'')+day);
 }
 return out;
}

const plain=(date:string)=>date.replace(/^~/,'');
/** An exact day beats an approximate one; between two of the same kind, the earlier day wins. */
function merged(a:string|undefined,b:string):string {
 if(!a)return b;
 const ax=!a.startsWith('~'),bx=!b.startsWith('~');
 if(ax!==bx)return ax?a:b;
 return plain(a)<=plain(b)?a:b;
}
export function mergeMilestones(existing:SkillMilestones|undefined,incoming:SkillMilestones):SkillMilestones|undefined {
 const out={...existing};
 for(const [key,date] of Object.entries(incoming))out[key]=merged(out[key],date);
 return Object.keys(out).length?out:undefined;
}

/** Milestones reached between two of our own stats syncs, dated at this sync and marked approximate. A skill missing
 * (unranked) from either snapshot says nothing about its level, and base levels need every skill in both. */
export function crossedMilestones(before:Skill[],after:Skill[],day:string):SkillMilestones {
 const out:SkillMilestones={};
 const level=(list:Skill[],name:string)=>{const s=list.find(s=>s.name===name);return s&&s.xp>=0&&s.level>=1?s.level:null;};
 const lows:number[]=[],highs:number[]=[];
 for(const name of SKILLS){
  const was=level(before,name),now=level(after,name);
  if(was===null||now===null){lows.push(NaN);continue;}
  lows.push(was);highs.push(now);
  for(const l of SKILL_LEVELS)if(was<l&&now>=l)out[`${name}:${l}`]='~'+day;
 }
 if(highs.length===SKILLS.length&&lows.every(Number.isFinite)){
  const was=Math.min(...lows),now=Math.min(...highs);
  for(const l of BASE_LEVELS)if(was<l&&now>=l)out[`base:${l}`]='~'+day;
  if(was<99&&now>=99)out.maxed='~'+day;
 }
 return out;
}

/** Record milestones crossed since the last stats sync. A first sync fills nothing: those levels could have been
 * reached at any time. */
export function recordCrossed(j:Journal,before:Skill[],hadStats:boolean,day=new Date().toISOString().slice(0,10)):void {
 if(!hadStats||!before.length)return;
 const crossed=crossedMilestones(before,j.hiscores.skills,day);
 const fresh=Object.fromEntries(Object.entries(crossed).filter(([key])=>!j.skillMilestones?.[key]));
 if(Object.keys(fresh).length)j.skillMilestones=mergeMilestones(j.skillMilestones,fresh);
}

export type MilestoneEvent={key:string;name:string;date:string;approximate:boolean;image:string};
/** Dated milestones for the timeline, oldest first. Hidden with the profile's skills. */
export function milestoneEvents(j:Journal):MilestoneEvent[] {
 if(j.restricted||j.details?.skills===false||!validMilestones(j.skillMilestones))return [];
 return Object.entries(j.skillMilestones).map(([key,date])=>{
  const [skill,level]=key.split(':');
  const name=key==='maxed'?'Maxed':skill==='base'?`Base ${level}`:`${level} ${skill}`;
  const image=key==='maxed'?'/items/13280.png':skill==='base'?'/icons/navigation/stats-icon.png':`/icons/skills/${skill.toLowerCase()}.png`;
  return {key,name,date:plain(date),approximate:date.startsWith('~'),image};
 }).sort((a,b)=>a.date.localeCompare(b.date)||a.key.localeCompare(b.key));
}
