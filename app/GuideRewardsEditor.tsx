'use client';
import {useState} from 'react';
import {Plus,Search,X} from 'lucide-react';
import {ItemImage} from './GuideParts';
import {GuideRewards,REWARD_SOURCES,REWARD_TIERS} from './GuideRewards';
import {GUIDE_REWARD_ANY_SKILL,GUIDE_REWARD_LIMITS,GUIDE_REWARD_SOURCES,GUIDE_REWARD_TIERS,GUIDE_REWARD_VARIANTS,GUIDE_SKILLS,guideItemChoices,guideItems,guideQuests,searchGuideItems,type GuideRewardsBlock,type GuideRewardSource,type GuideRewardTier,type GuideRewardVariant} from '@/lib/guides';

const VARIANT:Record<GuideRewardVariant,{label:string;title:string;placeholder:string;lines:string;linePlaceholder:string}>={
 quest:{label:'Quest',title:'Quest',placeholder:'Dragon Slayer I',lines:'Unlocks',linePlaceholder:'The right to wear a [[Rune platebody]]'},
 chest:{label:'Chest',title:'Chest or boss',placeholder:'Barrows chest',lines:'Notes',linePlaceholder:'One roll per kill'},
 casket:{label:'Casket',title:'Casket',placeholder:'Reward casket (hard)',lines:'Notes',linePlaceholder:'Rolls 4 to 6 items'},
 diary:{label:'Diary',title:'Diary and tier',placeholder:'Varrock Hard',lines:'Perks',linePlaceholder:'10% more chance to mine 2 ores at once'},
};
export const newRewards=(title=''):GuideRewardsBlock=>({id:crypto.randomUUID(),kind:'rewards',variant:'quest',title,lines:[]});
/** Rewards as saved: blank lines dropped, text trimmed, empty lists left out; a tier only on a casket, a source only on a
 * chest. */
export function tidyRewards(b:GuideRewardsBlock):GuideRewardsBlock{
 const {xp,items,lines,questPoints,itemId,tier,source,...rest}=b,kept=(lines??[]).map(l=>l.trim()).filter(Boolean);
 return {...rest,title:b.title.trim(),...(b.variant==='casket'&&tier?{tier}:{}),...(b.variant==='chest'&&source?{source}:{}),...(itemId?{itemId}:{}),...(questPoints?{questPoints}:{}),...(xp?.length?{xp}:{}),...(items?.length?{items}:{}),...(kept.length?{lines:kept}:{})};
}
/** The game's own titles, so picking a tier or a window fills in the title until the author writes their own. */
const DEFAULT_TITLES=new Set([...Object.values(REWARD_TIERS).map(t=>t.title),...Object.values(REWARD_SOURCES).map(s=>s.title).filter(Boolean)]);
const retitle=(b:GuideRewardsBlock,title:string)=>!b.title.trim()||DEFAULT_TITLES.has(b.title.trim())?{title}:{};
const hasReward=(b:GuideRewardsBlock)=>!!(b.questPoints||b.xp?.length||b.items?.length||b.lines?.some(l=>l.trim()));
/** What is wrong with a rewards section before it is saved, or null. */
export function rewardsProblem(b:GuideRewardsBlock):string|null{
 if(!b.title.trim())return `Name the ${VARIANT[b.variant].title.toLowerCase()}.`;
 if(!hasReward(b))return 'Add at least one reward.';
 return null;
}

/** One item search for the rewards: type to find, pick to add. */
function ItemSearch({label,placeholder,onPick,exclude=[]}:{label:string;placeholder:string;onPick:(id:string)=>void;exclude?:string[]}){
 const [query,setQuery]=useState(''),results=query.trim()?searchGuideItems(query,guideItemChoices,24).filter(([id])=>!exclude.includes(id)):[];
 return <>
  <label className="search"><Search size={14} aria-hidden="true"/><input aria-label={label} placeholder={placeholder} value={query} onChange={e=>setQuery(e.target.value)}/></label>
  {results.length>0&&<div className="guide-item-results gm-edit-results">{results.map(([id,name])=><button type="button" key={id} title={name} aria-label={`Add ${name}`} onClick={()=>{onPick(id);setQuery('');}}><ItemImage id={id}/><span>{name}</span></button>)}</div>}
 </>;
}

/** The rewards section editor: the kind of rewards, their title, then quest points, XP, items and lines, with the
 * section as readers will see it underneath. */
