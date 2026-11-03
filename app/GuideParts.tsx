"use client";
import {useEffect,useId,useMemo,useRef,useState,type ComponentProps,type CSSProperties,type KeyboardEvent as ReactKeyboardEvent,type ReactNode} from 'react';
import {LookStage} from './Look';
import {guideInline,guideInventoryItems,guideMentionQuantities,guideItemImage,guideItems,guideSetups,guideSlotStack,guideTextBlocks,GUIDE_OTHER_ICONS,type Guide,type GuideCostRow,type GuideIconKey,type GuideInline,type GuideSetupProfile} from '@/lib/guides';
import {guideReference} from '@/lib/guide-references';
import {wiki,type DropSource} from '@/lib/ui';
import {DropTable} from './DropTable';
import {ItemHover} from './ItemPriceCard';
import {HoverTip} from './HoverTip';
import {ItemRequirementTile} from './RequirementTiles';
import {EntityHover} from './EntityHover';
import {referenceTarget} from '@/lib/guide-hovers';
import {GUIDE_EMOJIS,guideEmojiLabel} from '@/lib/guide-emojis';
import type {EquipSlot} from '@/lib/flair';
/** The in-game worn equipment grid: head; cape, neck, ammo; weapon, body, shield; legs; hands, feet, ring. */
const WORN:(EquipSlot|null)[]=[null,'head',null,'cape','neck','ammo','weapon','body','shield',null,'legs',null,'hands','feet','ring'];
export function ItemImage({id}:{id:string}){return <img key={id} src={guideItemImage(id)??'/ui/collection-log-icon.png'} alt="" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src='/ui/collection-log-icon.png';}}/>;}
export function WornSlots({setup,selected,onSelect}:{setup:GuideSetupProfile;selected?:EquipSlot|number;onSelect?:(slot:EquipSlot|number)=>void}){return <div className="guide-worn">{WORN.map((slot,i)=>{if(!slot)return <span className="guide-worn-gap" key={i}/>;const id=setup.equipment[slot],label=`${slot}: ${id?guideItems[id]:'Empty'}`,content=<>{id?<ItemImage id={id}/>:<img className="slot-silhouette" src={`/ui/slots/${slot}.png`} alt=""/>}<small>{slot}</small></>;return onSelect?<button type="button" key={slot} className="guide-slot" title={label} aria-label={label} aria-pressed={selected===slot} onClick={()=>onSelect(slot)}>{content}</button>:id?<ItemHover key={slot} id={id} className="guide-slot" focusable>{content}</ItemHover>:<div key={slot} className="guide-slot" title={label}>{content}</div>;})}</div>;}
/** A stack's size as the game prints it in a slot's corner: yellow, white with K from 100,000, green with M from 10 million. */
export function StackCount({quantity}:{quantity:number}){
 return <small className={'guide-stack'+(quantity>=1e7?' is-m':quantity>=1e5?' is-k':'')} aria-hidden="true">{quantity>=1e7?Math.floor(quantity/1e6)+'M':quantity>=1e5?Math.floor(quantity/1e3)+'K':quantity}</small>;
}
/** An inventory slot's item: on a bank note when noted (the game's blank note with the item drawn smaller on it), with its
 * stack size in the corner for more than one, or for any noted stack, as the game shows it. */
