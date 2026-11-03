import type {Journal,Pet} from './model';
import {likelihood} from './model';
import {countedMethods,oddsMethod,selectedMethod,usesAcquisition} from './estimates';
import {acquisitionEffort,otherMethods} from './hunt-history';

/** Pet luck in hours, the way PetCord's pet hours sheet (Koekenpan, edited by Ptfo) works it out:
 * - a pet's expected hours (EH) use its fastest method: drop rate ÷ pace;
 * - time on any method is converted to "efficient hours" of that fastest method, so an hour on a slow method counts
 *   for less. kc ÷ rate is how many pets' worth of rolls a count is, so efficient hours = EH × Σ(count ÷ rate);
 * - hours already spent, when entered, replace count ÷ pace (converted through the method's rate ÷ pace);
 * - luck = expected hours of the pets you have − efficient hours spent on every pet (above zero is lucky). */
export type PetLuck={expected:number|null;spent:number|null;luck:number|null;chance:number|null};

/** Expected hours on the pet's fastest method with a rate and a pace. */
export function petExpectedHours(p:Pet):number|null {
 const hours=p.methods.filter(m=>m.rate&&m.kph).map(m=>m.rate!/m.kph!);
 return hours.length?Math.min(...hours):null;
}

/** Efficient hours spent on a pet, or null when its count is unknown. Pets not yet hunted have spent 0. */
export function petEfficientHours(p:Pet):number|null {
 const ref=petExpectedHours(p);
 if(ref===null)return null;
 // Hours already spent, when entered, replace count ÷ pace, converted to hours of the fastest method.
 if(p.recordedHours!=null){
  const m=p.obtained?oddsMethod(p):selectedMethod(p);
  return m?.rate&&m.kph?p.recordedHours*ref/(m.rate/m.kph):p.recordedHours;
 }
 if(p.obtained){
  const m=oddsMethod(p),others=otherMethods(p).filter(o=>o.rate);
  const extra=others.reduce((sum,o)=>sum+o.kc!/o.rate!,0);
  if(usesAcquisition(p)&&m?.rate&&m.kc!=null)return ref*(m.kc/m.rate+extra);
  const effort=acquisitionEffort(p).hours;
  if(effort!==null)return effort;
  // Like the sheet: with no count recorded at the drop, use the current count on each method.
  const counted=countedMethods(p).filter(m=>m.rate&&m.kc);
  return counted.length?ref*counted.reduce((sum,m)=>sum+m.kc!/m.rate!,0):null;
 }
 return ref*countedMethods(p).reduce((sum,m)=>sum+(m.rate&&m.kc?m.kc/m.rate:0),0);
}

export function petLuck(p:Pet):PetLuck {
 const expected=petExpectedHours(p),spent=petEfficientHours(p);
 return {expected,spent,luck:expected===null||spent===null?null:(p.obtained?expected:0)-spent,chance:likelihood(p)};
}

export type PetSummary={pets:number;obtained:number;luck:number;luckPets:number;missingCounts:number;totalHours:number;hoursGained:number;hoursLeft:number;progress:number|null};

/** The account summary: overall luck, total efficient hours, hours gained and left, and progress by expected hours. */
export function petSummary(j:Journal):PetSummary {
 let luck=0,luckPets=0,missingCounts=0,totalHours=0,hoursGained=0,hoursLeft=0,obtained=0;
 for(const p of j.pets){
  const r=petLuck(p);
  if(p.obtained)obtained++;
  if(r.expected!==null){if(p.obtained)hoursGained+=r.expected;else hoursLeft+=r.expected;}
  if(r.luck===null){if(p.obtained&&r.expected!==null)missingCounts++;continue;}
  luck+=r.luck;luckPets++;totalHours+=r.spent!;
 }
 return {pets:j.pets.length,obtained,luck,luckPets,missingCounts,totalHours,hoursGained,hoursLeft,progress:hoursGained+hoursLeft>0?hoursGained/(hoursGained+hoursLeft):null};
}

/** Obtained pets with a known count, luckiest first. */
export function luckRanking(j:Journal){
 return j.pets.filter(p=>p.obtained).map(p=>({pet:p,...petLuck(p)})).filter(r=>r.luck!==null).sort((a,b)=>b.luck!-a.luck!);
}
