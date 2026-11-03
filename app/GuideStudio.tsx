"use client";
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ChevronLeft,Eye,PenLine,Plus,Search} from 'lucide-react';
import {IllustratedSelect} from './IllustratedSelect';
import {GuideDocument,GuideDocumentBlocks} from './GuideDocument';
import {GuideContents,CONTENTS_MIN} from './GuideContents';
import {GuideSetup,RequirementBadges,FormattedText} from './GuideParts';
import {PublicHeader} from './Community';
import {DiscordMark} from './DiscordMark';
import {PageHero} from './PageHero';
import {Person,StateLabel,timeAgo} from './StaffWorkspace';
import {guideHeadings,type Guide} from '@/lib/guides';
import {GUIDE_LAYOUTS,type GuideLayoutId} from '@/lib/guide-templates';
import {GUIDE_CATEGORIES,guideCategory,guideTopic,guideTopics,guideTopicImage,suggestedLayout,type GuideCategory} from '@/lib/guide-topics';
import {STAFF_LABEL,STAFF_TONE,type StaffRole} from '@/lib/staff-policy';
import {RankIcon} from './StaffBadge';
import './guides.css';
type Entry={id:string;guide:Guide;revision:number;publishedAt:string|null;changesPending?:boolean;updatedAt?:string;canEdit:boolean;authorId:string};
type Dashboard={viewer:{id:string;role:StaffRole;canPublish:boolean;canUpload?:boolean};guides:Entry[]};
type Byline={author:{name:string;role:string|null}|null;publishedAt:string;updatedAt?:string};
const DAY=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'});
const day=(iso:string)=>DAY.format(new Date(iso));
/** Who wrote a guide and when: the author links to their profile; the edit date shows only when it differs from the publish date. */
function GuideByline({byline:b,compact}:{byline:Byline;compact?:boolean}){
 const edited=b.updatedAt&&day(b.updatedAt)!==day(b.publishedAt);
 const role=b.author?.role&&b.author.role in STAFF_LABEL?b.author.role as StaffRole:null;
 const name=b.author?<>{role&&<RankIcon staff={{role,prefix:null}}/>}{compact?<b>{b.author.name}</b>:<a href={'/player/'+encodeURIComponent(b.author.name)}>{b.author.name}</a>}</>:<b>Spooned staff</b>;
 return <p className="guide-byline"><span className={'guide-byline-author '+(role?STAFF_TONE[role]:'')}>{name}</span><span>{compact?'':'Published '}<time dateTime={b.publishedAt}>{day(b.publishedAt)}</time></span>{edited&&!compact&&<span>Updated <time dateTime={b.updatedAt}>{day(b.updatedAt!)}</time></span>}</p>;
}
/** A guide as readers see it; three or more headings add the contents list beside it (above it on phones). */
function GuideArticle({guide,byline}:{guide:Guide;byline?:Byline}){const headings=guide.blocks?guideHeadings(guide.blocks):[],article=<GuideArticleBody guide={guide} byline={byline}/>;return headings.length>=CONTENTS_MIN?<div className="guide-reader"><GuideContents headings={headings}/>{article}</div>:article;}
function GuideArticleBody({guide,byline}:{guide:Guide;byline?:Byline}){const topic=guideTopicImage(guide.activity);return <article className="community-panel guide-article"><header className={topic?'has-topic':''}>{topic&&<img className="guide-article-topic" src={topic} alt=""/>}<span className="kicker">{guide.activity}</span><h2>{guide.title||'Your guide title'}</h2>{byline&&<GuideByline byline={byline}/>}<p className="guide-deck">{guide.summary||'A short introduction to this guide.'}</p></header>{guide.blocks?<GuideDocumentBlocks guide={guide}/>:<>{(guide.requirements||guide.requiredQuests?.length||guide.requiredDiaries?.length||guide.requiredItems?.length)?<section><h3>Before you begin</h3><RequirementBadges guide={guide}/><FormattedText text={guide.requirements}/></section>:null}<GuideSetup guide={guide}/><section><h3>Strategy</h3><FormattedText text={guide.strategy}/></section></>}</article>;}
type PublicEntry={id:string;guide:Guide}&Byline;
const DISCORD_INVITE='https://discord.gg/spoonedosrs';
const groupOf=(g:Guide)=>GUIDE_CATEGORIES.find(c=>c.id===guideCategory(g.activity))!;
/** A guide card, shared by the public page and the staff workshop: large topic art, a one-line title, the summary (two lines
 * at most), one line of facts (the topic, its group when the list isn't already split by group, a quest's difficulty, the
 * highest required level and the first required quest), then a footer: the byline, or the draft state for staff. */