/** Coins show a bigger pile as the stack grows, like the game (items 996 to 1004 are the piles for 2 coins up to 10,000). */
const COIN_PILES:[number,string][]=[[10000,'1004'],[1000,'1003'],[250,'1002'],[100,'1001'],[25,'1000'],[5,'999'],[4,'998'],[3,'997'],[2,'996']];
const coinPile=(quantity:number)=>COIN_PILES.find(([n])=>quantity>=n)?.[1];
export function SlotItem({id,quantity=1,noted=false}:{id:string;quantity?:number;noted?:boolean}){
 return <>{noted?<span className="guide-note"><img src="/ui/bank-note.png" alt=""/><ItemImage id={id}/></span>:id==='995'&&coinPile(quantity)?<img src={`/items/${coinPile(quantity)}.png`} alt=""/>:<ItemImage id={id}/>}{(quantity>1||noted)&&<StackCount quantity={quantity}/>}</>;
}
export function BagSlots({setup,selected,onSelect}:{setup:GuideSetupProfile;selected?:EquipSlot|number;onSelect?:(slot:EquipSlot|number)=>void}){return <div className="guide-bag"><div className="guide-inventory">{setup.inventory.map((id,i)=>{const {quantity,noted}=guideSlotStack(setup,i),label=`Slot ${i+1}: ${id?`${quantity>1?quantity.toLocaleString('en-US')+' × ':''}${guideItems[id]}${noted?' (noted)':''}`:'Empty'}`,content=id?<SlotItem id={id} quantity={quantity} noted={noted}/>:<span className="guide-empty-dot">·</span>;return onSelect?<button type="button" key={i} className="guide-slot" title={label} aria-label={label} aria-pressed={selected===i} onClick={()=>onSelect(i)}>{content}</button>:id?<ItemHover key={i} id={id} quantity={quantity} className="guide-slot" focusable>{content}</ItemHover>:<div key={i} className="guide-slot" title={label} aria-label={label}>{content}</div>;})}</div></div>;}
export function GuideSetup({guide}:{guide:Guide}){const [model,setModel]=useState(false),[chosen,setChosen]=useState('');const setups=guideSetups(guide),setup=setups.find(s=>s.id===chosen)??setups[0];return <section className="guide-loadout"><div className="section-heading"><div><span className="kicker">Prepare your setup</span><h3>Equipment &amp; inventory</h3></div><div className="guide-setup-tabs">{setups.map(s=><button className="btn sm" key={s.id} aria-pressed={s.id===setup.id} onClick={()=>setChosen(s.id)}>{s.name}</button>)}</div></div><div className="guide-setup"><section><h4>Worn equipment</h4><WornSlots setup={setup}/></section><section><h4>Inventory</h4><BagSlots setup={setup}/></section><section className="guide-model-column"><button className="btn sm" onClick={()=>setModel(!model)}>{model?'Hide':'Show'} character preview</button>{model?<div className="guide-model"><LookStage equipped={setup.equipment} petId={null} petName={null}/></div>:<p className="fine">See how this equipment looks on the character.</p>}</section></div></section>;}
/** Punctuation straight after an item or skill chip (", " "." ";" ":"): kept on the chip's line, clear of its underline and
 * in the text's own colour, so it does not vanish against the chip or wrap onto a line of its own. */
const punct=(t:string)=>t.match(/^[,.;:!?)]+/)?.[0]??'';
const isRef=(n:GuideInline|undefined)=>!!n&&typeof n!=='string'&&n.kind==='ref';
function ChipWithPunct({after,children}:{after:GuideInline|undefined;children:ReactNode}){const p=typeof after==='string'?punct(after):'';return p?<span className="guide-ref-wrap">{children}<span className="guide-ref-punct">{p}</span></span>:<>{children}</>;}
function Inline({nodes}:{nodes:GuideInline[]}){return <>{nodes.map((n,i)=>typeof n==='string'?(isRef(nodes[i-1])?n.slice(punct(n).length):n):n.kind==='bold'?<strong key={i}><Inline nodes={n.children}/></strong>:n.kind==='tone'?<span key={i} className={'guide-ink ink-'+n.tone}><Inline nodes={n.children}/></span>:n.kind==='ref'?<ChipWithPunct key={i} after={nodes[i+1]}><GuideRef name={n.name} suffix={n.suffix} quantity={n.quantity}/></ChipWithPunct>:<GuideEmoji key={i} name={n.name}/>)}</>;}
/** A [[game term]]: its icon and name, opening the OSRS Wiki page. Items and skills show their card on hover, focus or
 * tap (EntityHover); other terms name the Wiki in their tooltip. */
/** Lights the rows for an item in the drop tables of the guide around `from` (null clears them). A row scrolls into view only
 * inside a table that is already on screen, and only within the table's own scroll area, so the page never moves. */
