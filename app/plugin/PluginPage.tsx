'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {Copy,Search} from 'lucide-react';
import {PublicHeader} from '../Community';
import {PageHero} from '../PageHero';
import {DiscordMark} from '../DiscordMark';
import {Faq} from '../Faq';
import {PLUGIN_ON_HUB} from '@/lib/plugin-page';
import type {PluginStats} from '@/lib/plugin-stats';
import {num} from '@/lib/ui';
import './plugin.css';

const DISCORD_INVITE='https://discord.gg/spoonedosrs';
type SyncState='synced'|'included'|'planned';
const SYNC_STATE:Record<SyncState,string>={synced:'Synced',included:'Included',planned:'Planned'};
/** What the plugin syncs today, and what is planned. "Synced" is only what lib/plugin-sync.ts merges; "Included" is
 * built on top of it (player lookup reads public profiles). */
const SYNCS:{icon:string;name:string;text:string;state:SyncState}[]=[
 {icon:'/items/12646.png',name:'Pets',text:'The day it dropped, with your kill count or XP.',state:'synced'},
 {icon:'/icons/navigation/collection-log-icon.png',name:'Collection log',text:'Every slot when you open the log; new items dated.',state:'synced'},
 {icon:'/icons/navigation/stats-icon.png',name:'Skills',text:'XP and levels, plus your account type.',state:'synced'},
 {icon:'/icons/navigation/quest-point-icon.png',name:'Quests',text:'The quests you have started and finished.',state:'synced'},
 {icon:'/icons/game/minigame.png',name:'Minigames & bosses',text:'Kill and minigame counts behind each pet.',state:'synced'},
 {icon:'/icons/community/friends-list.png',name:'Player lookup',text:'Right-click a player to see their public profile.',state:'included'},
 {icon:'/icons/navigation/combat-achievements.png',name:'Combat tasks',text:'Each task you have completed.',state:'planned'},
 {icon:'/icons/navigation/achievement-diaries-icon.png',name:'Diary tasks',text:'Each task, not only finished tiers.',state:'planned'},
];
const RL='/icons/runelite/';
/** The plugin's own icon: RuneLite's logo (RuneLite client resources, BSD 2-Clause), the same in the page title and in
 * every RuneLite mock that shows the plugin, so players can spot it in the Plugin Hub and the plugin list. */
const PLUGIN_ICON=RL+'runelite-logo.png';
/** Small sprites drawn at their own size or larger keep crisp pixels; artwork shown smaller than its file does not. */
const pixel=(src:string)=>src.startsWith(RL)&&src!==PLUGIN_ICON||['/icons/plugin/padlock.png','/icons/plugin/ignore-list.png','/icons/plugin/equipment.png'].includes(src)?'is-pixel':undefined;
/** Install steps, each with the RuneLite client icon it refers to (RuneLite client resources, BSD 2-Clause). */
const INSTALL:{mock:ReactNode;text:ReactNode}[]=[
 {mock:<div className="rl-mock rl-sidebar" aria-hidden="true"><span/><span/><span className="is-active"><img src={RL+'config-wrench.png'} alt=""/></span><span/></div>,
  text:<>Click the <img className="rl-inline" src={RL+'config-wrench.png'} alt="wrench"/> <em>wrench</em> in RuneLite&apos;s sidebar to open Configuration.</>},
 {mock:<div className="rl-mock rl-bar" aria-hidden="true"><span className="rl-field"><Search size={12}/></span><span className="is-active"><img src={RL+'plugin-hub.png'} alt=""/></span></div>,
  text:<>Click the <img className="rl-inline" src={RL+'plugin-hub.png'} alt="plug"/> <em>plug</em> at the top to open the Plugin Hub.</>},
 {mock:<div className="rl-mock rl-hub" aria-hidden="true"><span className="rl-field"><Search size={12}/>Spooned</span><span className="rl-row"><img className="rl-plugin-icon" src={PLUGIN_ICON} alt=""/><b>Spooned OSRS</b><i>Install</i></span></div>,
  text:<>Search <em>Spooned</em> and press <em>Install</em>.</>},
 {mock:<div className="rl-mock rl-warn" aria-hidden="true"><img src={RL+'alert.png'} alt=""/><i>Accept</i></div>,
  text:<>RuneLite warns that it sends data to our site. <em>Accept</em> to finish.</>},
];
/** Link steps, each with a small mock of what the player will see. Labels match Account settings (PluginTokens,
 * PluginCharacters); the token and the chat line are examples. The chat is the game's own chatbox (its sprites, a game
 * message in black and the plugin's in RuneLite's red highlight, as a RuneLite plugin's game message shows). */
