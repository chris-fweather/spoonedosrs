"use client";
import {useMemo,useState} from 'react';
import type {Journal} from '@/lib/model';
import {collectionEvents,type CollectionEvent,type TimelineKind} from '@/lib/collection-history';
import {timelineSpan,type TimelineRange} from '@/lib/collection-timeline';
import {collectedDate} from '@/lib/pet-presentation';
import {num} from '@/lib/ui';
import {ChipRow,SortMenu} from './Controls';
import {HoverTip} from './HoverTip';
import {CollectionLollipops} from './CollectionLollipops';
import './collection-timeline.css';

const RANGES:{value:TimelineRange;label:string}[]=[{value:'all',label:'All time'},{value:'year',label:'Past year'},{value:'month',label:'Past 30 days'}];
const KINDS:[TimelineKind,string][]=[['pets','Pets'],['log','Collection log'],['skills','Skills']];
const when=(e:CollectionEvent)=>`${e.approximate?'~':''}${collectedDate(e.date)}`;

/** The Player timeline: every dated pet, log slot and skill milestone as a lollipop on a zoomable timeline; the
 * chosen day's entries show below. Each kind toggles on its own; at least one stays on. */
export function CollectionTimeline({journal}:{journal:Journal}) {
 const [kinds,setKinds]=useState<TimelineKind[]>(['pets','log','skills']),[range,setRange]=useState<TimelineRange>('all'),[chosen,setChosen]=useState<CollectionEvent[]|null>(null);
 const history=useMemo(()=>collectionEvents(journal),[journal]);
 const events=useMemo(()=>history.events.filter(e=>kinds.includes(e.kind)),[history,kinds]);
 const toggle=(kind:TimelineKind)=>{setKinds(on=>on.includes(kind)?(on.length>1?on.filter(k=>k!==kind):on):[...on,kind]);setChosen(null);};
 const full=useMemo(()=>timelineSpan(events.map(e=>Date.parse(e.date+'T12:00:00Z')),range),[events,range]);
 // With nothing dated yet, a faded example built from this account's own pets shows what the timeline will look like.
 const example=useMemo(()=>exampleEvents(journal),[journal]);
 // The latest day's collections show until a lollipop is chosen.
 const lastDay=events.at(-1)?.date,shown=chosen??events.filter(e=>e.date===lastDay);
 return <section className="panel completion-panel collection-timeline">
  <div className="ph"><h2>Player timeline</h2>
   <div className="timeline-controls">
    <ChipRow label="Shown on the timeline" chips={KINDS.map(([value,label])=>({id:value,label,pressed:kinds.includes(value),onClick:()=>toggle(value)}))}/>
    <SortMenu label="Time range" value={range} onChange={value=>{setRange(value as TimelineRange);setChosen(null);}} options={RANGES}/>
   </div>
  </div>
  {events.length?<>
   <CollectionLollipops events={events} full={full} selected={chosen?.[0]?.id??null} onSelect={setChosen} initialZoom={range==='all'?Math.SQRT1_2:1}/>
   <div className="timeline-period"><span>{dayRange(shown)}</span><small>{periodCount(shown)}</small></div>
   {shown.some(e=>e.kind!=='skills')&&<div className="cl-items timeline-items">{shown.filter(e=>e.kind!=='skills').map(e=><HoverTip key={e.id} className="cl-item got" label={`${e.name}, ${collectedDate(e.date)}`} content={<span className="timeline-tip"><b>{e.name}</b><small>{collectedDate(e.date)}</small></span>}><img src={e.image} alt="" loading="lazy"/></HoverTip>)}</div>}
   {shown.some(e=>e.kind==='skills')&&<ul className="timeline-skills">{shown.filter(e=>e.kind==='skills').map(e=><li key={e.id} title={`${e.name}, ${e.approximate?'about ':''}${collectedDate(e.date)}`}><img src={e.image} alt="" loading="lazy"/><span>{e.name}</span>{e.approximate&&!shown.every(x=>x.approximate)&&<small>approx.</small>}</li>)}</ul>}
  </>:<div className="timeline-example" aria-label="Example timeline">
   <CollectionLollipops events={example} full={timelineSpan(example.map(e=>Date.parse(e.date+'T12:00:00Z')),'all')} selected={null} onSelect={()=>{}}/>
   <p className="timeline-example-note"><b>An example of your timeline</b><span>Add the date you got a pet or log slot and it appears here.</span></p>
  </div>}
  {history.undated>0&&<p className="fine timeline-undated">{num(history.undated,0)} without a date</p>}
 </section>;
}

const dayRange=(items:CollectionEvent[])=>{const first=items[0],last=items.at(-1)??first;if(!first)return '';return first.date===last.date?when(first):`${when(first)} – ${when(last)}`;};
const periodCount=(items:CollectionEvent[])=>{
 const got=items.filter(e=>e.kind!=='skills').length,levels=items.length-got;
 return <>{got>0&&<><b>{num(got,0)}</b> collected</>}{got>0&&levels>0&&' · '}{levels>0&&<><b>{num(levels,0)}</b> {levels===1?'milestone':'milestones'}</>}</>;
};

/** Up to twelve of the account's pets (collected first) spread over the past year, for the empty-state preview only. */
function exampleEvents(journal:Journal):CollectionEvent[]{
 const pets=[...journal.pets].sort((a,b)=>Number(b.obtained)-Number(a.obtained)).slice(0,12),now=Date.now();
 return pets.map((p,i)=>({id:'example-'+p.id,kind:'pets' as const,name:p.name,image:`/pets/${p.id}.png`,date:new Date(now-(pets.length-i)*29*864e5+(i%3)*5*864e5).toISOString().slice(0,10)}));
}