export function GuideRewardsEditor({value:b,onChange}:{value:GuideRewardsBlock;onChange:(b:GuideRewardsBlock)=>void}){
 const L=GUIDE_REWARD_LIMITS,v=VARIANT[b.variant],xp=b.xp??[],items=b.items??[],lines=b.lines??[];
 const set=(patch:Partial<GuideRewardsBlock>)=>onChange({...b,...patch});
 return <div className="gr-editor">
  <div className="gr-edit-variants" role="radiogroup" aria-label="Kind of rewards">{GUIDE_REWARD_VARIANTS.map(k=><button type="button" key={k} role="radio" aria-checked={b.variant===k} className={'btn sm'+(b.variant===k?' primary':'')} onClick={()=>set({variant:k})}>{VARIANT[k].label}</button>)}</div>
  {b.variant==='casket'&&<div className="gm-edit-field"><span>Tier</span><div className="gr-edit-tiers" role="radiogroup" aria-label="Casket tier">{GUIDE_REWARD_TIERS.map(t=><button type="button" key={t} role="radio" aria-checked={b.tier===t} className={'btn sm'+(b.tier===t?' primary':'')} onClick={()=>set({tier:t as GuideRewardTier,...retitle(b,REWARD_TIERS[t].title)})}><img src={`/icons/ui-reward/casket-${t}.png`} alt=""/>{REWARD_TIERS[t].label}</button>)}</div></div>}
  {b.variant==='chest'&&<label className="gm-edit-field"><span>Window <small>the game&rsquo;s reward window for this loot</small></span><span className="gr-edit-source"><img src={REWARD_SOURCES[b.source??'loot'].art??'/ui/collection-log-icon.png'} alt=""/><select aria-label="Reward window" value={b.source??'loot'} onChange={e=>{const source=e.target.value as GuideRewardSource,title=REWARD_SOURCES[source].title;set({source,...(title?retitle(b,title):{})});}}>{GUIDE_REWARD_SOURCES.map(k=><option key={k} value={k}>{REWARD_SOURCES[k].label}</option>)}</select></span></label>}
  <div className="gr-edit-row">
   <label className="gm-edit-field gr-edit-title"><span>{v.title}</span><input maxLength={L.title} list={b.variant==='quest'?'gr-quests':undefined} placeholder={v.placeholder} value={b.title} onChange={e=>set({title:e.target.value})}/>{b.variant==='quest'&&<datalist id="gr-quests">{guideQuests.map(q=><option key={q} value={q}/>)}</datalist>}</label>
   {b.variant==='quest'&&<label className="gm-edit-field gr-edit-qp"><span>Quest points</span><input type="number" min={0} max={L.questPoints} value={b.questPoints??0} onChange={e=>set({questPoints:Math.max(0,Math.min(L.questPoints,Math.round(Number(e.target.value))||0))})}/></label>}
  </div>
  {(b.variant==='quest'||b.variant==='diary')&&<div className="gm-edit-field"><span>Picture <small>the item on the scroll</small></span>
   {b.itemId?<div className="gr-edit-picture"><ItemImage id={b.itemId}/><span>{guideItems[b.itemId]}</span><button type="button" aria-label="Remove the picture" title="Remove" onClick={()=>set({itemId:undefined})}><X size={14}/></button></div>
   :<ItemSearch label="Search the picture's item" placeholder="An item, like Elvarg's head…" onPick={id=>set({itemId:id})}/>}
  </div>}
  <div className="gm-edit-field"><span>Experience</span>
   {xp.length>0&&<ul className="gr-edit-xp">{xp.map((x,i)=><li key={i}><img src={x.skill===GUIDE_REWARD_ANY_SKILL?'/items/4447.png':`/icons/skills/${x.skill.toLowerCase()}.png`} alt=""/><select aria-label={`XP reward ${i+1} skill`} value={x.skill} onChange={e=>set({xp:xp.map((y,j)=>j===i?{...y,skill:e.target.value}:y)})}>{GUIDE_SKILLS.map(s=><option key={s}>{s}</option>)}<option value={GUIDE_REWARD_ANY_SKILL}>Any skill (lamp)</option></select><input type="number" min={1} max={L.xpAmount} aria-label={`XP reward ${i+1} amount`} value={x.amount} onChange={e=>set({xp:xp.map((y,j)=>j===i?{...y,amount:Math.max(1,Math.min(L.xpAmount,Math.round(Number(e.target.value))||1))}:y)})}/><button type="button" aria-label={`Remove XP reward ${i+1}`} title="Remove" onClick={()=>set({xp:xp.filter((_,j)=>j!==i)})}><X size={14}/></button></li>)}</ul>}
   {xp.length<L.xp&&<button type="button" className="btn sm ghost gm-edit-add" onClick={()=>set({xp:[...xp,{skill:b.variant==='diary'?GUIDE_REWARD_ANY_SKILL:'Attack',amount:1000}]})}><Plus size={14} aria-hidden="true"/>XP reward</button>}
  </div>
  <div className="gm-edit-field"><span>Items</span>
   {items.length>0&&<ul className="gm-edit-items">{items.map(i=><li key={i.id}><ItemImage id={i.id}/><span>{guideItems[i.id]??'Item'}</span><input type="number" min={1} max={L.quantity} aria-label={`${guideItems[i.id]} quantity`} value={i.quantity} onChange={e=>{const quantity=Math.max(1,Math.min(L.quantity,Math.round(Number(e.target.value))||1));set({items:items.map(x=>x.id===i.id?{...x,quantity}:x)});}}/><button type="button" aria-label={`Remove ${guideItems[i.id]}`} title="Remove" onClick={()=>set({items:items.filter(x=>x.id!==i.id)})}><X size={14}/></button></li>)}</ul>}
   {items.length<L.items&&<ItemSearch label="Add a reward item" placeholder="Add an item, like Antique lamp…" exclude={items.map(i=>i.id)} onPick={id=>set({items:[...items,{id,quantity:1}]})}/>}
  </div>
  <div className="gm-edit-field"><span>{v.lines} <small>one per line; [[Item]] adds its icon</small></span>
   {lines.length>0&&<ol className="gm-edit-lines">{lines.map((line,j)=><li key={j}><b>·</b><input aria-label={`${v.lines} line ${j+1}`} value={line} maxLength={L.line} placeholder={v.linePlaceholder} onChange={e=>set({lines:lines.map((x,k)=>k===j?e.target.value:x)})}/><button type="button" aria-label={`Remove line ${j+1}`} title="Remove" onClick={()=>set({lines:lines.filter((_,k)=>k!==j)})}><X size={14}/></button></li>)}</ol>}
   {lines.length<L.lines&&<button type="button" className="btn sm ghost gm-edit-add" onClick={()=>set({lines:[...lines,'']})}><Plus size={14} aria-hidden="true"/>Line</button>}
  </div>
  <div className="gr-edit-preview"><small>Preview</small>{b.title.trim()&&hasReward(b)?<GuideRewards block={tidyRewards(b)}/>:<p className="fine">Name the {v.title.toLowerCase()} and add a reward to see it here.</p>}</div>
 </div>;
}