const LINK:{mock:ReactNode;text:ReactNode}[]=[
 {mock:<div className="link-mock link-site" aria-hidden="true">
   <div className="link-site-head"><b>RuneLite plugin</b><span className="link-btn primary">Connect a device</span></div>
   <div className="link-token"><code>SPN-7K2Q-••••-••••-3F9A</code><span className="link-btn"><Copy size={11}/></span></div>
   <small>Shown once. Keep it private, like a password.</small>
  </div>,
  text:<>In <a className="link" href="/account?tab=runelite">Account settings</a>, on the <em>RuneLite</em> tab, press <em>Connect a device</em> and copy the token.</>},
 {mock:<div className="link-mock link-rl" aria-hidden="true">
   <div className="link-rl-head"><img className="rl-plugin-icon" src={PLUGIN_ICON} alt=""/><b>Spooned OSRS</b><img className="link-rl-wrench" src={RL+'config-wrench.png'} alt=""/></div>
   <div className="link-rl-row"><span>Token</span><span className="link-rl-field">SPN-7K2Q-••••<i/></span></div>
  </div>,
  text:<>In RuneLite, open the Spooned plugin&apos;s settings and paste it into <em>Token</em>.</>},
 {mock:<div className="link-mock link-chat" aria-hidden="true">
   <span className="link-chat-tag">Example</span>
   <div className="link-chat-box">
    <p>Welcome to Old School RuneScape.</p>
    <p><b>Spooned:</b> Synced 1,204 log items.</p>
    <p className="link-chat-input">Your name: <i>*</i></p>
   </div>
   <div className="link-chat-tabs"><span>All</span><span>Game</span><span>Public</span><span>Private</span><span>Channel</span></div>
  </div>,
  text:<>Log in to your character. A name linked to you syncs straight away.</>},
 {mock:<div className="link-mock link-site" aria-hidden="true">
   <div className="link-site-head"><b>Your profiles</b><small>Account settings</small></div>
   <div className="link-char"><div><b>Your new name</b><small>Seen by RuneLite · not linked</small></div><span className="link-btn primary">Add</span></div>
  </div>,
  text:<>New name? <em>Add</em> it in <a className="link" href="/account?tab=profiles">Account settings</a>, under <em>Your profiles</em>.</>},
];
const FAQ:[string,ReactNode][]=[
 ['Do I need the plugin?','No. Imports from RuneProfile, TempleOSRS, Wise Old Man and the Hiscores keep working. The plugin adds exact dates and kill counts.'],
 ['Is it safe and allowed?','Plugin Hub plugins are open source and reviewed by RuneLite before they are listed. It only reads what your own game shows you.'],
 ['Does it need my password?','No. It uses a Spooned token. Never enter a RuneScape, Jagex or Discord password into any plugin.'],
 ['Will it change what I entered?','No. Dates and counts you entered stay. When the plugin sees you get a pet or item, it shows the day you got it straight away; you can edit that date or count whenever you like.'],
 ['What if I change my name?','The plugin syncs the name you log in with. Your new name shows under Your profiles in Account settings; add it there.'],
 ['How do I unlink it?',<>Remove the token in <a className="link" href="/account?tab=runelite">Account settings</a>; syncing stops at once. Log out everywhere removes every token.</>],
 ['Does it date items I already had?','No. Opening the log fills in what you own, but only items that drop after you install it get a date.'],
];
/** Common problems, each with a game or RuneLite icon (sources in public/ASSET-SOURCES.txt). */
const FIXES:{icon:string;problem:string;fix:string}[]=[
 {icon:'/icons/navigation/collection-log-icon.png',problem:'Collection log not synced',fix:'Open the collection log in game once. The plugin reads it when it opens.'},
 {icon:'/icons/community/settings-icon.png',problem:'New items not arriving',fix:'In the game settings, search "collection" and turn on New addition notification.'},
 {icon:'/icons/community/friends-list.png',problem:'"Add this character"',fix:'Account settings → Your profiles → Add.'},
 {icon:'/icons/plugin/ignore-list.png',problem:'Linked to another account',fix:'Press Request review there. Staff check it; your drops wait in the plugin.'},
 {icon:'/items/989.png',problem:'Token not accepted',fix:'It was removed or mistyped. Create a new one in Account settings.'},
 {icon:'/icons/plugin/logout-timer.png',problem:'Sync waiting',fix:'A profile syncs at most once a minute. The plugin retries and keeps every event.'},
];
/** What the plugin sends, what it never sends, and what the player controls. */
const DATA:{icon:string;title:string;items:ReactNode[]}[]=[
 {icon:RL+'plugin-hub.png',title:'Sent',items:['Character name and account type','Skill XP, quests and collection log','Time and kill count or XP of each new pet or item','A one-way account code, stored only as a keyed hash and never shown']},
 {icon:'/icons/plugin/padlock.png',title:'Never sent',items:['Passwords or login details','Chat messages','Your bank','Anything about other players; a lookup only reads their public profile']},
 {icon:'/icons/community/settings-icon.png',title:'You control',items:['Turn sections off in the plugin settings','Your profile privacy covers plugin data too',<>Remove the token in <a className="link" href="/account?tab=runelite">Account settings</a> to stop syncing</>]},
];