function GuideTile({guide:g,footer,showCategory,onOpen,empty='',className=''}:{guide:Guide;footer:ReactNode;showCategory:boolean;onOpen:()=>void;empty?:string;className?:string}){
 const topic=guideTopic(g.activity),group=groupOf(g);
 const skill=[...(g.requiredSkills??[])].sort((a,b)=>b.level-a.level)[0],quest=g.requiredQuests?.[0];
 return <button type="button" className={'guide-tile '+className} title={g.title} onClick={onOpen}>
  <span className="guide-tile-art"><img src={guideTopicImage(g.activity)??group.icon} alt=""/></span>
  <span className="guide-tile-body">
   <b className="guide-tile-title">{g.title||'Untitled guide'}</b>
   <span className={'guide-tile-summary'+(g.summary?'':' is-empty')}>{g.summary||empty}</span>
   <span className="guide-tile-meta">
    {g.activity&&<span>{g.activity}</span>}
    {showCategory&&group.id!=='other'&&<span><img src={group.icon} alt=""/>{group.label}</span>}
    {topic?.badge&&topic.detail&&<span><img src={topic.badge} alt=""/>{topic.detail}</span>}
    {skill&&<span><img src={`/icons/skills/${skill.skill.toLowerCase()}.png`} alt=""/>{skill.level} {skill.skill}</span>}
    {quest&&<span><img src="/ui/quest-point-icon.png" alt=""/>{quest}</span>}
   </span>
  </span>
  {footer}
 </button>;
}
/** Guide cards while the list loads: the loaded card's art, title, two summary lines, facts and footer, so nothing moves. */
function GuideTilesLoading(){return <div className="guide-list" role="status" aria-busy="true"><span className="sr-only">Loading guides…</span>{Array.from({length:4},(_,i)=><div key={i} className="guide-tile guide-tile-skeleton" aria-hidden="true"><span className="guide-tile-art"><i/></span><span className="guide-tile-body"><b className="guide-tile-title"><i/></b><span className="guide-tile-summary"><i/><i/></span><span className="guide-tile-meta"><span><i/></span></span></span><p className="guide-byline"><span><i/></span><span><i/></span></p></div>)}</div>;}
/** Guides matching a search, how many fall in each group, and those in the chosen group. */
function filterGuides<T>(rows:T[],guideOf:(row:T)=>Guide,q:string,category:GuideCategory|'all'){
 const needle=q.trim().toLowerCase(),matching=rows.filter(r=>{const g=guideOf(r);return `${g.title} ${g.activity} ${g.summary}`.toLowerCase().includes(needle);});
 const counts=new Map<GuideCategory,number>();for(const r of matching){const c=guideCategory(guideOf(r).activity);counts.set(c,(counts.get(c)??0)+1);}
 return {needle,matching,counts,shown:category==='all'?matching:matching.filter(r=>guideCategory(guideOf(r).activity)===category)};
}
/** Group chips with counts (groups with no guides are left out) and the search box, on one line; the chips scroll on phones. */
function GuideFilters({counts,total,category,onCategory,q,onQuery,placeholder}:{counts:Map<GuideCategory,number>|null;total:number|null;category:GuideCategory|'all';onCategory:(id:GuideCategory|'all')=>void;q:string;onQuery:(q:string)=>void;placeholder:string}){
 return <div className="guides-tools">
  <div className="guide-filter" role="group" aria-label="Filter by group">
   <button type="button" aria-pressed={category==='all'} onClick={()=>onCategory('all')}>All <b>{total??'—'}</b></button>
   {counts&&GUIDE_CATEGORIES.filter(c=>counts.get(c.id)||c.id===category).map(c=><button key={c.id} type="button" aria-pressed={category===c.id} onClick={()=>onCategory(category===c.id?'all':c.id)}><img src={c.icon} alt=""/>{c.label} <b>{counts.get(c.id)??0}</b></button>)}
  </div>
  <label className="board-filter guides-search"><Search size={16} aria-hidden="true"/><input aria-label="Find a guide" value={q} onChange={e=>onQuery(e.target.value)} placeholder={placeholder}/></label>
 </div>;
}
/** Public guides: the filters, then one card per published guide, in sections by group when nothing is filtered. A card opens
 * the guide (/guides?guide=id); the chosen group is kept as ?category=. */