export function lightDrops(name:string|null,from:Element){
 const root=from.closest('.guide-document-published')??document;
 root.querySelectorAll('.guide-drops tr.is-lit').forEach(tr=>tr.classList.remove('is-lit'));
 if(!name)return;
 const rows=[...root.querySelectorAll<HTMLTableRowElement>('.guide-drops tr[data-drop]')].filter(tr=>tr.dataset.drop===name.toLowerCase());
 for(const tr of rows)tr.classList.add('is-lit');
 const first=rows[0],box=first?.closest<HTMLElement>('.drops-scroll');if(!first||!box||box.scrollHeight<=box.clientHeight)return;
 const view=box.getBoundingClientRect();if(view.bottom<=0||view.top>=window.innerHeight)return;
 const row=first.getBoundingClientRect(),head=box.querySelector('thead')?.getBoundingClientRect().height??0;
 if(row.top<view.top+head)box.scrollTop-=view.top+head-row.top+8;else if(row.bottom>view.bottom)box.scrollTop+=row.bottom-view.bottom+8;
}
export function GuideRef({name,suffix='',quantity}:{name:string;suffix?:string;quantity?:number}){const r=guideReference(name),target=referenceTarget(r),light=r.itemId?{onMouseEnter:(e:{currentTarget:Element})=>lightDrops(r.name,e.currentTarget),onMouseLeave:(e:{currentTarget:Element})=>lightDrops(null,e.currentTarget),onFocus:(e:{currentTarget:Element})=>lightDrops(r.name,e.currentTarget),onBlur:(e:{currentTarget:Element})=>lightDrops(null,e.currentTarget)}:{},link=<a className={'guide-ref ref-'+r.kind} href={r.href} target="_blank" rel="noreferrer" title={target?undefined:`${r.name} · OSRS Wiki`} {...light}>{quantity!==undefined&&<span className="guide-ref-qty">{quantity.toLocaleString('en-US')}<i aria-hidden="true">×</i></span>}{r.icon&&<img src={r.icon} alt=""/>}{r.name}{suffix}</a>;return <EntityHover target={target} name={r.name} quantity={quantity} href={r.href}>{link}</EntityHover>;}
/** One of the site's emojis inside guide text. */
export function GuideEmoji({name}:{name:string}){return <img className="guide-emoji" src={GUIDE_EMOJIS[name]} alt={`:${name}:`} title={guideEmojiLabel(name)}/>;}
/** A line of guide text. A number just before an item mention ("3 [[Plank]]s") joins the item's chip and price card. */
export function InlineText({text}:{text:string}){return <Inline nodes={guideMentionQuantities(guideInline(text),name=>!!guideReference(name).itemId)}/>;}
export function FormattedText({text}:{text:string}){return <div className="guide-prose">{guideTextBlocks(text).map((block,i)=>block.kind==='heading'?<h4 key={i}><InlineText text={block.text}/></h4>:block.kind==='list'?<ul key={i}>{block.items!.map((item,n)=><li key={n}><InlineText text={item}/></li>)}</ul>:<p key={i}><InlineText text={block.text}/></p>)}</div>;}
type Edit=(next:(g:Guide)=>Guide)=>void;
const clamp=(value:string,max:number)=>Math.max(1,Math.min(max,Math.round(Number(value))||1));
/** Requirements chosen in the editor, as removable badges with editable levels and quantities. Recommended skills and items are marked as such. */
export function RequirementBadges({guide,onEdit}:{guide:Guide;onEdit?:Edit}){
 const remove=(label:string,next:(g:Guide)=>Guide)=>onEdit&&<button type="button" className="link" aria-label={`Remove ${label}`} onClick={()=>onEdit(next)}>×</button>;
 const skill=(list:'requiredSkills'|'recommendedSkills',r:{skill:string;level:number})=><div className={'guide-requirement'+(list==='recommendedSkills'?' is-recommended':'')} key={list+r.skill}><img src={`/icons/skills/${r.skill.toLowerCase()}.png`} alt=""/><span>{r.skill}{onEdit?<label className="guide-requirement-qty">{list==='recommendedSkills'?'Recommended':'Level'}<input type="number" min={1} max={99} aria-label={`${r.skill} level`} value={r.level} onChange={e=>{const level=clamp(e.target.value,99);onEdit(g=>({...g,[list]:(g[list]??[]).map(x=>x.skill===r.skill?{...x,level}:x)}));}}/></label>:<small>{list==='recommendedSkills'?'Recommended':'Level'} {r.level}</small>}</span>{remove(r.skill,g=>({...g,[list]:(g[list]??[]).filter(x=>x.skill!==r.skill)}))}</div>;
 const item=(list:'requiredItems'|'recommendedItems',i:{id:string;quantity:number})=><div className={'guide-requirement'+(list==='recommendedItems'?' is-recommended':'')} key={list+i.id}><ItemImage id={i.id}/><span>{guideItems[i.id]??'Unknown item'}{onEdit?<label className="guide-requirement-qty">{list==='recommendedItems'?'Recommended':'Quantity'}<input type="number" min={1} max={1000000} aria-label={`${guideItems[i.id]} quantity`} value={i.quantity} onChange={e=>{const quantity=clamp(e.target.value,1000000);onEdit(g=>({...g,[list]:(g[list]??[]).map(x=>x.id===i.id?{...x,quantity}:x)}));}}/></label>:<small>{list==='recommendedItems'?'Recommended':'Quantity'}: {i.quantity.toLocaleString()}</small>}</span>{remove(guideItems[i.id]??'item',g=>({...g,[list]:(g[list]??[]).filter(x=>x.id!==i.id)}))}</div>;
 return <div className="guide-requirement-list">
  {guide.requiredSkills?.map(r=>skill('requiredSkills',r))}
  {guide.requiredItems?.map(i=>item('requiredItems',i))}
  {guide.requiredQuests?.map(q=><div className="guide-requirement" key={q}><img src="/ui/quest-point-icon.png" alt=""/><span>{q}<small>Quest completed</small></span>{remove(q,g=>({...g,requiredQuests:g.requiredQuests?.filter(x=>x!==q)}))}</div>)}
  {guide.requiredDiaries?.map((d,i)=><div className="guide-requirement" key={d.area+d.tier}><img src="/ui/achievement-diaries-icon.png" alt=""/><span>{d.area} · {d.tier}<small>Achievement diary</small></span>{remove(`${d.area} ${d.tier}`,g=>({...g,requiredDiaries:g.requiredDiaries?.filter((_,n)=>n!==i)}))}</div>)}
  {guide.requiredOther?.map((r,i)=><div className="guide-requirement" key={i}><OtherIcon itemId={r.itemId} icon={r.icon}/><span>{r.label}<small>Other requirement</small></span>{remove(r.label,g=>({...g,requiredOther:g.requiredOther?.filter((_,n)=>n!==i)}))}</div>)}
  {guide.recommendedSkills?.map(r=>skill('recommendedSkills',r))}
  {guide.recommendedItems?.map(i=>item('recommendedItems',i))}
 </div>;
}
/** Custom requirements borrow an item's icon, or show the custom marker. */
export function OtherIcon({itemId,icon='task'}:{itemId:string|null;icon?:GuideIconKey}){return itemId?<ItemImage id={itemId}/>:<img src={GUIDE_OTHER_ICONS[icon][1]} alt=""/>;}
/** Published requirements, grouped like the site's quest and diary requirements: skills, quests, diaries, items, then anything else.
 * Tiles are the same size as the profile's quest and diary requirements (app/adventure-requirements.css). */