/** Live counters from /api/plugin/stats (cached ten minutes); "—" until they load or when they are unavailable. */
function usePluginStats(){
 const [stats,setStats]=useState<PluginStats|null>(null);
 useEffect(()=>{const abort=new AbortController();
  fetch('/api/plugin/stats',{signal:abort.signal}).then(r=>r.ok?r.json() as Promise<PluginStats>:null).then(s=>{if(s&&typeof s.connectedAccounts==='number')setStats(s);}).catch(()=>{});
  return ()=>abort.abort();},[]);
 return stats;
}

/** What the RuneLite plugin does, how to install and link it, what it sends, and common questions.
 * Shown only while PLUGIN_PAGE is on; the wording follows PLUGIN_ON_HUB. */
export function PluginPage(){
 const [error,setError]=useState('');
 const stats=usePluginStats();
 return <div className="site"><PublicHeader page="plugin" onError={setError}/><main className="community-page plugin-page">{error&&<p role="alert">{error}</p>}
  <PageHero kicker="RuneLite plugin" icon={PLUGIN_ICON} iconClass="page-title-icon-wide" title="Spooned OSRS plugin" text="Your pets and collection log, synced as you play." actions={<>
   <span className="page-hero-stat plugin-stat"><img src="/icons/runelite/plugin-hub.png" alt=""/><b>{stats?num(stats.connectedAccounts,0):'—'}</b>{stats?.connectedAccounts===1?'connected account':'connected accounts'}</span>
   {PLUGIN_ON_HUB?<a className="btn primary" href="/account?tab=runelite">Create a token</a>:<a className="btn" href={DISCORD_INVITE} target="_blank" rel="noreferrer"><DiscordMark/>Ask on Discord ↗</a>}
   <span className={'tag page-hero-badge '+(PLUGIN_ON_HUB?'good':'warn')}>{PLUGIN_ON_HUB?'On the RuneLite Plugin Hub':'Coming soon to the RuneLite Plugin Hub'}</span>
  </>}/>
  <section className="community-panel"><h2>What it syncs</h2>
   <ul className="plugin-syncs">{SYNCS.map(s=><li key={s.name} className={'is-'+s.state}><img className={pixel(s.icon)} src={s.icon} alt=""/><span className="plugin-sync-state">{SYNC_STATE[s.state]}</span><b>{s.name}</b><span className="plugin-sync-text">{s.text}</span></li>)}</ul>
  </section>
  <section className="community-panel"><h2>Install</h2>{!PLUGIN_ON_HUB&&<p className="plugin-note">Not on the Plugin Hub yet. These steps work once it is approved.</p>}
   <ol className="plugin-install">{INSTALL.map((s,i)=><li key={i}>{s.mock}<div className="plugin-install-text"><b>{i+1}</b><span>{s.text}</span></div></li>)}</ol>
  </section>
  <section className="community-panel"><h2>Link your account</h2>
   <ol className="plugin-install plugin-link">{LINK.map((s,i)=><li key={i}>{s.mock}<div className="plugin-install-text"><b>{i+1}</b><span>{s.text}</span></div></li>)}</ol>
  </section>
  <section className="community-panel plugin-data"><h2>Your data</h2>
   <div className="plugin-data-cards">{DATA.map(d=><div key={d.title}><h3><img className={pixel(d.icon)} src={d.icon} alt=""/>{d.title}</h3><ul>{d.items.map((item,i)=><li key={i}>{item}</li>)}</ul></div>)}</div>
   <p className="plugin-note">Like any website, our host sees your IP address. See the <a className="link" href="/privacy">Privacy</a> page.</p>
  </section>
  <section className="community-panel"><h2>Questions</h2><Faq items={FAQ}/></section>
  <section className="community-panel"><h2>Troubleshooting</h2>
   <ul className="plugin-fixes">{FIXES.map(f=><li key={f.problem}><span className="plugin-fix-icon" aria-hidden="true"><img className={pixel(f.icon)} src={f.icon} alt=""/></span><b>{f.problem}</b><span>{f.fix}</span></li>)}</ul>
  </section>
 </main></div>;
}
