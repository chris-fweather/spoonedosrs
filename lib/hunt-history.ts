import type {Pet,Method} from './model';
import {acquisitionUnit,validAcquisition,xpAtLevel} from './pet-record';

/** A segment of the retired "Historical methods" editor. Old journals may still hold them; `migrateHuntHistory` moves
 * them into the pet's methods on load, so nothing calculates from them any more. */
export type HuntSegment={method:string;unit:string;count:number|null;pace:number|null;rate:number|null};
export function validHuntHistory(value:unknown):boolean {
 if(value===undefined)return true;
 return Array.isArray(value)&&value.length<=30&&value.every(s=>s&&typeof s==='object'&&typeof s.method==='string'&&s.method.trim().length>0&&s.method.length<=200&&typeof s.unit==='string'&&s.unit.length>0&&s.unit.length<50&&s.unit!=='level'&&['count','pace','rate'].every(k=>s[k]===null||(typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>= (k==='count'?0:k==='rate'?1:0.001)&&s[k]<=1e12))&&(s.count===null||s.unit==='XP'||Number.isInteger(s.count)));
}
const key=(s?:string|null)=>s?.trim().toLowerCase()??'';
export function receivedMethod(p:Pet):Method|undefined {
 const label=key(p.obtainedMethod);
 if(p.name==='Tiny tempor'&&['permits','permit','reward permits','reward pool','tempoross'].includes(label))return p.methods.find(m=>m.name==='Tempoross'&&['rolls','permits'].includes(m.unit));
 return p.methods.find(m=>key(m.name)===label);
}
/** A collected pet's other methods that add to its chance and time: counts the player entered on methods other than the
 * one they got it from. Methods tied to a hiscores activity are left out: sync keeps their count at today's total, which
 * includes kills after the drop. */
export function otherMethods(p:Pet):Method[] {
 if(!p.obtained)return [];
 const received=receivedMethod(p);
 return p.methods.filter(m=>m!==received&&m.kc!=null&&!m.activity);
}
const otherHours=(ms:Method[])=>ms.some(m=>!m.kph)?null:ms.reduce((sum,m)=>sum+m.kc!/m.kph!,0);
export function acquisitionEffort(p:Pet):{hours:number|null;range?:[number,number];basis:string} {
 if(p.recordedHours!=null)return {hours:p.recordedHours,basis:'Hours already spent, as you entered them. They replace count ÷ pace.'};
 const others=otherMethods(p),extra=otherHours(others);
 const plus=others.length?` Plus your other methods (${others.map(m=>m.name).join(', ')}): count ÷ pace each.`:'';
 if(p.obtainedCount==null)return {hours:null,basis:'Acquisition count is not recorded. Current Hiscores are not time to obtain this pet.'};
 const unit=acquisitionUnit(p),m=receivedMethod(p),start=p.obtainedStartCount??0;
 const pace=(unit==='XP'||unit==='level')?(p.historicalXph??(m?.unit==='XP'?m.kph:null)):(m?.unit===unit?m.kph:null);
 if(!pace)return {hours:null,basis:'Choose the received-from method and a matching hourly pace, or enter hours already spent.'};
 if(extra===null)return {hours:null,basis:'Add a pace to each of your other methods with a count, or enter hours already spent.'};
 const assumption=p.obtainedStartCount==null?' Assumes the hunt started at 0; enter the starting count to exclude earlier progress.':'';
 if(unit==='level'){
  const low=xpAtLevel(p.obtainedCount),high=p.obtainedCount===99?200_000_000:xpAtLevel(p.obtainedCount+1)-1;
  if(start>high)return {hours:null,basis:'Starting XP exceeds the received-at level.'};
  return {hours:null,range:[Math.max(0,low-start)/pace+extra,(high-start)/pace+extra],basis:`Level ${p.obtainedCount} gives an XP range, not exact XP. Range ÷ ${pace.toLocaleString()} XP/hour.${plus}${assumption}`};
 }
 if(start>p.obtainedCount)return {hours:null,basis:'Starting count exceeds the received-at count.'};
 return {hours:(p.obtainedCount-start)/pace+extra,basis:`(${p.obtainedCount.toLocaleString()} − ${start.toLocaleString()}) ${unit} ÷ ${pace.toLocaleString()} ${unit}/hour.${plus}${assumption}${unit==='XP'?' Only XP earned through the chosen pet-eligible method should count.':''}`};
}

