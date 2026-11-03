'use client';
import {useEffect,useState,type MouseEvent} from 'react';
import {ChevronDown} from 'lucide-react';
import type {GuideHeading} from '@/lib/guides';

/** Guides with fewer headings than this read fine without a contents list. */
export const CONTENTS_MIN=3;
// The site header is sticky: a heading counts as reached once it passes just under it.
const READ_LINE=140;

/** Which heading the reader is in: the last one above the reading line. */
function useCurrent(headings:GuideHeading[]){
 const key=headings.map(h=>h.anchor).join(' '),[current,setCurrent]=useState(headings[0]?.anchor??'');
 useEffect(()=>{
  const anchors=key.split(' ');let frame=0;
  const read=()=>{frame=0;let at=anchors[0];for(const a of anchors){const el=document.getElementById(a);if(el&&el.getBoundingClientRect().top<=READ_LINE)at=a;}setCurrent(at);};
  const onScroll=()=>{if(!frame)frame=requestAnimationFrame(read);};
  read();window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('resize',onScroll);
  return()=>{window.removeEventListener('scroll',onScroll);window.removeEventListener('resize',onScroll);if(frame)cancelAnimationFrame(frame);};
 },[key]);
 // Opening a link with #heading lands on it once the guide has rendered.
 useEffect(()=>{const hash=decodeURIComponent(window.location.hash.slice(1));if(hash&&key.split(' ').includes(hash))document.getElementById(hash)?.scrollIntoView({block:'start'});},[key]);
 return [current,setCurrent] as const;
}

/** The guide's headings: a sticky list beside the guide on wide screens, a Contents dropdown above it on phones.
 * A link scrolls smoothly to its heading and puts it in the address bar, so the step can be shared. */
export function GuideContents({headings}:{headings:GuideHeading[]}){
 const [current,setCurrent]=useCurrent(headings),[open,setOpen]=useState(false);
 if(headings.length<CONTENTS_MIN)return null;
 function go(e:MouseEvent,anchor:string){
  e.preventDefault();const el=document.getElementById(anchor);if(!el)return;
  const smooth=!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({behavior:smooth?'smooth':'auto',block:'start'});
  window.history.replaceState(window.history.state,'','#'+anchor);setCurrent(anchor);setOpen(false);
 }
 const links=<ol>{headings.map(h=><li key={h.anchor} className={h.level===3?'is-sub':''}><a href={'#'+h.anchor} aria-current={current===h.anchor?'location':undefined} title={h.text} onClick={e=>go(e,h.anchor)}>{h.text}</a></li>)}</ol>;
 const now=headings.find(h=>h.anchor===current)??headings[0];
 return <>
  <nav className="guide-contents" aria-label="Contents"><b>Contents</b>{links}</nav>
  <nav className={'guide-contents-phone'+(open?' is-open':'')} aria-label="Contents">
   <button type="button" aria-expanded={open} onClick={()=>setOpen(!open)}><b>Contents</b><span title={now.text}>{now.text}</span><ChevronDown size={16} aria-hidden="true"/></button>
   {open&&links}
  </nav>
 </>;
}