export function RequirementGroups({guide}:{guide:Guide}){
 // Skills show the same skill card as a [[Skill]] mention in the text, on hover, focus or tap: the whole row is the trigger.
 const skill=(r:{skill:string;level:number})=><li key={r.skill} className="has-card"><EntityHover target={{kind:'skill',name:r.skill}} className="req-card" focusable><img src={`/icons/skills/${r.skill.toLowerCase()}.png`} alt=""/><span className="req-name"><a href={wiki(r.skill)} target="_blank" rel="noreferrer">{r.level} {r.skill}</a></span></EntityHover></li>;
 // Items show their price card (with the stack's worth) on hover, focus or tap, like gear and inventory slots.
 const item=(i:{id:string;quantity:number})=><ItemRequirementTile key={i.id} items={[{id:i.id,name:guideItems[i.id]??'Unknown item'}]} quantity={i.quantity}/>;
 const groups:[string,ReactNode[]][]=[
  ['Skills',(guide.requiredSkills??[]).map(skill)],
  ['Quests',(guide.requiredQuests??[]).map(q=><li key={q}><img src="/ui/quest-point-icon.png" alt=""/><span className="req-name"><a href={wiki(q)} target="_blank" rel="noreferrer">{q}</a></span></li>)],
  ['Achievement diaries',(guide.requiredDiaries??[]).map(d=><li key={d.area+d.tier}><img src="/ui/achievement-diaries-icon.png" alt=""/><span className="req-name"><a href={wiki(`${d.area} Diary`)} target="_blank" rel="noreferrer">{d.area}</a></span><small className="req-qty">{d.tier}</small></li>)],
  ['Items',(guide.requiredItems??[]).map(item)],
  // Custom requirements only borrow an icon (a law rune for "10,000 coins, or 33 Magic for Telekinetic Grab"), so they
  // show no price card (lib/guide-hovers): the full label is the tooltip when the tile cuts it short.
  ['Other requirements',(guide.requiredOther??[]).map((r,i)=><li key={i} title={r.label}><OtherIcon itemId={r.itemId} icon={r.icon}/><span className="req-name"><b>{r.label}</b></span></li>)],
  ['Recommended',[...(guide.recommendedSkills??[]).map(skill),...(guide.recommendedItems??[]).map(item)]],
 ];
 return <div className="guide-req-groups">{groups.filter(([,rows])=>rows.length).map(([title,rows])=><div className={'adventure-requirement-group'+(title==='Recommended'?' is-recommended':'')} key={title}><h3>{title}</h3><ul className="adventure-requirement-list">{rows}</ul></div>)}</div>;
}
/** One tab per setup, on one line: equal widths across the panel. Up to five tabs always fit (smaller type, then an ellipsis with
 * the full name as the title); six or more scroll sideways when the names cannot fit. Arrow keys, Home and End move between tabs. */
