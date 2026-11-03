"use client";
import {useEffect,useState} from 'react';
type Listed={id:string;guide:{title:string;activity:string}};
let cache:Promise<Listed[]>|null=null;
/** Published guides, fetched once per page view and shared by every link. */
function publishedGuides(){return cache??=fetch('/api/guides').then(r=>r.ok?r.json() as Promise<{guides:Listed[]}>:{guides:[]}).then(d=>d.guides).catch(()=>[]);}
/** The published guide for the first of these activities that has one (a quest, a boss, "Ardougne Diary"…), or null. */
export function usePublishedGuide(...activities:(string|null|undefined)[]){
 const [found,setFound]=useState<{key:string;guide:Listed|null}|null>(null);
 const key=activities.filter((a):a is string=>!!a).map(a=>a.trim().toLowerCase()).join('\n');
 useEffect(()=>{if(!key)return;let live=true;const wanted=key.split('\n');void publishedGuides().then(list=>{if(live)setFound({key,guide:wanted.map(a=>list.find(g=>g.guide.activity.trim().toLowerCase()===a)).find(Boolean)??null});});return()=>{live=false;};},[key]);
 // A guide found for an earlier panel never shows on the next one.
 return key&&found?.key===key?found.guide:null;
}
/** "Read our guide" for a boss, activity, quest or diary, shown only when a published guide covers it.
 * `primary` makes it the panel's main (gold) button, for panels where our guide comes before the Wiki. */
export function GuideLink({activity,compact=false,primary=false}:{activity?:string|null;compact?:boolean;primary?:boolean}){
 const guide=usePublishedGuide(activity);
 return guide?<OurGuideButton guide={guide} compact={compact} primary={primary}/>:null;
}
export function OurGuideButton({guide,compact=false,primary=false}:{guide:Listed;compact?:boolean;primary?:boolean}){
 return <a className={'btn sm guide-link'+(primary?' primary':'')+(compact?' is-compact':'')} href={'/guides?guide='+encodeURIComponent(guide.id)} title={guide.guide.title}><img src="/icons/navigation/collection-log-icon.png" alt=""/>{compact?'Guide':'Read our guide'}</a>;
}
