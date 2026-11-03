import type {Journal,Method,Pet} from './model';
import {petSkill,selectedMethod} from './estimates';
export function acquisitionUnits(pet:Pet):string[]{
 return [...new Set([...(petSkill[pet.name]?['XP','level']:[]),...pet.methods.map(m=>m.unit).filter(u=>u&&u!=='XP'),...(pet.obtainedUnit?[pet.obtainedUnit]:[])])];
}
export function acquisitionUnit(pet:Pet):string{return pet.name==='Tiny tempor'&&pet.obtainedUnit==='permits'?'rolls':pet.obtainedUnit??(petSkill[pet.name]?'XP':selectedMethod(pet)?.unit??'kills');}
export function acquisitionMethod(pet:Pet):string{return pet.obtainedMethod??selectedMethod(pet)?.name??'';}
export function validAcquisition(pet:Pet):boolean {
 return (!['XP','level'].includes(acquisitionUnit(pet))||!!petSkill[pet.name])&&(pet.obtainedUnit==null||(typeof pet.obtainedUnit==='string'&&pet.obtainedUnit.length>0&&pet.obtainedUnit.length<50))
  &&(pet.obtainedMethod==null||(typeof pet.obtainedMethod==='string'&&pet.obtainedMethod.length<=200))
  &&(pet.obtainedCount==null||(acquisitionUnit(pet)==='XP'?pet.obtainedCount<=200_000_000:acquisitionUnit(pet)==='level'?Number.isInteger(pet.obtainedCount)&&pet.obtainedCount>=1&&pet.obtainedCount<=99:Number.isInteger(pet.obtainedCount)));
}

/** A recalled level is not an exact XP observation. */
export function xpAtLevel(level:number):number {let points=0;for(let n=1;n<level;n++)points+=Math.floor(n+300*2**(n/7));return Math.floor(points/4);}
export function petUnitLabel(pet:Pet,unit:string){return pet.name==='Abyssal protector'&&unit==='rewards'?'searches':unit;}
export function acquisitionLabel(pet:Pet):string {
 if(pet.obtainedCount==null)return 'not recorded';
 const n=pet.obtainedCount.toLocaleString('en-US',{maximumFractionDigits:0});
 return acquisitionUnit(pet)==='level'?`${petSkill[pet.name]} level ${n} (exact XP unknown)`:`${pet.obtainedApproximate?'~':''}${n} ${pet.name==='Tiny tempor'&&acquisitionUnit(pet)==='rolls'?'permits spent':petUnitLabel(pet,acquisitionUnit(pet))}${pet.obtainedApproximate?' (estimated)':''}`;
}

const SHORT_UNITS:Record<string,string>={pickpockets:'picks','eligible rolls':'rolls','master clues':'clues',activities:'acts'};
/** A unit short enough to sit inside a count or pace field: laps, XP, kills, picks. */
export function unitShort(pet:Pet,unit:string):string {
 if(pet.name==='Tiny tempor'&&unit==='rolls')return 'permits';
 const label=petUnitLabel(pet,unit);return SHORT_UNITS[label]??label;
}
/** What synced hiscores say about a method's count, when they can: the skill's XP for an XP method, or the activity
 * score for a kill or completion method. Lifetime XP covers every method, so it is offered, never filled in. */
export function hiscoresCount(pet:Pet,j:Journal,m:Method):{value:number;label:string}|null {
 if(m.unit==='XP'&&petSkill[pet.name]){const s=j.hiscores.skills.find(s=>s.name===petSkill[pet.name]&&s.xp>=0);return s?{value:s.xp,label:`${s.name} XP`}:null;}
 const a=m.activity?j.hiscores.activities.find(a=>a.name.toLowerCase()===m.activity!.toLowerCase()&&a.score>=0):undefined;
 return a&&['kills','games','raids','runs','completions','subdues'].includes(m.unit)?{value:a.score,label:`${a.name} ${m.unit==='kills'?'KC':m.unit}`}:null;
}