/** Tab rows of up to this many setups fit the panel without scrolling. */
export const FITTED_TABS=5;
export function SetupTabList({setups,active,onPick,label,panelId,idPrefix}:{setups:{id:string;name:string}[];active:string;onPick:(id:string)=>void;label:string;panelId?:string;idPrefix:string}){
 const list=useRef<HTMLDivElement>(null);
 function keys(e:ReactKeyboardEvent){
  const at=setups.findIndex(s=>s.id===active),n=setups.length,next=e.key==='ArrowRight'?(at+1)%n:e.key==='ArrowLeft'?(at+n-1)%n:e.key==='Home'?0:e.key==='End'?n-1:-1;
  if(next<0)return;e.preventDefault();onPick(setups[next].id);list.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
 }
 useEffect(()=>{const tab=list.current?.querySelector<HTMLElement>('[aria-selected=true]');if(tab&&list.current&&list.current.scrollWidth>list.current.clientWidth)list.current.scrollTo({left:tab.offsetLeft-list.current.offsetLeft-12,behavior:'smooth'});},[active]);
 return <div ref={list} className={'tabs guide-kit-tabs has-'+setups.length+(setups.length<=FITTED_TABS?' is-fitted':'')} role="tablist" aria-label={label} onKeyDown={keys}>{setups.map(s=><button type="button" role="tab" key={s.id} title={s.name} id={`${idPrefix}-${s.id}`} aria-selected={s.id===active} aria-controls={panelId} tabIndex={s.id===active?0:-1} onClick={()=>onPick(s.id)}>{s.name}</button>)}</div>;
}
/** The Grand Exchange value of a panel's items in its corner: "1.5M", with "+2" for items that have no price. */
function KitValue({items,prices,what}:{items:{id:string;quantity:number}[];prices:Record<string,number>|null|'unavailable';what:'worn'|'inventory'}){
 if(!items.length||!prices||prices==='unavailable')return null;
 const cost=itemsCost(items,prices);
 return <HoverTip label={what==='worn'?'Gear value':'Inventory value'} className="guide-kit-value" content={<span className="guide-kit-tip"><b>{cost.total.toLocaleString('en-US')} gp</b><small>Grand Exchange value of the {what} items{what==='inventory'?', every stack counted in full (noted ones too) and coins at face value':''}{cost.missing?`; ${cost.missing} untradeable not counted`:''}.</small></span>}><img src="/items/995.png" alt=""/>{formatGp(cost.total)}{cost.missing>0&&<small>+{cost.missing}</small>}</HoverTip>;
}
/** One gear or inventory panel: its kind and value, the setup name, the grid, and with several setups a tab for each under
 * the grid. Worn
 * equipment fills the same box as the 28-slot inventory, so a gear panel and an inventory panel side by side are the same size.
 * An older section's shared inventory (fallback) stands in for a tab whose own inventory is empty. */
