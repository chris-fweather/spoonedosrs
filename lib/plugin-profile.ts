import type {Journal} from './model';
import type {StoredFlair} from './flair';
import {progressAvailability} from './progress-availability';
import {achievementDescription,titleRarity} from './presentation';
import {rankTier} from './rank-rewards';
import {RANK_STYLE,displayedBadgeLabel,hasGildedSupporter} from './staff-appearance';
import {initial,kcFor,type Pet} from './model';
import {oddsMethod,petSkill} from './estimates';
import {petRateLines} from './pet-rates';
import {acquisitionLabel,acquisitionMethod,petUnitLabel,unitShort} from './pet-record';
import {petLuck} from './pet-luck';
import {RELATED_ACTIVITY,petHoverLines} from './pet-presentation';
import {releaseOrder} from './release-dates';

/** Title colours, matching app/title-rarities.css. */
const RARITY_COLOUR={common:'#bcb5a5',uncommon:'#81cc91',rare:'#86c7f3',epic:'#ff7373',legendary:'#ffd98a'} as const;
const SUPPORTER_COLOUR='#dfbe79';
/** Staff names in their rank colour, matching --rank-* in app/globals.css. */
const RANK_COLOUR={helper:'#74d16a',moderator:'#6eaaf2',admin:'#f0675c',owner:'#f0675c'} as const;

/** Everything the RuneLite plugin's profile view shows, in one small reply. Sections the owner hid are null. */
export type PluginProfile={
 name:string;
 found:boolean;
 restricted:boolean;
 /** The name's colour: staff show theirs in their rank colour. Null for the usual white. */
 nameColour:string|null;
 title:{text:string;colour:string}|null;
 achievementTitle:{text:string;colour:string;description:string}|null;
 /** The scimitar or supporter coin before the name, with its hover text. */
 badge:{label:string;icon:string}|null;
 accountMode:string|null;
 skills:{name:string;level:number;xp:number;rank:number;tier:'champion'|'gold'|'silver'|'bronze'|null}[]|null;
 pets:{id:number;name:string;obtained:boolean;date:string|null;count:number|null;unit:string|null;approximate:boolean;currentCount:number|null;
  /** For the hover, as the site's pet panel shows them: where it comes from, its drop rate, the count it came at,
   * how it was obtained, and for a missing pet the player's count so far. Null when not known or hidden. */
  category:string;rate:string|null;obtainedAt:string|null;method:string|null;progress:string|null;
  /** The pet hover's record (lib/pet-presentation.ts petHoverLines, by unit): "Obtained at 775 searches · Abyssal
   * protector" and "Current: 1,234 kills". Null when not known or the records are hidden. */
  obtainedLine:string|null;currentLine:string|null;
  /** Luck in hours, as the overview's pet hover shows it (above zero is lucky), and the pet's expected hours to scale
   * it by. Null when not known or hidden. */
  luck:number|null;expectedHours:number|null}[]|null;
 log:{obtained:number;total:number;tabs:{name:string;obtained:number;total:number}[]}|null;
 combat:{name:string;completed:number;total:number}[]|null;
 quests:{finished:number;total:number}|null;
 /** Diary tiers complete, across every area. */
 diaries:{completed:number;total:number}|null;
};

