'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {RankIcon} from '../StaffBadge';
import {STAFF_LABEL,STAFF_TONE,type StaffRole} from '@/lib/staff-policy';
import type {CreditsPeople as People} from '@/lib/credits';
import './credits.css';

const RANKS:StaffRole[]=['owner','admin','moderator','helper'];
const PLURAL:Record<StaffRole,string>={owner:'Owner',admin:'Admins',moderator:'Moderators',helper:'Helpers'};
const month=(iso:string|null)=>iso?new Date(iso).toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}):null;
const profile=(name:string)=>'/player/'+encodeURIComponent(name);

/** A credited person: their public name, linking to their profile, in their rank colour with its scimitar. */
function Person({name,role}:{name:string;role?:StaffRole|null}){
 return <a className={'credits-person'+(role?' '+STAFF_TONE[role]:'')} href={profile(name)} title={role?STAFF_LABEL[role]:undefined}>{role&&<RankIcon staff={{role,prefix:null}}/>}<b>{name}</b></a>;
}

/** "N guides": hovering or focusing it (or tapping it on a phone) opens a small card with each guide as a link. */
function WriterGuides({name,guides}:{name:string;guides:{id:string;title:string;icon?:string}[]}){
 const [open,setOpen]=useState(false),id=useId(),box=useRef<HTMLSpanElement>(null);
 useEffect(()=>{if(!open)return;const away=(e:PointerEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false);};const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};document.addEventListener('pointerdown',away);document.addEventListener('keydown',esc);return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',esc);};},[open]);
 return <span ref={box} className={'credits-writer-guides'+(open?' is-open':'')}>
  <button type="button" className="credits-count" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(o=>!o)}>{guides.length} {guides.length===1?'guide':'guides'}</button>
  <span className="credits-guides-card" id={id} role="group" aria-label={`Guides by ${name}`}>
   <small className="credits-guides-head">{guides.length} {guides.length===1?'guide':'guides'} by {name}</small>
   {/* "Kraken: the AFK magic boss" reads as the topic, then its subtitle, each on one line. */}
   {guides.map(g=>{const at=g.title.indexOf(':'),topic=at>0?g.title.slice(0,at):g.title,sub=at>0?g.title.slice(at+1).trim():'';return <a key={g.id} href={'/guides?guide='+encodeURIComponent(g.id)} title={g.title}>{g.icon&&<img src={g.icon} alt="" width={20} height={20}/>}<b>{topic}</b>{sub&&<span>{sub}</span>}</a>;})}
  </span>
 </span>;
}

/** Staff, guide writers and retired staff, each under its own heading, from the cached public list (/api/credits). */
export function CreditsPeople(){
 const [people,setPeople]=useState<People|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{const abort=new AbortController();fetch('/api/credits',{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error();setPeople(await r.json() as People);}).catch(()=>{if(!abort.signal.aborted)setFailed(true);});return()=>abort.abort();},[]);
 if(failed)return <><h2 id="people">People</h2><p role="status">The list of people is unavailable right now.</p></>;
 if(!people)return <><h2 id="people">People</h2><div className="credits-people is-loading" role="status" aria-label="Loading people"/></>;
 const groups=RANKS.map(role=>[role,people.staff.filter(s=>s.role===role)] as const).filter(([,list])=>list.length);
 return <div className="credits-people" id="people">
  {groups.length>0&&<section aria-labelledby="credits-staff">
   <h2 id="credits-staff">Staff</h2>
   <dl className="credits-staff">{groups.map(([role,list])=><div key={role}>
    <dt>{list.length>1?PLURAL[role]:STAFF_LABEL[role]}</dt>
    <dd>{list.map(s=><Person key={s.name} name={s.name} role={s.role}/>)}</dd>
   </div>)}</dl>
  </section>}
  {people.writers.length>0&&<section aria-labelledby="credits-writers">
   <h2 id="credits-writers">Guide writers</h2>
   <ul className="credits-list credits-writers">{people.writers.map(w=><li key={w.name}>
    <Person name={w.name} role={w.role}/><WriterGuides name={w.name} guides={w.guides}/>
   </li>)}</ul>
  </section>}
  {people.retired.length>0&&<section aria-labelledby="credits-retired">
   <h2 id="credits-retired">Hall of fame</h2>
   <p className="credits-note">Former staff, with every rank they held.</p>
   <ul className="credits-list credits-retired">{people.retired.map(r=><li key={r.name}>
    <Person name={r.name}/>
    <span className="credits-ranks" aria-label={r.ranks.map(x=>STAFF_LABEL[x.role]).join(', then ')}>{r.ranks.map((x,i)=><span key={i} className={'credits-rank '+STAFF_TONE[x.role]} title={[STAFF_LABEL[x.role],month(x.since)].filter(Boolean).join(' · ')}>{i>0&&<i aria-hidden="true">›</i>}<RankIcon staff={{role:x.role,prefix:null}}/>{STAFF_LABEL[x.role]}</span>)}</span>
    {r.until&&<span className="credits-count">until {month(r.until)}</span>}
   </li>)}</ul>
  </section>}
  {!people.writers.length&&!groups.length&&!people.retired.length&&<><h2 id="people">People</h2><p>Nobody is listed yet.</p></>}
  <p className="credits-note">Guide writers and staff can choose not to be listed in <a href="/account">Account settings</a>.</p>
 </div>;
}