function KitPanel({part,setups,prices,fallback,onPick}:{part:'gear'|'bag';setups:GuideSetupProfile[];prices:Record<string,number>|null|'unavailable';fallback?:GuideSetupProfile;onPick?:(id:string)=>void}){
 const id=useId(),tabs=setups.length>1,title=part==='gear'?'Worn equipment':'Inventory';
 const [active,setActive]=useState(setups[0].id),setup=setups.find(s=>s.id===active)??setups[0];
 const shown=part==='bag'&&fallback&&!setup.inventory.some(Boolean)?{...fallback,name:setup.name}:setup;
 const pick=(next:string)=>{setActive(next);onPick?.(next);};
 return <section className={'guide-kit-panel is-'+part}>
  <div className="guide-kit-head"><span className="kicker">{title}</span><KitValue items={part==='gear'?Object.values(shown.equipment).filter((x):x is string=>!!x).map(x=>({id:x,quantity:1})):guideInventoryItems(shown)} prices={prices} what={part==='gear'?'worn':'inventory'}/></div>
  {!tabs&&<h3 className="guide-kit-name">{shown.name}</h3>}
  <div className="guide-kit-box" id={id+'panel'} role={tabs?'tabpanel':undefined} aria-labelledby={tabs?`${id}tab-${setup.id}`:undefined}>{part==='gear'?<WornSlots setup={shown}/>:<BagSlots setup={shown}/>}</div>
  {tabs&&<SetupTabList setups={setups} active={setup.id} onPick={pick} label={`${title} setups`} panelId={id+'panel'} idPrefix={id+'tab'}/>}
 </section>;
}
/** Gear, inventory or both for one or more setups. Each panel has its own tabs, so readers can compare the Max gear with the
 * Budget inventory. Each panel's Grand Exchange value sits in its corner, and the note of the setup open in the gear panel
 * (or the inventory panel, without gear) under the pair. */
export function GuideKit({setups,gear=true,inventory=true,fallback,notes=false}:{setups:GuideSetupProfile[];gear?:boolean;inventory?:boolean;fallback?:GuideSetupProfile;notes?:boolean}){
 const [noted,setNoted]=useState(setups[0].id),setup=setups.find(s=>s.id===noted)??setups[0];
 const showBag=inventory&&(!gear||!!fallback||setups.some(s=>s.inventory.some(Boolean)));
 const prices=useGuidePrices([...(gear?setups.flatMap(s=>Object.values(s.equipment)):[]),...(showBag?[...setups,...(fallback?[fallback]:[])].flatMap(s=>s.inventory):[])].filter((id):id is string=>!!id));
 return <div className="guide-kit">
  <div className="guide-kit-pair">
   {gear&&<KitPanel part="gear" setups={setups} prices={prices} onPick={setNoted}/>}
   {showBag&&<KitPanel part="bag" setups={setups} prices={prices} fallback={fallback} onPick={gear?undefined:setNoted}/>}
  </div>
  {notes&&setup.note&&<p className="guide-kit-note"><InlineText text={setup.note}/></p>}
 </div>;
}
/** What each item or spell (or row's `label`, such as a level bracket with the item's icon) costs per use: `per` names one use,
 * "cast" by default. A spell row names the spell with its card and prices its runes. */
