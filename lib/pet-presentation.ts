import type {Journal,Pet} from './model';
import {petSkill,selectedMethod} from './estimates';
import {acquisitionUnit,unitShort} from './pet-record';
/** Date-only records keep their calendar day in every viewer timezone. */
export function collectedDate(date:string){const m=date.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);return m?`${m[3]}/${m[2]}/${m[1]}`:date;}
/** Presentation proportions, independent of game drop data. */
export function petPresentation(name:string):{extent:number;hover:number} {
 const sizes:Record<string,number>={'Tiny tempor':.34,'Abyssal protector':.3,'Giant Squirrel':.25,'Herbi':.28,'Rift guardian':.34,'Tangleroot':.38,'Baby chinchompa':.22,"Tumeken's guardian":.52,'TzRek-Jad':.4,'Venenatis spiderling':.4,'Sraracha':.36,"Lil' Zik":.42,'Pet Kraken':.3};
 return {extent:sizes[name]??.36,hover:PET_HOVER[name]??0};
}
/** How far a companion floats above the player's floor, as a share of the player's height. Pets that fly or hover in
 * game float; everything else stands on the ground (0). Pet kraken rests on the ground; Pet chaos elemental hovers. */
export const PET_HOVER:Record<string,number>={
 'Pet chaos elemental':.15,"Pet Kree'arra":.15,'Pet dark core':.15,'Phoenix':.15,'Noon':.15,'Wisp':.15,'Gull':.15,'Quetzin':.15,
 'Pet Smoke Devil':.1,'Little Nightmare':.06,"Lil'viathan":.06,
 'Rift guardian':.025,"Tumeken's guardian":.025,
};
/** Bounds must be measured before changing the parent scale. Local offset is not divided by scale. */
export function petPlacement(playerHeight:number,playerFloor:number,raw:{x:number;y:number;z:number;minY:number},name:string){
 const p=petPresentation(name),height=Math.max(1,playerHeight);
 return {scale:height*p.extent/Math.max(raw.x,raw.y,raw.z,1),localY:-raw.minY,groundY:playerFloor+height*p.hover};
}

const whole=(v:number)=>v.toLocaleString('en-US',{maximumFractionDigits:0});
/** XP as players say it: 13.2M, 850K, 9,500. */
export function shortXp(xp:number):string {
 if(xp>=1e6)return `${(Math.floor(xp/1e5)/10).toLocaleString('en-US',{maximumFractionDigits:1})}M`;
 if(xp>=1e4)return `${Math.floor(xp/1e3)}K`;
 return whole(xp);
}
/** Hiscores names short enough to share one line: raids by their initials, modes by the mode alone when the base
 * activity sits beside them ("0 ToB · 0 Hard"). */
const ACTIVITY_SHORT:Record<string,string>={'Theatre of Blood':'ToB','Theatre of Blood: Hard Mode':'Hard','Theatre of Blood: Entry Mode':'Entry',
 'Chambers of Xeric':'CoX','Chambers of Xeric: Challenge Mode':'CM','Tombs of Amascut':'ToA','Tombs of Amascut: Expert Mode':'Expert','Tombs of Amascut: Entry Mode':'Entry',
 'Thermonuclear smoke devil':'Thermy','The Corrupted Gauntlet':'Corrupted','The Gauntlet':'Gauntlet','Guardians of the Rift':'GotR',
 'Clue Scrolls (master)':'master clues',"Phosani's Nightmare":'Phosani','The Royal Titans':'Royal Titans'};
export function activityShort(name:string):string {return ACTIVITY_SHORT[name]??name.replace(/^The /,'');}
/** A method's short name for one line: "Ardougne" for Ardougne Rooftop, "Shark" for Shark (2t w/ Shark Lures),
 * "Hard Mode" for Lil' zik (Hard Mode), "Artio" for Callisto cub (Artio). */
export function shortMethod(method:string,petName=''):string {
 let s=method.trim();
 const paren=s.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
 if(paren)s=!paren[1]||paren[1].toLowerCase()===petName.toLowerCase()?paren[2]:paren[1];
 if(s.includes(' · '))s=s.split(' · ').slice(1).join(' · ');
 return s.replace(/\s+(Village Rooftop|Rooftop|Village)$/i,'').trim()||method;
}
/** The method a pet came from, when naming it adds something: never for single-method pets, never when it only
 * repeats the default method or the count's unit ("Permits" for permits). Skilling pets always name it, since the
 * XP alone says nothing about where it was earned. */