export function Guides(){
 const [rows,setRows]=useState<PublicEntry[]>([]),[error,setError]=useState(''),[loaded,setLoaded]=useState(false),[q,setQ]=useState(''),[open,setOpen]=useState<string|null>(null),[category,setCategory]=useState<GuideCategory|'all'>('all');
 useEffect(()=>{const params=new URLSearchParams(window.location.search);setQ(params.get('q')??params.get('activity')??'');setOpen(params.get('guide'));
  const c=params.get('category');if(GUIDE_CATEGORIES.some(x=>x.id===c))setCategory(c as GuideCategory);
  const back=()=>setOpen(new URLSearchParams(window.location.search).get('guide'));window.addEventListener('popstate',back);
  fetch('/api/guides').then(async r=>{const b=await r.json() as {error?:string;guides:PublicEntry[]};if(!r.ok)throw Error(b.error);setRows(b.guides);}).catch(e=>setError(e.message)).finally(()=>setLoaded(true));
  return()=>window.removeEventListener('popstate',back);},[]);
 const show=(id:string|null)=>{const url=new URL(window.location.href);url.hash='';if(id)url.searchParams.set('guide',id);else url.searchParams.delete('guide');window.history.pushState(null,'',url);setOpen(id);window.scrollTo({top:0});};
 const pick=(next:GuideCategory|'all')=>{const url=new URL(window.location.href);if(next==='all')url.searchParams.delete('category');else url.searchParams.set('category',next);window.history.replaceState(null,'',url);setCategory(next);};
 const reading=open?rows.find(r=>r.id===open):undefined;
 const {needle,matching,counts,shown}=filterGuides(rows,r=>r.guide,q,category);
 // Sections only help when the whole list is showing and it spans more than one group.
 const sections=category==='all'&&!needle&&counts.size>1;
 const grid=(list:PublicEntry[])=><div className="guide-list">{list.map(row=><GuideTile key={row.id} guide={row.guide} showCategory={category==='all'&&!sections} onOpen={()=>show(row.id)} footer={<GuideByline byline={row} compact/>}/>)}</div>;
 return <div className="site"><PublicHeader page="guides" onError={setError}/><main className="community-page guides-page">
  {error&&<p role="alert">{error}</p>}
  {reading?<><button type="button" className="btn ghost guide-back" onClick={()=>show(null)}><ChevronLeft size={16} aria-hidden="true"/>All guides</button><GuideArticle guide={reading.guide} byline={reading}/></>:<>
   <PageHero kicker="From the community" icon="/icons/navigation/collection-log-icon.png" title="Guides" text="Strategies, gear and inventories, written by our staff." actions={<><span className="page-hero-stat"><img src="/icons/navigation/collection-log-icon.png" alt=""/><b>{loaded?rows.length:'—'}</b>{rows.length===1?'guide':'guides'}</span><a className="btn" href={DISCORD_INVITE} target="_blank" rel="noreferrer"><DiscordMark/>Help write guides ↗</a></>}/>
   <GuideFilters counts={loaded?counts:null} total={loaded?matching.length:null} category={category} onCategory={pick} q={q} onQuery={setQ} placeholder="Search guides…"/>
   {shown.length?sections?GUIDE_CATEGORIES.filter(c=>counts.get(c.id)).map(c=><section key={c.id} className="guide-section" aria-labelledby={'guides-'+c.id}>
     <h2 id={'guides-'+c.id}><img src={c.icon} alt=""/>{c.label}<small>{counts.get(c.id)}</small></h2>
     {grid(matching.filter(r=>guideCategory(r.guide.activity)===c.id))}
    </section>):grid(shown)
   :loaded?<section className="community-panel guides-empty">{rows.length?'No guides match that search.':'The first guides are on their way.'}</section>:<GuideTilesLoading/>}
  </>}
 </main></div>;
}