/** Builds the plugin profile from the journal and flair an anonymous visitor would see. */
export function pluginProfile(j:Journal,flair:StoredFlair):PluginProfile{
 const known=progressAvailability(j),shown=(key:keyof NonNullable<Journal['details']>)=>!j.restricted&&j.details?.[key]!==false;
 const role=flair.staff?.displayRole??flair.staff?.role??null;
 const achievement=flair.showcase?.achievementTitle??null;
 const found=j.restricted||known.pets||known.log||known.stats||known.combat||known.quests;
 const unique=(items:{id:number;quantity:number}[])=>{const all=new Map<number,boolean>();for(const i of items)all.set(i.id,(all.get(i.id)??false)||i.quantity>0);return {obtained:[...all.values()].filter(Boolean).length,total:all.size};};
 return {
  name:j.username,found,restricted:!!j.restricted,
  nameColour:role?RANK_COLOUR[role]:null,
  title:flair.title?{text:flair.title,colour:SUPPORTER_COLOUR}:null,
  achievementTitle:achievement&&achievement!==flair.title?{text:achievement,colour:achievement==='Supporter'?SUPPORTER_COLOUR:RARITY_COLOUR[titleRarity(achievement)],description:achievementDescription(achievement)}:null,
  badge:badge(flair,role),
  accountMode:j.accountMode&&j.accountMode!=='normal'?j.accountMode:null,
  skills:known.stats&&shown('skills')?j.hiscores.skills.map(s=>({name:s.name,level:s.level,xp:s.xp,rank:s.rank,tier:rankTier(s.rank)})):null,
  pets:known.pets&&shown('pets')?[...j.pets].sort(releaseOrder('pets')).map(p=>({id:Number(p.id),name:p.name,obtained:p.obtained,date:p.obtained&&p.date?p.date:null,
   count:p.obtained?p.obtainedCount??null:null,unit:p.obtained?p.obtainedUnit??null:null,approximate:!!p.obtainedApproximate||!!p.unconfirmed,currentCount:kcFor(p),
   ...petHover(p,j),...petRecord(p,j)})):null,
  log:known.log&&j.log&&shown('log')?{...unique(j.log.tabs.flatMap(t=>t.pages.flatMap(p=>p.items))),
   tabs:j.log.tabs.map(t=>({name:t.name,...unique(t.pages.flatMap(p=>p.items))}))}:null,
  combat:known.combat&&shown('combat')?j.profile!.combat.map(c=>({name:c.name,completed:c.completed,total:c.total})):null,
  quests:known.quests&&shown('quests')?{finished:j.profile!.quests.filter(q=>q.state==='finished').length,total:j.profile!.quests.length}:null,
  diaries:known.diaries&&shown('diaries')?(()=>{const tiers=j.profile!.diaries.flatMap(d=>d.tiers);return {completed:tiers.filter(t=>t.total>0&&t.completed>=t.total).length,total:tiers.length};})():null,
 };
}

/** As the site's name prefix (app/StaffBadge.tsx): gilded scimitar, staff scimitar, or supporter coin. */
function badge(flair:StoredFlair,role:keyof typeof RANK_COLOUR|null):PluginProfile['badge']{
 const label=displayedBadgeLabel(flair.staff,flair.donation);
 if(flair.donation?.badge==='gilded'&&hasGildedSupporter(flair.donation))return {label,icon:'/icons/ranks/gilded-scimitar.png'};
 if(role)return {label,icon:RANK_STYLE[role].src};
 return flair.donation?.supporter?{label,icon:'/icons/community/sponsor-coin.png'}:null;
}

const n=(v:number)=>v.toLocaleString('en-US',{maximumFractionDigits:0});
/** The pet hover's lines, worked out as app/PetPanel.tsx does. */
function petHover(p:Pet,j:Journal){
 const m=oddsMethod(p),outlook=petRateLines(p,j),xp=m?.unit==='XP'||outlook.averageXp!=null;
 const rate=outlook.lines.find(l=>l.label==='Drop rate'||l.label.startsWith('Drop rate at'))?.value??(m?.rate?(xp?`1 per ${n(m.rate)} XP`:`1/${n(m.rate)}`):null);
 const skill=petSkill[p.name]?j.hiscores.skills.find(s=>s.name===petSkill[p.name]):undefined;
 const kc=kcFor(p);
 const progress=p.obtained?null:skill?`Lifetime ${skill.name} XP ${n(skill.xp)}`:kc!=null&&kc>0?`Your ${petUnitLabel(p,m?.unit??'count')} ${n(kc)}`:null;
 return {category:p.category,rate,obtainedAt:p.obtained&&p.obtainedCount!=null?acquisitionLabel(p):null,method:p.obtained&&p.obtainedCount!=null?acquisitionMethod(p)||null:null,progress};
}

/** The overview pet hover's record lines and luck. */
function petRecord(p:Pet,j:Journal){
 if(j.details?.petRecords===false)return {obtainedLine:null,currentLine:null,luck:null,expectedHours:null};
 const lines=petHoverLines(j,p,true),{luck,expected}=petLuck(p);
 return {obtainedLine:lines.obtained,currentLine:lines.current,luck:luck===0?null:luck,expectedHours:expected};
}

/** Every pet for the plugin's manifest, in the overview's order, with where a player's count for it comes from:
 * the hiscores activity and its unit ("Tempoross", "games"), or the skill for an XP pet. The plugin uses these to
 * show a looked-up player's counts from the hiscores before (or without) a Spooned profile. */
export function pluginPetCatalogue(){
 return [...initial.pets].sort(releaseOrder('pets')).map(p=>{
  const skill=petSkill[p.name]??null,method=skill?undefined:p.methods.find(m=>m.activity);
  // A related activity (Tempoross for Tiny tempor) counts something else, so it has no unit: the plugin names it.
  const activity=method?.activity??(skill?null:RELATED_ACTIVITY[p.name]??null);
  return {id:Number(p.id),name:p.name,category:p.category,skill,activity,unit:method?unitShort(p,method.unit):null};
 });
}