function receivedFrom(pet:Pet,unit:string):string|null {
 const from=pet.obtainedMethod?.trim();if(!from)return null;
 const same=(a:string,b:string)=>a.toLowerCase().replace(/s$/,'')===b.toLowerCase().replace(/s$/,'');
 if(same(from,unit)||same(from,pet.name))return null;
 const known=pet.methods.find(m=>m.name.toLowerCase()===from.toLowerCase());
 if(known&&(pet.methods.length<2||(!petSkill[pet.name]&&known===pet.methods[0])))return null;
 return shortMethod(from,pet.name);
}
/** The two record lines of a pet hover: what it was obtained at, and the current count in the same unit. */
/** With byUnit, the current count names its unit ("292 kills") rather than the boss or activity ("292 Chaos Elemental"). */
export function petHoverLines(j:Journal,pet:Pet,byUnit=false):{obtained:string|null;current:string|null} {
 let obtained:string|null=null;
 if(pet.obtained&&pet.obtainedCount!=null){
  const unit=acquisitionUnit(pet),approx=pet.obtainedApproximate?'~':'';
  const count=unit==='level'?`level ${whole(pet.obtainedCount)}`:unit==='XP'?`${approx}${shortXp(pet.obtainedCount)} XP`:`${approx}${whole(pet.obtainedCount)} ${unitShort(pet,unit)}`;
  const from=receivedFrom(pet,unitShort(pet,unit));
  obtained=`Obtained at ${count}${from?` · ${from}`:''}`;
 }
 return {obtained,current:currentCount(j,pet,byUnit)};
}
/** Raid modes and the base raid they belong to; a mode alone on a line keeps its raid's initials ("ToB Hard"). */
const RAID_MODES:Record<string,{base:string;alone:string}>={'Theatre of Blood: Hard Mode':{base:'Theatre of Blood',alone:'ToB Hard'},
 'Theatre of Blood: Entry Mode':{base:'Theatre of Blood',alone:'ToB Entry'},'Chambers of Xeric: Challenge Mode':{base:'Chambers of Xeric',alone:'CoX CM'},
 'Tombs of Amascut: Expert Mode':{base:'Tombs of Amascut',alone:'ToA Expert'},'Tombs of Amascut: Entry Mode':{base:'Tombs of Amascut',alone:'ToA Entry'}};
/** Hiscores activities that count a reward pet's game without being one of its methods. */
export const RELATED_ACTIVITY:Record<string,string>={'Tiny tempor':'Tempoross','Phoenix':'Wintertodt','Abyssal protector':'Guardians of the Rift'};
/** The current count in the unit the pet was obtained at (or, before it is obtained, the planned method's unit), so
 * the two lines compare: permits with permits, kills with kills, XP with XP. A base raid keeps its modes beside it
 * ("0 ToB · 0 Hard"), since they are one activity; a mode on its own shows only that mode. */
function currentCount(j:Journal,pet:Pet,byUnit:boolean):string|null {
 const planned=selectedMethod(pet),skillName=petSkill[pet.name];
 const unit=pet.obtained?acquisitionUnit(pet):planned?.unit??(skillName?'XP':null);
 const skill=skillName?j.hiscores.skills.find(s=>s.name===skillName&&s.xp>=0):undefined;
 const fromSkill=(u:string|null)=>!skill?null:u==='XP'?`${shortXp(skill.xp)} ${skill.name} XP`:u==='level'?`level ${skill.level} ${skill.name}`:null;
 const score=(name:string|null|undefined)=>name?j.hiscores.activities.find(a=>a.name.toLowerCase()===name.toLowerCase()&&a.score>=0):undefined;
 const line=(text:string|null)=>text?`Current: ${text}`:null;
 if(unit==='XP'||unit==='level')return line(fromSkill(unit));
 if(!unit)return null;
 const same=(m:{unit:string})=>m.unit===unit;
 const named=pet.obtained&&pet.obtainedMethod?pet.methods.find(m=>m.name.toLowerCase()===pet.obtainedMethod!.trim().toLowerCase()&&same(m)):undefined;
 const method=named??(planned&&same(planned)?planned:pet.methods.find(same));
 if(!method){
  const related=score(RELATED_ACTIVITY[pet.name]);
  // A related activity counts something else (Tempoross games, not reward rolls), so it keeps its own name.
  return line(related?`${whole(related.score)} ${activityShort(related.name)}`:!pet.obtained?fromSkill('XP'):null);
 }
 const own=score(method.activity);
 if(own&&byUnit)return line(`${whole(own.score)} ${unitShort(pet,method.unit)}`);
 if(own){
  if(RAID_MODES[own.name])return line(`${whole(own.score)} ${RAID_MODES[own.name].alone}`);
  const modes=pet.methods.filter(m=>m!==method&&same(m)&&m.activity&&RAID_MODES[score(m.activity)?.name??'']?.base===own.name).map(m=>score(m.activity)!);
  return line([own,...modes].map(a=>`${whole(a.score)} ${activityShort(a.name)}`).join(' · '));
 }
 if(method.kc!=null&&method.kc>=0)return line(`${whole(method.kc)} ${unitShort(pet,method.unit)}`);
 return !pet.obtained?line(fromSkill('XP')):null;
}

/** A cosmetic showcase never grants access to private acquisition records. */
export function companionDescription(j:Journal,id:string,name:string):string {
 if(j.restricted)return name;
 const pet=j.pets.find(p=>p.id===id);if(!pet)return name;
 const {obtained,current}=petHoverLines(j,pet),lines=[name];
 if(pet.obtained){
  lines.push(obtained??'Obtained');
  if(pet.date)lines.push(`Collected: ${collectedDate(pet.date)}`);
 }else lines.push('Not collected');
 if(current)lines.push(current);
 return lines.join('\n');
}