const TOPICS=guideTopics.map(t=>({value:t.name,label:t.name,image:t.image,detail:t.detail,badge:t.badge}));
/** The short start of a guide: a title, what it is about, and the layout to start from (suggested from the topic). */
function NewGuide({onCreate,onCancel,focus}:{onCreate:(guide:Guide)=>void;onCancel?:()=>void;focus:boolean}){
 const [title,setTitle]=useState(''),[activity,setActivity]=useState(''),[layout,setLayout]=useState<GuideLayoutId>('blank'),field=useRef<HTMLInputElement>(null),ready=title.trim().length>=3&&!!activity;
 useEffect(()=>{if(focus)field.current?.focus();},[focus]);
 function pick(topic:string){setActivity(topic);setLayout(suggestedLayout(topic));}
 return <form className="staff-card guide-new" onSubmit={e=>{e.preventDefault();if(ready)onCreate(GUIDE_LAYOUTS.find(l=>l.id===layout)!.build(title.trim(),activity));}}>
  <h3>New guide</h3>
  <label className="picture-field"><span>Title</span><input ref={field} required minLength={3} maxLength={100} placeholder="e.g. Nex with a small team" value={title} onChange={e=>setTitle(e.target.value)}/></label>
  <IllustratedSelect label="Topic" placeholder="Choose a boss, activity, quest, diary or combat achievements" value={activity} options={TOPICS} onChange={pick}/>
  <div className="picture-field"><span>Layout</span><div className="guide-layouts" role="radiogroup" aria-label="Layout">{GUIDE_LAYOUTS.map(l=><button key={l.id} type="button" role="radio" aria-checked={layout===l.id} onClick={()=>setLayout(l.id)}><img src={l.icon} alt=""/><span><b>{l.label}</b><small>{l.text}</small></span></button>)}</div></div>
  <div className="guide-new-actions">{onCancel&&<button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}<button className="btn primary" disabled={!ready}>Create guide</button></div>
 </form>;
}

/** Draft, Published, or Published with saved changes not yet live. */
function guideState(row:Entry|null){return !row?{state:'draft',label:'New draft'}:row.changesPending?{state:'pending',label:'Changes pending'}:row.publishedAt?{state:'approved',label:'Published'}:{state:'draft',label:'Draft'};}

/** The workshop landing: the public page's filters and cards, with a New guide card first. Each card's footer shows what staff
 * need instead of the byline: the guide's state, its author, the revision and the last edit. */
function GuideTiles({guides,onNew,onOpen}:{guides:Entry[];onNew:()=>void;onOpen:(row:Entry)=>void}){
 const [q,setQ]=useState(''),[category,setCategory]=useState<GuideCategory|'all'>('all'),{needle,matching,counts,shown}=filterGuides(guides,r=>r.guide,q,category);
 return <><GuideFilters counts={counts} total={matching.length} category={category} onCategory={setCategory} q={q} onQuery={setQ} placeholder="Find a guide by title or topic…"/><div className="guide-list">
  <button type="button" className="guide-tile guide-tile-new" onClick={onNew}><span className="guide-tile-art"><Plus size={30} aria-hidden="true"/></span><span className="guide-tile-body"><b className="guide-tile-title">New guide</b><span className="guide-tile-summary">Pick a title and topic, then start from a boss, quest, diary or blank layout.</span></span></button>
  {shown.map(row=>{const s=guideState(row);return <GuideTile key={row.id} guide={row.guide} showCategory={category==='all'} empty="No summary yet." onOpen={()=>onOpen(row)}
   footer={<p className="guide-byline"><StateLabel state={s.state} label={s.label}/><span className="guide-tile-author"><Person id={row.authorId} fallback="A staff member"/></span><span><span className="guide-tile-rev">Rev {row.revision}{row.updatedAt&&' · '}</span>{row.updatedAt&&<>Edited {timeAgo(row.updatedAt)}</>}</span></p>}/>;})}
 </div>{(needle||category!=='all')&&!shown.length&&<p className="fine">No guides match{needle?` “${q.trim()}”`:' that group'}.</p>}</>;
}

