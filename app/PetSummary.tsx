'use client';
import type {Journal, Pet} from '@/lib/model';
import {luckRanking, petSummary} from '@/lib/pet-luck';
import {num, pct} from '@/lib/ui';
import './pet-summary.css';

/** Hours as the sheet shows luck: +12.3 h lucky, −40 h unlucky. */
export const luckHours=(h:number)=>`${h>0?'+':h<0?'−':''}${num(Math.abs(h))} h`;
const tone=(h:number)=>h>0?'good':h<0?'bad':'';

/** The summary tiles' labels, shared with the loading skeleton. */
export const PET_SUMMARY_LABELS=['Overall luck','Pets','Progress','Total hours','Hours gained','Hours left'] as const;

/** The account's pet hours at a glance, worked out like PetCord's pet hours sheet (lib/pet-luck.ts). */
export function PetSummary({journal,known}:{journal:Journal;known:boolean}){
 const s=petSummary(journal);
 const tiles:[string,string,string,string?][]=known?[
  ['Overall luck',luckHours(s.luck),s.missingCounts?`${s.missingCounts} pets need a count`:s.luck>=0?'hours lucky':'hours unlucky',tone(s.luck)],
  ['Pets',`${s.obtained}/${s.pets}`,`${s.pets-s.obtained} left`],
  ['Progress',s.progress===null?'—':pct(s.progress),'by expected hours'],
  ['Total hours',num(s.totalHours,0),'efficient hours spent'],
  ['Hours gained',num(s.hoursGained,0),'expected, pets you have'],
  ['Hours left',num(s.hoursLeft,0),'expected, pets to go'],
 ]:[['Overall luck','—','Sync collection progress'],['Pets','—',`${s.pets} in the catalogue`],['Progress','—',''],['Total hours','—',''],['Hours gained','—',''],['Hours left','—','']];
 // No heading row: the tiles speak for themselves. The method is credited on /credits.
 return <section className="pet-summary" aria-label="Pet summary">
  <div className="pet-summary-grid">{tiles.map(([k,v,note,t])=><div key={k}><span>{k}</span><b className={t}>{v}</b>{note&&<small>{note}</small>}</div>)}</div>
 </section>;
}

/** Obtained pets ranked by luck: expected hours minus the efficient hours they took. */
export function LuckHunts({journal,onOpen,lucky,limit=7}:{journal:Journal;onOpen:(p:Pet)=>void;lucky:boolean;limit?:number}){
 const all=luckRanking(journal),rows=(lucky?all.filter(r=>r.luck!>0):all.filter(r=>r.luck!<0).reverse()).slice(0,limit);
 const max=Math.max(...rows.map(r=>Math.abs(r.luck!)),1);
 return <section className="sec">
  <div className="sec-h"><h3>{lucky?'Luckiest pets':'Unluckiest pets'}</h3><span className="muted sm">hours {lucky?'under':'over'} expected</span></div>
  {!rows.length&&<p className="muted">{all.length?`No ${lucky?'lucky':'unlucky'} pets yet.`:'Add the count you got each pet at to see this.'}</p>}
  <div className="dry">{rows.map(r=><button type="button" key={r.pet.id} className="dry-row" onClick={()=>onOpen(r.pet)}>
   <img src={`/pets/${r.pet.id}.png`} alt="" loading="lazy"/>
   <span className="dry-name"><b>{r.pet.name}</b><small>{num(r.spent!)} of {num(r.expected!)} h{r.chance!==null?` · ${pct(r.chance)}`:''}</small></span>
   <span className="dry-track"><b className={lucky?'good':'bad'} style={{width:`${Math.abs(r.luck!)/max*100}%`}}/></span>
   <span className={`dry-val ${lucky?'good':'bad'}`}>{luckHours(r.luck!)}</span>
  </button>)}</div>
 </section>;
}