const same=(a:number|null|undefined,b:number|null|undefined)=>a!=null&&b!=null&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b));
/** Moves the retired Historical methods into the pet's own methods ("Your methods"), once, so chance and time come
 * from methods, the acquisition record and hours already spent only. Idempotent: it removes `huntHistory`.
 * - Segments are grouped by method name, unit and rate. A group joins the pet's method with the same name and unit when
 *   its rate matches (or the method has none) and its pace matches (or the method's pace is still a default); otherwise
 *   it becomes a custom method with the segment's label, unit, rate and pace. Counts in a group add up; a group's pace is
 *   the one that keeps its hours (total count ÷ total hours).
 * - Not collected: the group's count becomes the method's count (it was what the chance used).
 * - Collected: the group for the method the pet came from (the received-from method, at its rate when several match;
 *   with no received-from method, the last segment) becomes
 *   the acquisition record when none is saved. Other groups become counts on methods without a hiscores activity, so
 *   they add to the chance and time (see `otherMethods`) and sync never overwrites them. */
export function migrateHuntHistory(p:Pet):Pet {
 const history=(p.huntHistory??[]).filter(s=>s.count!=null&&s.count>0);
 if(!('huntHistory' in p))return p;
 delete p.huntHistory;
 if(!history.length)return p;
 type Group={method:string;unit:string;rate:number|null;segments:HuntSegment[];last:number};
 const groups:Group[]=[];
 history.forEach((s,i)=>{
  let g=groups.find(g=>key(g.method)===key(s.method)&&g.unit===s.unit&&(same(g.rate,s.rate)||g.rate==null&&s.rate==null));
  if(!g)groups.push(g={method:s.method.trim(),unit:s.unit,rate:s.rate,segments:[],last:i});
  g.segments.push(s);g.last=i;
 });
 const received=receivedMethod(p);
 let receivedGroup:Group|undefined;
 if(p.obtained){
  const named=groups.filter(g=>received?key(g.method)===key(received.name)&&g.unit===received.unit:key(g.method)===key(p.obtainedMethod));
  const matching=named.filter(g=>same(g.rate,received?.rate)),pick=matching.length?matching:named;
  receivedGroup=pick.length?pick.reduce((a,b)=>b.last>a.last?b:a):!key(p.obtainedMethod)?groups.reduce((a,b)=>b.last>a.last?b:a):undefined;
 }
 const assigned=new Set<Method>();
 for(const g of groups){
  // A saved acquisition record already is the count for the method the pet came from.
  if(g===receivedGroup&&p.obtainedCount!=null)continue;
  const count=g.segments.reduce((s,x)=>s+x.count!,0);
  const paced=g.segments.every(s=>s.pace);
  const pace=paced?count/g.segments.reduce((s,x)=>s+x.count!/x.pace!,0):null;
  const asAcquisition=g===receivedGroup&&p.obtainedCount==null;
  // A collected pet's other counts must sit on a method sync never refreshes.
  const fits=(m:Method)=>key(m.name)===key(g.method)&&m.unit===g.unit&&!assigned.has(m)
   &&(g.rate==null||m.rate==null||same(m.rate,g.rate))
   &&(pace==null||m.kph==null||same(m.kph,pace)||!m.paceConfirmed)
   &&(!p.obtained||asAcquisition||g===receivedGroup||!m.activity);
  let m=p.methods.find(fits);
  if(!m){
   if(p.methods.length>=100)continue;
   const taken=(name:string)=>p.methods.some(x=>key(x.name)===key(name));
   let name=g.method;for(let n=1;taken(name);n++)name=`${g.method.slice(0,180)} (earlier${n>1?' '+n:''})`;
   m={name,unit:g.unit,kc:null,kph:null,rate:g.rate,activity:null,rateOverride:true,rateConfirmed:false,paceConfirmed:false,source:'Custom estimate'};
   p.methods.push(m);
  }
  if(m.rate==null&&g.rate!=null){m.rate=g.rate;m.rateOverride=true;m.rateConfirmed=false;}
  if(pace!=null&&!same(m.kph,pace)){m.kph=pace;m.paceConfirmed=true;}
  assigned.add(m);
  if(asAcquisition){
   const before={...p};
   Object.assign(p,{obtainedMethod:m.name,obtainedUnit:g.unit,obtainedCount:(p.obtainedStartCount??0)+count});
   if(!validAcquisition(p))Object.assign(p,{obtainedMethod:before.obtainedMethod,obtainedUnit:before.obtainedUnit,obtainedCount:before.obtainedCount});
   else{
    if(g.unit==='XP'&&p.historicalXph!=null&&pace!=null)p.historicalXph=pace;
    continue;
   }
  }
  if(p.name==='Phoenix'&&m.unit==='rolls'){p.crateRolls=count;m.kc=count;continue;}
  m.kc=count;
 }
 return p;
}