export function CostTable({title,rows,per='cast'}:{title:string;rows:GuideCostRow[];per?:string}){
 const loaded=useGuidePrices(rows.flatMap(r=>r.parts.map(p=>p.itemId))),prices=loaded==='unavailable'?null:loaded;
 // Every row has the same number of part cells, so each part lines up under the one above it.
 const width=Math.max(1,...rows.map(r=>r.parts.length));
 return <div className="guide-costs"><div className="guide-costs-head"><span className="kicker">Cost per {per}</span></div><table style={{'--parts':width} as CSSProperties}><thead className="sr-only"><tr><th>{title||'Item'}</th>{Array.from({length:width},(_,i)=><th key={i}>{i?'':`Uses per ${per}`}</th>)}<th>Cost</th></tr></thead><tbody>{rows.map(r=>{const known=prices&&r.parts.every(p=>prices[p.itemId]!==undefined),cost=known?r.parts.reduce((t,p)=>t+prices![p.itemId]*p.quantity,0):null;return <tr key={r.spell??r.itemId}><td className="guide-cost-item">{r.label?<span className="guide-cost-label">{r.label}</span>:<GuideRef name={r.spell??guideItems[r.itemId]??''}/>}</td>{Array.from({length:width},(_,i)=>{const p=r.parts[i];return <td key={i} className="guide-cost-part">{p&&<span title={guideItems[p.itemId]}><ItemImage id={p.itemId}/>{p.quantity.toLocaleString('en-US')}</span>}</td>;})}<td className="guide-cost-total">{cost!==null?<><b>{formatGp(cost)}</b>gp</>:<small className="muted">{loaded==='unavailable'?'Unavailable':prices?'No price':'Loading…'}</small>}</td></tr>;})}</tbody></table></div>;
}
/** Grand Exchange prices for the given items (OSRS Wiki real-time prices, cached ten minutes); untradeable items have none. */
export function useGuidePrices(ids:string[]):Record<string,number>|null|'unavailable'{
 const key=[...new Set(ids)].sort().join(','),[prices,setPrices]=useState<Record<string,number>|null|'unavailable'>(null);
 useEffect(()=>{if(!key)return;let live=true;fetch('/api/prices?ids='+key).then(r=>r.ok?r.json() as Promise<{prices?:Record<string,number>}>:null).then(d=>{if(live)setPrices(d?.prices??'unavailable');}).catch(()=>{if(live)setPrices('unavailable');});return()=>{live=false;};},[key]);
 return prices;
}
/** 12,400,000 → 12.4M; 45,200 → 45.2K; small amounts in full. */
export function formatGp(value:number){const a=Math.abs(value);return a>=1e9?`${+(value/1e9).toFixed(2)}B`:a>=1e6?`${+(value/1e6).toFixed(1)}M`:a>=1e4?`${+(value/1e3).toFixed(1)}K`:Math.round(value).toLocaleString('en-US');}
/** Total Grand Exchange value of some items, each times its stack size; untradeables are left out and counted (once per slot). */
export function itemsCost(items:{id:string;quantity:number}[],prices:Record<string,number>){let total=0,missing=0;for(const {id,quantity} of items){if(prices[id]!==undefined)total+=prices[id]*quantity;else missing++;}return {total,missing};}
/** The full drop table for a boss or activity, on its own: no filter bar. Drops worth noting (collection log items at 1/50 or rarer:
 * the pet and the uniques) carry a gold accent, and an item named in the guide's text lights its row while that mention is hovered or
 * focused (lightDrops). */
export function GuideDrops({page,edit}:{page:string;edit?:ComponentProps<typeof DropTable>['edit']}){
 const [drops,setDrops]=useState<{sources:DropSource[];notable?:string[]}|null|'error'>(null);
 useEffect(()=>{let live=true;setDrops(null);fetch('/api/drops?page='+encodeURIComponent(page)).then(r=>r.ok?r.json() as Promise<{sources:DropSource[];notable?:string[]}>:Promise.reject()).then(d=>{if(live)setDrops(d);}).catch(()=>{if(live)setDrops('error');});return()=>{live=false;};},[page]);
 const notable=useMemo(()=>new Set(drops&&drops!=='error'?drops.notable??[]:[]),[drops]);
 if(drops==='error')return <p className="fine">The {page} drop table is unavailable right now.</p>;
 if(!drops)return <p className="fine" role="status">Loading the {page} drop table…</p>;
 if(!drops.sources.length)return <p className="fine">No drop table is listed for {page}.</p>;
 return <div className="guide-drops"><DropTable sources={drops.sources} bare edit={edit} notable={notable}/></div>;
}