/** The guide editor, shown as the Guides tab of the staff portal. It opens on the guide tiles. */
export function GuideWorkshop(){
 const [data,setData]=useState<Dashboard|null>(null),[selected,setSelected]=useState<Entry|null>(null),[draft,setDraft]=useState<Guide|null>(null),[base,setBase]=useState(''),[creating,setCreating]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(false);
 async function load(){const r=await fetch('/api/staff/guides');const b=await r.json() as Dashboard & {error?:string};if(!r.ok)throw Error(b.error);setData(b);return b;}
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 const dirty=!!draft&&JSON.stringify(draft)!==base;
 // Unsaved writing survives tab switches (the workshop stays mounted); warn before leaving the page.
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const discard=()=>!dirty||window.confirm('Discard unsaved changes to this guide?');
 const reset=()=>{setPreview(false);setNotice('');setError('');};
 function open(row:Entry,force=false){if(!force&&!discard())return;const g=structuredClone(row.guide);setSelected(row);setDraft(g);setBase(JSON.stringify(g));setCreating(false);reset();}
 /** A new guide opens as an unsaved draft in its chosen layout: the author fills it in, then saves and publishes it like any other. */
 function create(guide:Guide){setSelected(null);setDraft(structuredClone(guide));setBase('');setCreating(false);reset();}
 /** Back to the tiles; unsaved writing asks first. */
 function allGuides(){if(!discard())return;setSelected(null);setDraft(null);setBase('');setCreating(false);reset();load().catch(e=>setError(e.message));}
 async function post(action:string,id:string|undefined,revision:number|undefined,guide?:Guide){const r=await fetch('/api/staff/guides',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,id,revision,guide})});const b=await r.json() as {id:string;error?:string};if(!r.ok)throw Error(b.error);return b.id;}
 /** Publishing unsaved writing saves it first, so what you see is what goes live. */
 async function run(kind:'save'|'publish'|'unpublish'){
  if(!draft)return;setBusy(true);setError('');setNotice('');
  try{let id=selected?.id,revision=selected?.revision;const saving=kind==='save'||(kind==='publish'&&(dirty||!selected));
   if(saving){id=await post('save',id,revision,draft);revision=(await load()).guides.find(x=>x.id===id)?.revision;}
   if(kind!=='save')await post(kind,id,revision);
   const row=(await load()).guides.find(x=>x.id===id);if(row)open(row,true);
   setNotice(kind==='save'?'Draft saved. The published version stays unchanged.':kind==='publish'?(saving?'Saved and published.':'Published.'):'Guide removed from public browsing.');
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const editing=!!draft&&(!selected||selected.canEdit),canPublish=!!data?.viewer.canPublish;
 useEffect(()=>{if(!editing||creating)return;const save=(e:KeyboardEvent)=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();if(!busy&&dirty)void run('save');}};window.addEventListener('keydown',save);return()=>window.removeEventListener('keydown',save);});
 if(!data)return <div className="guide-workshop">{error?<p className="community-notice" role="alert">{error}</p>:<div className="staff-loading is-inline" role="status"><span className="loading-spinner"/><span className="sr-only">Loading guides…</span></div>}</div>;
 const writing=!creating&&!!draft,state=guideState(selected);
 const alerts=<>{error&&<p className="community-notice staff-alert" role="alert">{error}</p>}{notice&&<p className="community-notice staff-alert is-good" role="status">{notice}</p>}</>;
 if(!writing&&!creating)return <div className="guide-workshop">{alerts}<GuideTiles guides={data.guides} onNew={()=>{setCreating(true);reset();}} onOpen={row=>open(row)}/></div>;
 return <div className="guide-workshop">
  <div className="guide-workshop-bar">
   <button type="button" className="btn sm ghost guide-back" onClick={creating?()=>{setCreating(false);reset();}:allGuides}><ChevronLeft size={16} aria-hidden="true"/>All guides</button>
   {writing&&<span className="guide-workshop-status"><StateLabel state={state.state} label={state.label}/><small>{!editing?'Read only':dirty?'Unsaved changes':selected?.updatedAt?`Saved ${timeAgo(selected.updatedAt)}`:'Saved'}</small></span>}
   {writing&&<div className="guide-workshop-actions"><button type="button" className="btn sm ghost" aria-pressed={preview} onClick={()=>setPreview(!preview)}>{preview?<><PenLine size={15} aria-hidden="true"/>Edit</>:<><Eye size={15} aria-hidden="true"/>Preview</>}</button>{canPublish&&selected?.publishedAt&&<button type="button" className="btn sm ghost" disabled={busy} onClick={()=>{if(window.confirm('Remove this guide from public browsing?'))void run('unpublish');}}>Unpublish</button>}{canPublish&&(editing||!!selected)&&<button type="button" className="btn sm" disabled={busy} onClick={()=>void run('publish')}>Publish</button>}{editing&&<button type="button" className="btn sm primary" disabled={busy||!dirty} onClick={()=>void run('save')}>Save draft</button>}</div>}
  </div>
  {alerts}
  {creating||!draft?<NewGuide onCreate={create} onCancel={()=>{setCreating(false);reset();}} focus/>:preview?<GuideArticle guide={draft}/>:<GuideDocument guide={draft} onChange={setDraft} disabled={!editing||busy} uploads={!!data?.viewer.canUpload}/>}
 </div>;
}
