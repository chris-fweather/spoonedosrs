'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Database,Globe,Hammer,Server} from 'lucide-react';
import {PublicHeader,CommunityChat} from '../Community';
import {SupportersPanel} from '../Home';
import {ProfileIdentity} from '../ProfileIdentity';
import {PageHero} from '../PageHero';
import {DiscordMark} from '../DiscordMark';
import {Faq} from '../Faq';
import type {BoardRow} from '@/lib/flair';
import type {SupportStats} from '@/lib/support-stats';
import {num} from '@/lib/ui';
import {DonationPicker} from './DonationPicker';
import {DONATIONS_OPEN} from '@/lib/donation-rules';
import {IS_DEV_ENVIRONMENT} from '@/lib/environment';
import './support.css';

const DISCORD_INVITE='https://discord.gg/spoonedosrs';
/** How a supporter's name reads on the site: the donor suffix and the Supporter title, plus the gilded scimitar from $100. */
const sample=(gilded:boolean)=><ProfileIdentity username="YourName" accountMode={null} staff={null} donation={{amountMinor:gilded?10000:1000,currency:'USD',hidden:false,badge:gilded?'gilded':null,supporter:true}} title="the Generous" earnedTitle="Supporter"/>;
/** The same supporter as a member of the Discord server's role list. */
function DiscordMember({gilded}:{gilded:boolean}){
 return <div className="support-discord" aria-label="Discord preview"><span className="support-discord-role">{gilded?'Gilded supporter':'Supporter'} — 1</span>
  <div className="support-discord-member"><span className="support-discord-avatar"><img src="/brand/rocky-mascot.webp" alt=""/></span><b className={gilded?'is-gilded':'is-silver'}>YourName</b><img className="support-discord-badge" src={gilded?'/icons/ranks/gilded-scimitar.png':'/icons/community/sponsor-coin.png'} alt=""/></div></div>;
}
const TIERS=[
 {id:'supporter',gilded:false,name:'Supporter',price:'Any amount',perks:['The silver coin beside your name','“the Generous” after your name','The Supporter title','A place on the Supporters board','The Supporter role on Discord']},
 {id:'gilded',gilded:true,name:'Gilded supporter',price:'$100 or more in total',perks:['Everything a supporter gets','The gilded scimitar in place of the coin','A gold name on Discord']},
];
const COSTS:[ReactNode,string,string][]=[[<Server key="s" size={20}/>,'Hosting','Every page, sync and board, served worldwide by Cloudflare.'],[<Database key="d" size={20}/>,'Database','Journals, boards and history, kept safe and backed up.'],[<Globe key="g" size={20}/>,'Domain','spoonedosrs.com, renewed every year.'],[<Hammer key="h" size={20}/>,'Time','New features, guides and fixes, built in the open.']];
const FAQ=[['Is anything locked behind a donation?','No. Every feature is free for everyone; supporter perks are cosmetic.'],['Can I keep the amount private?','Yes. Hide it in your account settings and only “Supporter” shows.'],['Can I support someone else?','Yes. Choose their profile, or no one. They can hide the gift.'],['How is the gilded scimitar reached?','Your shown donations add up; it unlocks at $100 USD in total.'],['Where can I see who supports the site?','On the Supporters board, with each supporter’s titles and, if they choose, their total.'],['When do donations open?','Soon. Join the Discord to hear first.']] as const;
/** The supporter count from /api/support/stats (cached ten minutes); null until it loads or when it is unavailable. */
function useSupportStats(){
 const [stats,setStats]=useState<SupportStats|null>(null);
 useEffect(()=>{const abort=new AbortController();
  fetch('/api/support/stats',{signal:abort.signal}).then(r=>r.ok?r.json() as Promise<SupportStats>:null).then(s=>{if(s&&typeof s.supporters==='number')setStats(s);}).catch(()=>{});
  return ()=>abort.abort();},[]);
 return stats;
}
/** Why to support the site, how supporters look on the site and in Discord, where the money goes and who already supports it.
 * Donations are not open yet, so nothing here takes payment. */
export function SupportPage(){
 const [error,setError]=useState(''),[top,setTop]=useState<BoardRow[]|null>(null);
 const stats=useSupportStats();
 useEffect(()=>{const abort=new AbortController();fetch('/api/leaderboard?metric=supporters&page=0',{signal:abort.signal}).then(r=>r.ok?r.json() as Promise<{rows?:BoardRow[]}>:{rows:[]}).then(d=>setTop(d.rows??[])).catch(()=>{if(!abort.signal.aborted)setTop([]);});return()=>abort.abort();},[]);
 return <div className="site"><PublicHeader page="support" onError={setError}/><main className="community-page support-page">{error&&<p role="alert">{error}</p>}
  <PageHero kicker="Keep the journal running" icon="/icons/community/support-coins.png" title="Support Spooned OSRS" text="Free for everyone, kept running by supporters." actions={<>
   <span className="page-hero-stat"><img src="/icons/community/sponsor-coin.png" alt=""/><b>{stats?num(stats.supporters,0):'—'}</b>{stats?.supporters===1?'supporter':'supporters'}</span>
   <a className="btn" href={DISCORD_INVITE} target="_blank" rel="noreferrer"><DiscordMark/>Ask on Discord ↗</a><button type="button" className="btn primary" disabled>Donations open soon</button></>}/>
  <div className="support-tiers">{TIERS.map(t=><section key={t.id} className={'community-panel support-tier'+(t.gilded?' is-gilded':'')}>
   <div className="support-tier-head"><div><h2>{t.name}</h2><span>{t.price}</span></div><img src={t.gilded?'/icons/ranks/gilded-scimitar.png':'/icons/community/sponsor-coin.png'} alt=""/></div>
   <div className="support-preview"><small>On the site</small>{sample(t.gilded)}</div>
   <div className="support-preview"><small>On Discord</small><DiscordMember gilded={t.gilded}/></div>
   <ul>{t.perks.map(p=><li key={p}>{p}</li>)}</ul>
  </section>)}</div>
  {(DONATIONS_OPEN||IS_DEV_ENVIRONMENT)&&<DonationPicker/>}
  <div className="support-columns">
   <section className="community-panel support-where"><h2>Where it goes</h2><div className="support-costs">{COSTS.map(([icon,t,d])=><div key={t}><span className="support-cost-icon">{icon}</span><b>{t}</b><p>{d}</p></div>)}</div><p className="support-free"><img src="/icons/community/sponsor-coin.png" alt=""/>Every coin goes back into the site.</p></section>
   <SupportersPanel rows={top} title="Our supporters" pageSize={5}/>
  </div>
  <section className="community-panel"><h2>Questions</h2><Faq items={FAQ}/></section>
  <CommunityChat/>
 </main></div>;
}
