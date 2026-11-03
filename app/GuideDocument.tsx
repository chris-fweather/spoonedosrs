"use client";
import {Fragment,useEffect,useRef,useState,type KeyboardEvent as ReactKeyboardEvent,type ReactNode} from 'react';
import {ArrowDown,ArrowLeft,ArrowLeftRight,ArrowRight,ArrowUp,ArrowUpFromLine,Bold,BookOpen,Check,Columns2,Heading2,Image as ImageIcon,List,ListOrdered,Minus,Pencil,Pilcrow,Plus,Search,Smile,Trash2,Upload} from 'lucide-react';
import {GuideWritingField,type GuideWritingCommand} from './GuideWritingField';
import {BagSlots,WornSlots,ItemImage,RequirementBadges,RequirementGroups,GuideKit,SetupTabList,OtherIcon,CostTable,GuideDrops,FormattedText} from './GuideParts';
import {GuideMap,GuideMapEditor,newGuideMap} from './GuideMap';
import {GuideRewards} from './GuideRewards';
import {EntityHover} from './EntityHover';
import {referenceTarget} from '@/lib/guide-hovers';
import {GuideRewardsEditor,newRewards,rewardsProblem,tidyRewards} from './GuideRewardsEditor';
import {MAP_STOP_LIMITS,tidyStop,type GuideMap as GuideMapData} from '@/lib/guide-map';
import {GUIDE_PRAYERS,GUIDE_SPELLS,guideReference,searchGuideReferences} from '@/lib/guide-references';
import {guideMagic,magicRunes} from '@/lib/guide-magic';
import {isCostSpell,guideBlocks,guideSlotStack,GUIDE_MAX_STACK,guideHeadings,guideLeafBlocks,GUIDE_COLUMN_SPLITS,guideItemChoices,guideSlotChoices,searchGuideItems,guideSetups,newGuideSetup,guideQuests,guideDiaryAreas,guideDiaryTiers,guidePlainText,guideHasRequirements,guideSectionSetups,GUIDE_OTHER_ICONS,GUIDE_SKILLS,GUIDE_TONES,GUIDE_TEXT_STYLES,type Guide,type GuideBlock,type GuideColumnSplit,type GuideColumnsBlock,type GuideLeafBlock,type GuideIconKey,type GuideSetupProfile,type GuideTextStyle,type GuideTone,type GuideRewardsBlock} from '@/lib/guides';
import {GUIDE_EMOJIS,guideEmojiLabel} from '@/lib/guide-emojis';
import {guideTopicImage} from '@/lib/guide-topics';
import {UPLOAD_LIMITS,isUploadUrl} from '@/lib/guide-upload-rules';
import {equipItem,type EquipSlot} from '@/lib/flair';
import {oddsCurve} from '@/lib/odds-chart';
import {num,pct} from '@/lib/ui';
import {pageIcon} from '@/lib/artwork';
import questReference from '@/lib/quest-reference.json';
import './guide-document.css';
import './account-settings.css';
/** The cost editor's search target for a new spell row (-1 adds an item row; 0 and up add to that row). */
const COST_SPELL=-2;
/** Spells a cost row can price, in the spell list's order. */
const COST_SPELLS=GUIDE_SPELLS.filter(isCostSpell);
type InsertKind='gear'|'inventory'|'requirements'|'odds'|'loadouts'|'costs'|'drops'|'prayers'|'spells'|'image'|'map'|'rewards';
const textBlock=(style:GuideTextStyle='body'):GuideBlock=>({id:crypto.randomUUID(),kind:'text',text:'',style,tone:'default'});
const TONE_LABEL:Record<GuideTone,string>={default:'Default colour',gold:'Gold',orange:'Orange',green:'Green'};
const STYLE_LABEL:Record<GuideTextStyle,string>={body:'Paragraph',heading:'Heading',subheading:'Subheading',list:'Bulleted list',numbered:'Numbered list'};
const blockLabel=(b:GuideBlock):string=>b.kind==='columns'?'Two columns':b.kind==='text'?STYLE_LABEL[b.style]:b.kind==='gear'?'Gear profile':b.kind==='inventory'?'Inventory profile':b.kind==='odds'?'Drop odds chart':b.kind==='requirements'?'Requirements':b.kind==='loadouts'?'Gear and inventory':b.kind==='costs'?'Cost table':b.kind==='drops'?'Drop table':b.kind==='prayers'?'Prayers':b.kind==='spells'?'Spells':b.kind==='image'?'Image':b.kind==='map'?'Map':b.kind==='rewards'?'Rewards':'Divider';
const quests=questReference.quests as Record<string,{difficulty?:string}>;
const SPLIT_LABEL:Record<GuideColumnSplit,string>={'1:1':'Half and half','2:1':'Wide left, narrow right','1:2':'Narrow left, wide right'};
type Side=0|1;
/** A section by ID, at the top level or inside a pair of columns. */
function findBlock(blocks:GuideBlock[],id:string|null):GuideBlock|undefined{if(!id)return;for(const b of blocks){if(b.id===id)return b;if(b.kind==='columns')for(const c of b.columns)if(c?.id===id)return c;}}
/** The top-level position of a section, or of the columns that hold it. */
const topIndex=(blocks:GuideBlock[],id:string)=>blocks.findIndex(b=>b.id===id||(b.kind==='columns'&&b.columns.some(c=>c?.id===id)));
/** Replace a section wherever it sits; inside columns it stays in its column. */
function replaceBlock(blocks:GuideBlock[],id:string,next:GuideBlock):GuideBlock[]{return blocks.map(b=>b.id===id?next:b.kind==='columns'&&next.kind!=='columns'&&next.kind!=='divider'&&b.columns.some(c=>c?.id===id)?{...b,columns:b.columns.map(c=>c?.id===id?next:c) as GuideColumnsBlock['columns']}:b);}
/** Sections that can sit in a column: anything but a divider or another pair of columns. */
const fitsColumn=(b:GuideBlock|undefined):b is GuideLeafBlock=>!!b&&b.kind!=='columns'&&b.kind!=='divider';
type MenuItem={id:string;label:string;hint:string;icon:ReactNode};
const INSERTS:MenuItem[]=[
 {id:'text:body',label:'Paragraph',hint:'Plain writing',icon:<Pilcrow size={18}/>},
 {id:'text:heading',label:'Heading',hint:'Start a new section',icon:<Heading2 size={18}/>},
 {id:'text:list',label:'Bulleted list',hint:'One item per line',icon:<List size={18}/>},
 {id:'text:numbered',label:'Numbered list',hint:'Steps in order',icon:<ListOrdered size={18}/>},
 {id:'gear',label:'Gear profile',hint:'Worn equipment loadout',icon:<img className="slot-silhouette" src="/ui/slots/body.png" alt=""/>},
 {id:'loadouts',label:'Gear and inventory',hint:'Both panels, a tab per setup',icon:<img src="/icons/navigation/combat-achievements-icon.png" alt=""/>},
 {id:'inventory',label:'Inventory profile',hint:'28-slot inventory',icon:<img src="/items/385.png" alt=""/>},
 {id:'requirements',label:'Requirements',hint:'Skills, quests, diaries, items and more',icon:<img src="/ui/quest-list-icon.png" alt=""/>},
 {id:'costs',label:'Cost table',hint:'Live cost of each item per use',icon:<img src="/items/995.png" alt=""/>},
 {id:'drops',label:'Drop table',hint:'The full drop table for the boss',icon:<img src="/ui/collection-log.png" alt=""/>},
 {id:'odds',label:'Drop odds chart',hint:'Chance and dry-streak curve',icon:<img src="/ui/collection-log-icon.png" alt=""/>},
 {id:'rewards',label:'Rewards',hint:'Quest, chest, casket or diary rewards, as in game',icon:<img src="/ui/quest-point-icon.png" alt=""/>},
 {id:'prayers',label:'Prayers',hint:'Which prayers to use, with their icons',icon:<img src="/icons/prayers/protect-from-magic.png" alt=""/>},
 {id:'spells',label:'Spells',hint:'Which spells to cast or teleport with',icon:<img src="/icons/skills/magic.png" alt=""/>},
 {id:'image',label:'Image or GIF',hint:'Upload a picture or paste a link',icon:<ImageIcon size={18}/>},
 {id:'map',label:'Map',hint:'Numbered stops on the world map',icon:<img src="/ui/quest-list-icon.png" alt=""/>},
 {id:'columns',label:'Two columns',hint:'Two sections side by side',icon:<Columns2 size={18}/>},
 {id:'divider',label:'Divider',hint:'A quiet break between sections',icon:<Minus size={18}/>},
];
/** A toolbar menu button: arrow keys move between items, Escape, outside clicks and a choice close it. */
function ToolbarMenu({label,trigger,triggerClass,menuClass,disabled,children}:{label:string;trigger:ReactNode;triggerClass:string;menuClass:string;disabled:boolean;children:(close:()=>void)=>ReactNode}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;root.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();const away=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',away);return()=>document.removeEventListener('mousedown',away);},[open]);
 function keys(e:ReactKeyboardEvent){
  const items=[...root.current?.querySelectorAll<HTMLElement>('[role=menuitem]')??[]],at=items.indexOf(document.activeElement as HTMLElement),step=e.key==='ArrowDown'||e.key==='ArrowRight'?1:e.key==='ArrowUp'||e.key==='ArrowLeft'?-1:0;
  if(e.key==='Escape'){e.preventDefault();setOpen(false);button.current?.focus();}
  else if(step&&open){e.preventDefault();items[(at+step+items.length)%items.length]?.focus();}
 }
 return <div ref={root} className="guide-menu" onKeyDown={keys}>
  <button ref={button} type="button" className={triggerClass} aria-haspopup="menu" aria-expanded={open} aria-label={label} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>setOpen(!open)}>{trigger}</button>
  {open&&<div className={menuClass} role="menu" aria-label={label}>{children(()=>{setOpen(false);button.current?.focus();})}</div>}
 </div>;
}
/** Link a game term inline: search skills, prayers, spells, quests, travel (teleports, fairy ring codes, spirit trees) and items; the term shows its icon and opens the Wiki.
 * Typing letters straight after a term adds them to it (Shark + s = Sharks), and typing @ in the text searches too. */
function TermMenu({disabled,onPick}:{disabled:boolean;onPick:(name:string)=>void}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;root.current?.querySelector('input')?.focus();const away=(e:MouseEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',away);return()=>document.removeEventListener('mousedown',away);},[open]);
 const results=searchGuideReferences(query,30);
 return <div ref={root} className="guide-menu" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);}}}>
  <RibbonButton label="Item or game term" hint="Icon and Wiki link. Or type @ in the text" icon={<BookOpen size={18}/>} disabled={disabled} expanded={open} onClick={()=>{setOpen(!open);setQuery('');}}/>
  {open&&<div className="guide-term-menu" role="dialog" aria-label="Link a game term"><label className="search"><Search size={15} aria-hidden="true"/><input aria-label="Search game terms" placeholder="Item, spell, teleport, skill or quest…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="guide-term-results">{results.map(r=><button type="button" key={r.kind+r.name} onMouseDown={e=>e.preventDefault()} onClick={()=>{onPick(r.name);setOpen(false);}}>{r.icon?<img src={r.icon} alt=""/>:<span className="guide-term-blank"/>}<span>{r.name}<small className={r.detail?'is-detail':undefined}>{r.detail??r.kind}</small></span></button>)}{!results.length&&<p className="fine">{query.trim()?'No matches.':'Type to search.'}</p>}</div><p className="guide-term-tip">Type an <b>s</b> straight after a term to make it plural.</p></div>}
 </div>;
}
/** One icon in the Insert bar, with its name and what it does on hover or focus. */
function RibbonButton({label,hint,icon,disabled,expanded,onClick}:{label:string;hint:string;icon:ReactNode;disabled:boolean;expanded?:boolean;onClick:()=>void}){
 return <button type="button" className="guide-ribbon-btn" aria-label={label} aria-expanded={expanded} aria-haspopup={expanded===undefined?undefined:'dialog'} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={onClick}>{icon}<span className="guide-tip" role="tooltip"><b>{label}</b><small>{hint}</small></span></button>;
}
const RIBBON:{label:string;ids:string[]}[]=[
 {label:'Text',ids:['text:body','text:heading','text:list','text:numbered']},
 {label:'Gear',ids:['gear','loadouts','inventory']},
 {label:'Boss info',ids:['requirements','costs','drops','odds','rewards']},
 {label:'Magic',ids:['prayers','spells']},
 {label:'Media',ids:['image','map']},
 {label:'Layout',ids:['columns','divider']},
];
/** What a column can hold: every section but a divider or more columns. */
const COLUMN_INSERTS=INSERTS.filter(x=>x.id!=='divider'&&x.id!=='columns');
export function GuideDocument({guide,onChange,disabled,uploads=false}:{guide:Guide;onChange:(g:Guide)=>void;disabled:boolean;uploads?:boolean}) {
 const blocks=guideBlocks(guide),[active,setActive]=useState(blocks.at(-1)?.id??''),[insert,setInsert]=useState<InsertKind|null>(null),[editing,setEditing]=useState<string|null>(null);
 // Where an inserted section goes when it is added from inside a pair of columns.
 const [target,setTarget]=useState<{columns:string;side:Side}|null>(null);
 const [format,setFormat]=useState<GuideWritingCommand&{blockId:string}|undefined>();
 // Colour under the cursor, so the matching dot reads as selected.
 const [ink,setInk]=useState<GuideTone|null>(null);
 const focused=findBlock(blocks,active),text=focused?.kind==='text'?focused:null,full=disabled||blocks.length>=100,topic=guideTopicImage(guide.activity);
 useEffect(()=>{const read=()=>{const node=window.getSelection()?.anchorNode,el=node&&(node.nodeType===1?node as Element:node.parentElement),editor=el?.closest('.guide-document-text');if(!editor)return;const span=el!.closest<HTMLElement>('[data-tone]');setInk(span&&editor.contains(span)?span.dataset.tone as GuideTone:null);};document.addEventListener('selectionchange',read);return()=>document.removeEventListener('selectionchange',read);},[]);
 function update(next:GuideBlock[],extra:Partial<Guide>={}){onChange({...guide,...extra,blocks:next,strategy:guideLeafBlocks(next).filter((b):b is Extract<GuideBlock,{kind:'text'}>=>b.kind==='text').map(b=>b.text).join('\n')});}
 function add(block:GuideBlock,extra:Partial<Guide>={}){if(blocks.length>=100)return;const at=topIndex(blocks,active);const next=[...blocks];next.splice(at<0?next.length:at+1,0,block);update(next,extra);setActive(block.id);}
 function patch(patch:object){const b=findBlock(blocks,active);if(b)update(replaceBlock(blocks,active,{...b,...patch} as GuideBlock));}
 function open(kind:InsertKind,id:string|null=null,into:{columns:string;side:Side}|null=null){setEditing(id);setTarget(into);setInsert(kind);}
 const close=()=>{setInsert(null);setEditing(null);setTarget(null);};
 function apply(block:GuideBlock,extra:Partial<Guide>){if(editing)update(replaceBlock(blocks,editing,{...block,id:editing}),extra);else if(target&&fitsColumn(block)){update(setSide(blocks,target.columns,target.side,block),extra);setActive(block.id);}else add(block,extra);close();}
 function pick(id:string){if(id.startsWith('text:'))add(textBlock(id.slice(5) as GuideTextStyle));else if(id==='divider')add({id:crypto.randomUUID(),kind:'divider'});else if(id==='columns')add({id:crypto.randomUUID(),kind:'columns',split:'1:1',columns:[null,null]});else open(id as InsertKind);}
 /** Columns: fill a side from the insert list, change the split, swap the sides, or move sections in and out. */
 const setSide=(list:GuideBlock[],columns:string,side:Side,child:GuideLeafBlock|null)=>list.map(b=>b.id===columns&&b.kind==='columns'?{...b,columns:(side===0?[child,b.columns[1]]:[b.columns[0],child]) as GuideColumnsBlock['columns']}:b);
 function fill(columns:string,side:Side,id:string){if(id.startsWith('text:')){const t=textBlock(id.slice(5) as GuideTextStyle) as GuideLeafBlock;update(setSide(blocks,columns,side,t));setActive(t.id);}else open(id as InsertKind,null,{columns,side});}
 function wrap(i:number){const b=blocks[i];if(!fitsColumn(b))return;const next=[...blocks],id=crypto.randomUUID();next[i]={id,kind:'columns',split:'1:1',columns:[b,null]};update(next);setActive(id);}
 /** Move the section above or below into an empty side. */
 function bringIn(i:number,side:Side,from:-1|1){const b=blocks[i],other=blocks[i+from];if(b?.kind!=='columns'||!fitsColumn(other))return;const next=setSide(blocks,b.id,side,other);next.splice(i+from,1);update(next);setActive(other.id);}
 function moveOut(i:number,side:Side){const b=blocks[i];if(b?.kind!=='columns')return;const child=b.columns[side];if(!child)return;const next=setSide(blocks,b.id,side,null);next.splice(i+1,0,child);update(next);setActive(child.id);}
 const columnsPatch=(id:string,p:Partial<GuideColumnsBlock>)=>update(blocks.map(b=>b.id===id&&b.kind==='columns'?{...b,...p}:b));
 function move(i:number,by:number){const next=[...blocks];[next[i+by],next[i]]=[next[i],next[i+by]];update(next);}
 /** Highlighted text takes the colour; with nothing highlighted the whole section does. */
 function colour(tone:GuideTone){const selection=window.getSelection(),editor=document.querySelector(`[id="doc-${active}"] .guide-document-text`);if(editor&&selection&&!selection.isCollapsed&&editor.contains(selection.anchorNode))setFormat({kind:'tone',tone,id:Date.now(),blockId:active});else{patch({tone});setInk(null);}}
 const shown=ink??text?.tone??'default';
 /** A section's editable body: text is written in place; other sections show as readers see them, with an edit button for gear. */
 const leafBody=(b:GuideBlock,label:string,narrow=false)=>b.kind==='text'?<GuideWritingField label={label} value={b.text} onChange={text=>update(replaceBlock(blocks,b.id,{...b,text}))} rows={b.style==='body'?3:1} disabled={disabled} placeholder={b.style==='body'?'Write your guide…':b.style==='list'||b.style==='numbered'?'One item per line…':'Write a heading…'} compact tone={b.tone} command={format?.blockId===b.id?format:undefined}/>:<><DocumentBlock guide={guide} block={b} narrow={narrow}/>{(b.kind==='loadouts'||b.kind==='gear'||b.kind==='inventory')&&!disabled&&<button type="button" className="guide-block-edit" onClick={()=>open(b.kind as InsertKind,b.id)}><Pencil size={14} aria-hidden="true"/>{b.kind==='loadouts'?'Edit tabs, gear and inventory':b.kind==='gear'?'Edit tabs and gear':'Edit tabs and inventory'}</button>}</>;
 return <div className="guide-doc-shell">
  <div className="guide-toolbar">
   <div className="guide-toolbar-row" role="toolbar" aria-label="Formatting">
    <select className="guide-tool-style" aria-label="Text style" disabled={disabled||!text} value={text?.style??'body'} onChange={e=>patch({style:e.target.value})}>{GUIDE_TEXT_STYLES.map(s=><option key={s} value={s}>{STYLE_LABEL[s]}</option>)}</select>
    <span className="guide-tool-sep" aria-hidden="true"/>
    <button type="button" className="guide-tool" disabled={disabled||!text} aria-label="Bold selected text" title="Bold selected text" onMouseDown={e=>e.preventDefault()} onClick={()=>setFormat({kind:'bold',id:Date.now(),blockId:active})}><Bold size={16} strokeWidth={2.6}/></button>
    <span className="guide-tones" role="group" aria-label="Text colour">{GUIDE_TONES.map(tone=><button key={tone} type="button" className={'guide-tone tone-'+tone} aria-label={TONE_LABEL[tone]} title={TONE_LABEL[tone]} aria-pressed={!!text&&shown===tone} disabled={disabled||!text} onMouseDown={e=>e.preventDefault()} onClick={()=>colour(tone)}><i/></button>)}</span>
    <span className="guide-doc-state">{disabled?'Read only':`${blocks.length} ${blocks.length===1?'section':'sections'}`}</span>
   </div>
   <div className="guide-ribbon" role="toolbar" aria-label="Insert">
    <div className="guide-ribbon-group"><small>In the text</small><div>
     <TermMenu disabled={disabled||!text} onPick={name=>setFormat({kind:'ref',name,id:Date.now(),blockId:active})}/>
     <ToolbarMenu label="Emoji" trigger={<><Smile size={18}/><span className="guide-tip" role="tooltip"><b>Emoji</b><small>Game icons and Rocky in the text</small></span></>} triggerClass="guide-ribbon-btn" menuClass="guide-emoji-menu" disabled={disabled||!text}>{close=>Object.entries(GUIDE_EMOJIS).map(([name,src])=><button key={name} type="button" role="menuitem" aria-label={guideEmojiLabel(name)} title={guideEmojiLabel(name)} onMouseDown={e=>e.preventDefault()} onClick={()=>{close();setFormat({kind:'emoji',name,id:Date.now(),blockId:active});}}><img src={src} alt=""/></button>)}</ToolbarMenu>
    </div></div>
    {RIBBON.map(g=><div key={g.label} className="guide-ribbon-group"><small>{g.label}</small><div>{g.ids.map(id=>{const item=INSERTS.find(x=>x.id===id)!;return <RibbonButton key={id} label={item.label} hint={item.hint} icon={item.icon} disabled={full} onClick={()=>pick(id)}/>;})}</div></div>)}
   </div>
  </div>
  <div className="guide-doc-workspace">
   <nav className="guide-doc-outline" aria-label="Document outline"><b>On this page</b><button type="button" onClick={()=>document.getElementById('guide-document-title')?.focus()}>{guide.title||'Untitled guide'}</button>{blocks.map(b=>(b.kind!=='text'||b.style==='heading'||b.style==='subheading')&&<button type="button" key={b.id} className={b.kind==='text'&&b.style==='subheading'?'is-sub':''} aria-current={active===b.id?'location':undefined} onClick={()=>{setActive(b.id);document.getElementById('doc-'+b.id)?.scrollIntoView({block:'center',behavior:'smooth'});}}>{b.kind==='text'?guidePlainText(b.text)||'Untitled heading':b.kind==='columns'?(b.columns.some(Boolean)?b.columns.map(c=>c?(c.kind==='text'?guidePlainText(c.text).slice(0,24)||blockLabel(c):blockLabel(c)):'Empty').join(' · '):blockLabel(b)):blockLabel(b)}</button>)}</nav>
   <article className="guide-doc-paper">
    <header><input id="guide-document-title" aria-label="Guide title" placeholder="Untitled guide" maxLength={100} value={guide.title} disabled={disabled} onChange={e=>onChange({...guide,title:e.target.value})}/><div className="guide-doc-topic">{topic&&<img src={topic} alt=""/>}<input className="guide-doc-activity" aria-label="Boss or activity" placeholder="Boss or activity" maxLength={100} value={guide.activity} disabled={disabled} onChange={e=>onChange({...guide,activity:e.target.value})}/></div><textarea aria-label="Guide introduction" placeholder="A short introduction to your guide…" rows={2} maxLength={500} value={guide.summary} disabled={disabled} onChange={e=>onChange({...guide,summary:e.target.value})}/></header>
    {blocks.map((b,i)=><section id={'doc-'+b.id} key={b.id} className={`guide-doc-block kind-${b.kind} ${active===b.id?'is-active':''} ${b.kind==='text'?`doc-${b.style} tone-${b.tone}`:''}`} onFocus={()=>setActive(b.id)} onClick={()=>setActive(b.id)}>
     <div className="guide-block-actions"><small>{blockLabel(b)}</small><button type="button" disabled={disabled||i===0} aria-label="Move section up" title="Move up" onClick={()=>move(i,-1)}><ArrowUp size={14}/></button><button type="button" disabled={disabled||i===blocks.length-1} aria-label="Move section down" title="Move down" onClick={()=>move(i,1)}><ArrowDown size={14}/></button>{b.kind==='columns'?<><span className="guide-split" role="radiogroup" aria-label="Column widths">{GUIDE_COLUMN_SPLITS.map(x=><button type="button" key={x} role="radio" aria-checked={b.split===x} aria-label={SPLIT_LABEL[x]} title={SPLIT_LABEL[x]} disabled={disabled} onClick={()=>columnsPatch(b.id,{split:x})}><i className={'split-'+x.replace(':','-')}><b/><b/></i></button>)}</span><button type="button" disabled={disabled} aria-label="Swap the columns" title="Swap sides" onClick={()=>columnsPatch(b.id,{columns:[b.columns[1],b.columns[0]]})}><ArrowLeftRight size={14}/></button></>:fitsColumn(b)&&<button type="button" disabled={disabled} aria-label="Put in two columns" title="Put in two columns" onClick={()=>wrap(i)}><Columns2 size={14}/></button>}{b.kind!=='text'&&b.kind!=='divider'&&b.kind!=='columns'&&<button type="button" disabled={disabled} aria-label="Edit section" title="Edit" onClick={()=>open(b.kind as InsertKind,b.id)}><Pencil size={13}/></button>}<button type="button" className="is-danger" disabled={disabled||blocks.length===1} aria-label="Remove section" title="Remove" onClick={()=>update(blocks.filter(x=>x.id!==b.id))}><Trash2 size={13}/></button></div>
     {b.kind==='columns'?<div className={'guide-columns is-editing split-'+b.split.replace(':','-')}>{b.columns.map((c,n)=>{const side=n as Side,label=side?'Right column':'Left column';return <div key={side} id={c?'doc-'+c.id:undefined} className={`guide-column ${c?'':'is-empty'} ${c&&active===c.id?'is-active':''} ${c?.kind==='text'?`doc-${c.style} tone-${c.tone}`:''}`} onFocus={e=>{if(c){e.stopPropagation();setActive(c.id);}}} onClick={e=>{if(c){e.stopPropagation();setActive(c.id);}}}>
      {c?<><div className="guide-column-bar"><small>{label} · {blockLabel(c)}</small>{c.kind!=='text'&&<button type="button" disabled={disabled} aria-label={`Edit ${label.toLowerCase()}`} title="Edit" onClick={()=>open(c.kind as InsertKind,c.id)}><Pencil size={13}/></button>}<button type="button" disabled={disabled||full} aria-label={`Move ${label.toLowerCase()} out of the columns`} title="Move out of the columns" onClick={()=>moveOut(i,side)}><ArrowUpFromLine size={13}/></button><button type="button" className="is-danger" disabled={disabled} aria-label={`Remove ${label.toLowerCase()}`} title="Remove" onClick={()=>update(setSide(blocks,b.id,side,null))}><Trash2 size={13}/></button></div>{leafBody(c,`${label} of section ${i+1}`,true)}</>
      :<div className="guide-column-empty"><small>{label}</small><ToolbarMenu label={`Add a section to the ${label.toLowerCase()}`} trigger={<><Plus size={15} aria-hidden="true"/>Add a section</>} triggerClass="btn sm" menuClass="guide-column-menu" disabled={disabled}>{close=>COLUMN_INSERTS.map(x=><button key={x.id} type="button" role="menuitem" onClick={()=>{close();fill(b.id,side,x.id);}}>{x.icon}<span>{x.label}</span></button>)}</ToolbarMenu>{(fitsColumn(blocks[i-1])||fitsColumn(blocks[i+1]))&&<span className="guide-column-move">{fitsColumn(blocks[i-1])&&<button type="button" className="btn sm ghost" disabled={disabled} onClick={()=>bringIn(i,side,-1)}><ArrowUp size={14} aria-hidden="true"/>Move the section above in</button>}{fitsColumn(blocks[i+1])&&<button type="button" className="btn sm ghost" disabled={disabled} onClick={()=>bringIn(i,side,1)}><ArrowDown size={14} aria-hidden="true"/>Move the section below in</button>}</span>}</div>}
     </div>;})}</div>:leafBody(b,`Section ${i+1}`)}
    </section>)}
    <button type="button" className="guide-add-paragraph" disabled={full} onClick={()=>{const block=textBlock();update([...blocks,block]);setActive(block.id);}}><Plus size={15} aria-hidden="true"/>Continue writing</button>
   </article>
  </div>
  {insert&&<InsertDialog key={insert+editing} kind={insert} guide={guide} block={findBlock(blocks,editing)} uploads={uploads} onClose={close} onApply={apply}/>}
 </div>;
}
/** A published guide's sections. Headings carry their contents anchor; a pair of columns with one side empty shows the other at full width.
 * A heading right before a pair of columns (a step above its text and map) moves to the top of the text column, so it sits level with
 * the map's title or the card beside it; it keeps its anchor. Columns with no text side keep the heading above both. Columns holding a
 * map show their sections one after the other at full width, since a map's stops sit beside it as its steps. */
export function GuideDocumentBlocks({guide}:{guide:Guide}) {
 const blocks=guideBlocks(guide),anchors=new Map(guideHeadings(blocks).map(h=>[h.blockId,h.anchor]));
 const leaf=(b:GuideBlock,narrow=false)=><section id={anchors.get(b.id)} className={b.kind==='text'?`doc-${b.style} tone-${b.tone}`:''} key={b.id}><DocumentBlock guide={guide} block={b} narrow={narrow}/></section>;
 const isHeading=(b:GuideBlock|undefined)=>b?.kind==='text'&&(b.style==='heading'||b.style==='subheading');
 // A map takes the full width (its stops are the steps beside it), so columns holding one show their sections one after the other.
 const hasMap=(b:GuideBlock|undefined)=>b?.kind==='columns'&&b.columns.some(c=>c?.kind==='map');
 const textSide=(b:GuideBlock|undefined)=>b?.kind==='columns'&&b.columns[0]&&b.columns[1]&&!hasMap(b)?b.columns.findIndex(c=>c?.kind==='text'):-1;
 return <div className="guide-document-published">{blocks.map((b,i)=>{
  if(isHeading(b)&&textSide(blocks[i+1])>=0)return null;
  if(b.kind!=='columns')return leaf(b);const [l,r]=b.columns;if(!l||!r)return l||r?leaf((l??r)!):null;
  if(hasMap(b))return <Fragment key={b.id}>{leaf(l)}{leaf(r)}</Fragment>;
  const head=isHeading(blocks[i-1])?blocks[i-1]:null,side=head?textSide(b):-1;
  const column=(c:GuideLeafBlock,n:number)=>n===side?<div className="guide-column-stack" key={c.id}>{leaf(head!)}{leaf(c,true)}</div>:leaf(c,true);
  return <div key={b.id} className={'guide-columns split-'+b.split.replace(':','-')}>{column(l,0)}{column(r,1)}</div>;})}</div>;
}
function DocumentBlock({guide,block:b,narrow=false}:{guide:Guide;block:GuideBlock;narrow?:boolean}) {
 if(b.kind==='text')return <FormattedText text={b.text}/>;
 if(b.kind==='divider')return <hr/>;
 if(b.kind==='requirements')return <section className="guide-requirements"><h3>Requirements</h3><RequirementGroups guide={guide}/><FormattedText text={guide.requirements}/>{!guideHasRequirements(guide)&&<p className="fine">Select Edit to add skills, quests, diaries, items or anything else.</p>}</section>;
 if(b.kind==='costs')return <CostTable title={b.title} rows={b.rows} per={b.per}/>;
 if(b.kind==='drops')return <GuideDrops page={b.page}/>;
 if(b.kind==='loadouts'||b.kind==='gear'||b.kind==='inventory'){const all=guideSetups(guide),setups=guideSectionSetups(b).map(id=>all.find(s=>s.id===id)).filter(s=>!!s);if(!setups.length)return null;return <GuideKit key={setups.map(s=>s.id).join()} setups={setups} gear={b.kind!=='inventory'} inventory={b.kind!=='gear'} notes={b.kind!=='gear'} fallback={b.kind==='loadouts'?all.find(s=>s.id===b.inventoryId):undefined}/>;}
 if(b.kind==='odds')return <GuideOdds block={b} narrow={narrow}/>;
 if(b.kind==='prayers'||b.kind==='spells')return <section className="guide-casts"><h3>{b.kind==='prayers'?'Prayers':'Spells'}</h3><ul>{b.names.map(n=>{const r=guideReference(n);return <li key={n}><EntityHover target={referenceTarget(r)} name={r.name} href={r.href}><a href={r.href} target="_blank" rel="noreferrer">{r.icon&&<img src={r.icon} alt=""/>}<span>{r.name}</span></a></EntityHover></li>;})}</ul></section>;
 if(b.kind==='map')return <GuideMap map={b}/>;
 if(b.kind==='rewards')return <GuideRewards block={b}/>;
 if(b.kind==='image')return <figure className="guide-image"><img src={b.url} alt={b.caption||'Guide image'} loading="lazy" referrerPolicy="no-referrer"/>{b.caption&&<figcaption>{b.caption}</figcaption>}</figure>;
 return null;
}
/** A drop's odds: the chance of a drop by a kill count, and a curve of the chance against kills. The plot keeps its shape on its
 * own and grows taller when the card is stretched, such as beside a drop table in two columns. */
function GuideOdds({block:b,narrow=false}:{block:Extract<GuideBlock,{kind:'odds'}>;narrow?:boolean}){
 const chart=oddsCurve(1/b.rate,b.count),maximum=chart.max||1,plot=useRef<HTMLDivElement>(null);
 // Wide viewBox: the chart fills the guide column instead of shrinking to keep a tall aspect ratio.
 const X=48,W=narrow?420:900,T=18,VW=W+60,[VH,setVH]=useState(228);
 useEffect(()=>{const el=plot.current;if(!el)return;const fit=()=>{const {width,height}=el.getBoundingClientRect();if(width>0&&height>0)setVH(Math.max(228,Math.round(height*VW/width)));};fit();const ro=new ResizeObserver(fit);ro.observe(el);return()=>ro.disconnect();},[VW]);
 const B=VH-28,line=chart.curve.map((p,i)=>`${i?'L':'M'} ${X+p.a/maximum*W} ${B-p.c*(B-T)}`).join(' '),mark=X+b.count/maximum*W;
 return <section className="guide-odds"><h3>{b.name}</h3><p className="fine">1/{num(b.rate,0)} per {b.unit.replace(/s$/,'')}{narrow?'':' · independent, constant-rate attempts'}</p><div className="guide-odds-stats"><span>Mean hunt<b>{num(b.rate,0)} {b.unit}</b></span><span>Chance by {num(b.count,0)}<b>{pct(chart.chance??0)}</b></span><span>Still dry<b>{pct(1-(chart.chance??0))}</b></span></div><div className="guide-chance-bar"><i style={{width:`${(chart.chance??0)*100}%`}}/></div><div className="guide-odds-plot" ref={plot} style={{aspectRatio:`${VW} / 228`}}><svg viewBox={`0 0 ${VW} ${VH}`} role="img" aria-label={`Chance of obtaining a drop by ${b.count} ${b.unit}: ${pct(chart.chance??0)}`}><path d={`M${X} ${T}V${B}H${X+W}`} stroke="#635d4d" fill="none"/><path d={`${line} L ${X+W} ${B} L ${X} ${B} Z`} fill="#e6a13d14" stroke="none"/><path d={line} fill="none" stroke="#e6a13d" strokeWidth="2.5"/><line x1={mark} x2={mark} y1={T} y2={B} stroke="#edda7a" strokeDasharray="5 5"/><text x={X-8} y={T+5} textAnchor="end">100%</text><text x={X-8} y={B} textAnchor="end">0%</text><text x={X} y={B+22}>0</text><text x={X+W} y={B+22} textAnchor="end">{num(chart.max,0)} {b.unit}</text></svg></div><p className="fine" title="Estimates for independent, constant-rate attempts, not guarantees.">50% by {num(chart.at(.5),0)} · 90% by {num(chart.at(.9),0)} · 95% by {num(chart.at(.95),0)}{narrow?'':` ${b.unit}. Estimates, not guarantees.`}</p></section>;
}
type RequirementKind='skill'|'quest'|'diary'|'item';
const FILTERS:[RequirementKind|'all',string][]=[['all','All'],['skill','Skills'],['quest','Quests'],['diary','Diaries'],['item','Items']];
type Candidate={kind:RequirementKind;id:string;label:string;detail?:string;icon:ReactNode;rank:number};
const rankOf=(name:string,q:string)=>{const n=name.toLowerCase();return n===q?0:n.startsWith(q)?1:n.split(/[^a-z0-9']+/).some(w=>w.startsWith(q))?2:n.includes(q)?3:9;};
/** One search across skills, quests, diaries and items, best matches first; filters narrow it to one kind. Custom requirements sit underneath. */
function RequirementPicker({guide,onChange}:{guide:Guide;onChange:(next:(g:Guide)=>Guide)=>void}){
 const [mode,setMode]=useState<'required'|'recommended'>('required'),[filter,setFilter]=useState<RequirementKind|'all'>('all'),[query,setQuery]=useState(''),[label,setLabel]=useState(''),[icon,setIcon]=useState<string|null>(null),[plain,setPlain]=useState<GuideIconKey>('task'),[iconQuery,setIconQuery]=useState('');
 const rec=mode==='recommended',items=(rec?guide.recommendedItems:guide.requiredItems)??[],picked=guide.requiredQuests??[],diaries=guide.requiredDiaries??[],skills=(rec?guide.recommendedSkills:guide.requiredSkills)??[],other=guide.requiredOther??[],q=query.trim().toLowerCase();
 // Recommended covers skills and items only; quests and diaries are always required.
 const want=(k:RequirementKind)=>(filter==='all'||filter===k)&&(!rec||k==='skill'||k==='item');
 const pool:Candidate[]=[
  ...(want('skill')?GUIDE_SKILLS.map(n=>({kind:'skill' as const,id:n,label:n,detail:'Skill',icon:<img src={`/icons/skills/${n.toLowerCase()}.png`} alt=""/>,rank:q?rankOf(n,q):1})):[]),
  ...(want('quest')&&(q||filter==='quest')?guideQuests.map(n=>({kind:'quest' as const,id:n,label:n,detail:quests[n]?.difficulty?`${quests[n].difficulty} quest`:'Quest',icon:<img src="/ui/quest-point-icon.png" alt=""/>,rank:q?rankOf(n,q):1})):[]),
  ...(want('diary')&&(q||filter==='diary')?guideDiaryAreas.flatMap(a=>guideDiaryTiers.map(t=>({kind:'diary' as const,id:a+'|'+t,label:`${a} ${t}`,detail:'Achievement diary',icon:<img src="/ui/achievement-diaries-icon.png" alt=""/>,rank:q?Math.min(rankOf(a,q),rankOf(`${a} ${t}`,q)):1}))):[]),
  ...(want('item')&&q?searchGuideItems(query,guideItemChoices,40).map(([id,name])=>({kind:'item' as const,id,label:name,detail:'Item',icon:<ItemImage id={id}/>,rank:rankOf(name,q)+.5})):[]),
 ];
 const results=pool.filter(c=>c.rank<9).sort((a,b)=>a.rank-b.rank).slice(0,60);
 const added=(c:Candidate)=>c.kind==='skill'?skills.some(r=>r.skill===c.id):c.kind==='quest'?picked.includes(c.id):c.kind==='diary'?diaries.some(d=>d.area+'|'+d.tier===c.id):items.some(i=>i.id===c.id);
 function toggle(c:Candidate){
  const on=added(c);
  const sk=rec?'recommendedSkills':'requiredSkills',it=rec?'recommendedItems':'requiredItems';
  if(c.kind==='skill')onChange(g=>({...g,[sk]:on?(g[sk]??[]).filter(r=>r.skill!==c.id):[...(g[sk]??[]),{skill:c.id,level:rec?70:50}]}));
  else if(c.kind==='quest')onChange(g=>({...g,requiredQuests:on?(g.requiredQuests??[]).filter(n=>n!==c.id):[...(g.requiredQuests??[]),c.id]}));
  else if(c.kind==='diary'){const [area,tier]=c.id.split('|');onChange(g=>({...g,requiredDiaries:on?(g.requiredDiaries??[]).filter(d=>d.area!==area||d.tier!==tier):[...(g.requiredDiaries??[]),{area,tier}]}));}
  else onChange(g=>({...g,[it]:on?(g[it]??[]).filter(i=>i.id!==c.id):[...(g[it]??[]),{id:c.id,quantity:1}]}));
 }
 const iconResults=iconQuery.trim()?searchGuideItems(iconQuery,guideItemChoices,12):[];
 return <div className="guide-req-picker">
  <div className="guide-req-mode" role="radiogroup" aria-label="Add as">{(['required','recommended'] as const).map(m=><button type="button" key={m} role="radio" aria-checked={mode===m} className={'btn sm'+(mode===m?' primary':'')} onClick={()=>{setMode(m);if(m==='recommended'&&(filter==='quest'||filter==='diary'))setFilter('all');}}>{m==='required'?'Required':'Recommended'}</button>)}</div>
  <label className="search guide-req-search"><Search size={16} aria-hidden="true"/><input aria-label="Search requirements" placeholder={rec?'Search skills and items…':'Search skills, quests, diaries and items…'} value={query} onChange={e=>setQuery(e.target.value)}/></label>
  <div className="guide-req-filters" role="radiogroup" aria-label="Show">{FILTERS.filter(([k])=>!rec||k==='all'||k==='skill'||k==='item').map(([k,l])=><button type="button" key={k} role="radio" aria-checked={filter===k} className={filter===k?'on':''} onClick={()=>setFilter(k)}>{l}</button>)}</div>
  <div className="guide-req-results">{results.map(c=>{const on=added(c);return <button type="button" key={c.kind+c.id} aria-pressed={on} onClick={()=>toggle(c)}>{c.icon}<span>{c.label}<small>{c.detail}</small></span>{on?<Check size={16} aria-label="Added"/>:<Plus size={16} aria-hidden="true"/>}</button>;})}{!results.length&&<p className="fine">{q?'No matches. Add it as a custom requirement below.':'Type to search, or pick a filter to browse.'}</p>}</div>
  <details className="guide-req-custom"><summary>Custom requirement</summary>
   <label>Requirement<input maxLength={100} placeholder="For example: Krack on Slayer reward unlocked" value={label} onChange={e=>setLabel(e.target.value)}/></label>
   <div className="guide-req-custom-icon">{icon&&<span className="guide-req-custom-preview" title="Item icon chosen"><OtherIcon itemId={icon}/></span>}<div className="guide-req-plain-icons" role="radiogroup" aria-label="Icon">{(Object.keys(GUIDE_OTHER_ICONS) as GuideIconKey[]).map(k=><button type="button" key={k} role="radio" aria-checked={!icon&&plain===k} title={GUIDE_OTHER_ICONS[k][0]} aria-label={GUIDE_OTHER_ICONS[k][0]} onClick={()=>{setIcon(null);setPlain(k);}}><img src={GUIDE_OTHER_ICONS[k][1]} alt=""/></button>)}</div><label className="search"><Search size={14} aria-hidden="true"/><input aria-label="Search an item icon" placeholder="Or use an item's icon…" value={iconQuery} onChange={e=>setIconQuery(e.target.value)}/></label></div>
   {iconResults.length>0&&<div className="guide-req-icon-results">{iconResults.map(([id,name])=><button type="button" key={id} title={name} aria-label={`Use the ${name} icon`} aria-pressed={icon===id} onClick={()=>setIcon(icon===id?null:id)}><ItemImage id={id}/></button>)}</div>}
   <button type="button" className="btn sm primary" disabled={other.length>=20||label.trim().length<2} onClick={()=>{onChange(g=>({...g,requiredOther:[...(g.requiredOther??[]),{label:label.trim(),itemId:icon,...(!icon&&plain!=='task'?{icon:plain}:{})}]}));setLabel('');setIcon(null);setPlain('task');setIconQuery('');}}>Add custom requirement</button>
  </details>
 </div>;
}

/** Find a drop table as you type: bosses and activities by name, or the page that holds a drop or pet. */
function DropSourceSearch({value,onChoose}:{value:string;onChoose:(page:string)=>void}){
 const [query,setQuery]=useState(''),[results,setResults]=useState<{page:string;match?:string;img?:string}[]>([]);
 useEffect(()=>{const q=query.trim();if(q.length<2){setResults([]);return;}let live=true;const t=setTimeout(()=>fetch('/api/drops?search='+encodeURIComponent(q)).then(r=>r.ok?r.json() as Promise<{results:typeof results}>:{results:[]}).then(d=>{if(live)setResults(d.results);}).catch(()=>{if(live)setResults([]);}),200);return()=>{live=false;clearTimeout(t);};},[query]);
 return <div className="drop-source">
  {value&&<div className="drop-source-chosen"><img src={pageIcon(value)} alt=""/><b>{value}</b><small>Drop table</small></div>}
  <label className="search"><Search size={16} aria-hidden="true"/><input aria-label="Search a boss, activity, drop or pet" placeholder={value?'Search another boss, drop or pet…':'Search a boss, activity, drop or pet…'} value={query} onChange={e=>setQuery(e.target.value)}/></label>
  {query.trim().length>=2&&<div className="drop-source-results" role="listbox" aria-label="Drop tables">{results.map(r=><button type="button" role="option" aria-selected={r.page===value} key={r.page} onClick={()=>{onChoose(r.page);setQuery('');}}><img src={r.match&&r.img?`/drops/${r.img}`:pageIcon(r.page)} alt=""/><span>{r.page}{r.match&&<small>Drops {r.match}</small>}</span></button>)}{!results.length&&<p className="fine">No drop table matches.</p>}</div>}
 </div>;
}
/** A setup with one inventory slot's stack set (null or a single, unnoted item clears it). */
function withStack(p:GuideSetupProfile,slot:number,next:{quantity:number;noted:boolean}|null):GuideSetupProfile{
 const stacks={...p.stacks};delete stacks[slot];if(next&&(next.quantity>1||next.noted))stacks[slot]={quantity:next.quantity,...(next.noted?{noted:true}:{})};
 const out={...p};delete out.stacks;return Object.keys(stacks).length?{...out,stacks}:out;
}
/** How many of the open slot's item to carry, and whether they are noted. */
function StackFields({value,onChange}:{value:{quantity:number;noted:boolean};onChange:(next:{quantity:number;noted:boolean})=>void}){
 const [text,setText]=useState(String(value.quantity));
 useEffect(()=>setText(String(value.quantity)),[value.quantity]);
 const commit=(raw:string)=>{const n=Math.floor(Number(raw.replace(/[,\s]/g,'')));const q=Number.isFinite(n)?Math.min(GUIDE_MAX_STACK,Math.max(1,n)):1;setText(String(q));if(q!==value.quantity)onChange({...value,quantity:q});};
 return <div className="guide-stack-fields"><label>Quantity<input type="number" inputMode="numeric" min={1} max={GUIDE_MAX_STACK} step={1} value={text} onChange={e=>{setText(e.target.value);const n=Number(e.target.value);if(Number.isSafeInteger(n)&&n>=1&&n<=GUIDE_MAX_STACK)onChange({...value,quantity:n});}} onBlur={e=>commit(e.target.value)}/></label><label className="guide-stack-noted"><input type="checkbox" checked={value.noted} onChange={e=>onChange({...value,noted:e.target.checked})}/>Noted</label></div>;
}
type KitDraft={profiles:GuideSetupProfile[];tabs:string[];active:string;fresh:string[]};
/** A name no other setup uses: Setup 3, Setup 4… */
const freeName=(profiles:GuideSetupProfile[],base='Setup')=>{for(let n=profiles.length+1;;n++){const name=`${base} ${n}`;if(!profiles.some(p=>p.name.toLowerCase()===name.toLowerCase()))return name;}};
/** The section's tabs to edit; a new section starts with one new, empty setup. */
function startKit(guide:Guide,block?:GuideBlock):KitDraft{
 const profiles=structuredClone(guideSetups(guide)),tabs=block&&block.kind!=='columns'?guideSectionSetups(block).filter(id=>profiles.some(p=>p.id===id)):[];
 if(tabs.length)return {profiles,tabs,active:tabs[0],fresh:[]};
 if(profiles.length>=8)return {profiles,tabs:[profiles[0].id],active:profiles[0].id,fresh:[]};
 const setup=newGuideSetup(freeName(profiles),crypto.randomUUID());return {profiles:[...profiles,setup],tabs:[setup.id],active:setup.id,fresh:[setup.id]};
}
/** Check the tabs and work out the guide's setups: a setup this section dropped goes unless another section still shows it. */
function finishKit(guide:Guide,block:GuideBlock|undefined,kit:KitDraft):{tabs:string[];setups:GuideSetupProfile[]}|string{
 if(kit.profiles.some(p=>!p.name.trim()))return 'Give every tab a name.';
 if(new Set(kit.profiles.map(p=>p.name.trim().toLowerCase())).size!==kit.profiles.length)return 'Use a different name for each tab.';
 if(kit.profiles.some(p=>(p.note??'').length>400))return 'Keep each note to 400 characters.';
 const others=guideLeafBlocks(guideBlocks(guide)).filter(b=>b.id!==block?.id),used=new Set(others.flatMap(b=>[...guideSectionSetups(b),...(b.kind==='loadouts'&&b.inventoryId?[b.inventoryId]:[])]));
 const before=block&&block.kind!=='columns'?guideSectionSetups(block):[];
 const setups=kit.profiles.filter(p=>kit.tabs.includes(p.id)||used.has(p.id)||!before.includes(p.id)).map(p=>({...p,name:p.name.trim(),...(p.note?.trim()?{note:p.note.trim()}:{note:undefined})}));
 if(setups.length>8)return 'A guide can hold up to eight setups. Reuse one, or delete a tab.';
 return {tabs:kit.tabs,setups:setups.map(({note,...rest})=>note?{...rest,note}:rest)};
}
/** Tabs for a gear, inventory or gear-and-inventory section: add (new, a copy, or a setup another section uses), rename,
 * reorder and delete, then fill the open tab's slots. Gear and inventory share their tabs. */
function KitEditor({kind,kit,setKit,setup,slot,onSlot,picker}:{kind:'gear'|'inventory'|'loadouts';kit:KitDraft;setKit:(next:(k:KitDraft)=>KitDraft)=>void;setup:GuideSetupProfile;slot:EquipSlot|number;onSlot:(slot:EquipSlot|number)=>void;picker:ReactNode}){
 const tabs=kit.tabs.map(id=>kit.profiles.find(p=>p.id===id)!).filter(Boolean),at=kit.tabs.indexOf(kit.active),spare=kit.profiles.filter(p=>!kit.tabs.includes(p.id)),full=kit.profiles.length>=8;
 const rename=(name:string)=>setKit(k=>({...k,profiles:k.profiles.map(p=>p.id===k.active?{...p,name}:p)}));
 function add(from?:GuideSetupProfile){const setup=from?{...structuredClone(from),id:crypto.randomUUID(),name:freeName(kit.profiles,from.name.replace(/\s+\d+$/,'')||'Setup')}:newGuideSetup(freeName(kit.profiles),crypto.randomUUID());setKit(k=>({...k,profiles:[...k.profiles,setup],tabs:[...k.tabs,setup.id],active:setup.id,fresh:[...k.fresh,setup.id]}));}
 const reuse=(id:string)=>setKit(k=>({...k,tabs:[...k.tabs,id],active:id}));
 const move=(by:-1|1)=>setKit(k=>{const tabs=[...k.tabs],i=tabs.indexOf(k.active);[tabs[i],tabs[i+by]]=[tabs[i+by],tabs[i]];return {...k,tabs};});
 const remove=()=>setKit(k=>{const tabs=k.tabs.filter(id=>id!==k.active),i=Math.max(0,k.tabs.indexOf(k.active)-1);return {...k,tabs,active:tabs[i],profiles:k.fresh.includes(k.active)?k.profiles.filter(p=>p.id!==k.active):k.profiles};});
 return <div className="guide-kit-editor">
  <div className="guide-kit-editor-tabs"><SetupTabList setups={tabs} active={kit.active} onPick={id=>setKit(k=>({...k,active:id}))} label="Setups shown as tabs" idPrefix="kit-edit"/>
   <ToolbarMenu label="Add a tab" trigger={<><Plus size={15} aria-hidden="true"/>Add tab</>} triggerClass="btn sm ghost" menuClass="guide-column-menu guide-kit-add-menu" disabled={false}>{close=><>
    <button type="button" role="menuitem" disabled={full} onClick={()=>{close();add();}}><Plus size={16} aria-hidden="true"/><span>New empty tab</span></button>
    <button type="button" role="menuitem" disabled={full} onClick={()=>{close();add(setup);}}><img src="/ui/slots/body.png" className="slot-silhouette" alt=""/><span>Copy of {setup.name}</span></button>
    {spare.map(p=><button type="button" role="menuitem" key={p.id} onClick={()=>{close();reuse(p.id);}}><img src="/icons/navigation/combat-achievements-icon.png" alt=""/><span>{p.name}<small>Shown in another section</small></span></button>)}
   </>}</ToolbarMenu></div>
  <div className="guide-kit-editor-bar">
   <label>Tab name<input maxLength={60} value={setup.name} onChange={e=>rename(e.target.value)}/></label>
   <span className="guide-kit-editor-actions"><button type="button" className="btn sm ghost" aria-label="Move tab left" title="Move left" disabled={at<=0} onClick={()=>move(-1)}><ArrowLeft size={15}/></button><button type="button" className="btn sm ghost" aria-label="Move tab right" title="Move right" disabled={at>=kit.tabs.length-1} onClick={()=>move(1)}><ArrowRight size={15}/></button><button type="button" className="btn sm ghost is-danger" disabled={kit.tabs.length<2} onClick={remove}><Trash2 size={14} aria-hidden="true"/>Delete tab</button></span>
  </div>
  <div className={'guide-insert-loadout kit-'+kind}><div className="guide-kit-editor-grids">{kind!=='inventory'&&<WornSlots setup={setup} selected={slot} onSelect={onSlot}/>}{kind!=='gear'&&<BagSlots setup={setup} selected={slot} onSelect={onSlot}/>}</div>{picker}</div>
  {kind==='loadouts'&&<label className="guide-kit-editor-note">Note under {setup.name||'this tab'}<textarea rows={2} maxLength={400} placeholder="Cost, why this setup, what to upgrade next…" value={setup.note??''} onChange={e=>{const note=e.target.value;setKit(k=>({...k,profiles:k.profiles.map(p=>p.id===k.active?{...p,note}:p)}));}}/></label>}
 </div>;
}
function InsertDialog({kind,guide,block,uploads,onClose,onApply}:{kind:InsertKind;guide:Guide;block?:GuideBlock;uploads:boolean;onClose:()=>void;onApply:(b:GuideBlock,extra:Partial<Guide>)=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 // Gear, inventory and gear-and-inventory sections edit their tabs here: every setup in the guide, the ones this section shows, and the open tab.
 const [kit,setKit]=useState(()=>startKit(guide,block));
 const kitSetup=kit.profiles.find(p=>p.id===kit.active)??kit.profiles[0];
 const [slot,setSlot]=useState<EquipSlot|number>(kind==='inventory'?0:'head'),[query,setQuery]=useState('');
 const [requirements,setRequirements]=useState(()=>structuredClone(guide));
 const [chart,setChart]=useState<Extract<GuideBlock,{kind:'odds'}>>(()=>block?.kind==='odds'?block:{id:crypto.randomUUID(),kind:'odds',name:'Drop expectations',rate:3000,count:3000,unit:'kills'});
 const [costs,setCosts]=useState<Extract<GuideBlock,{kind:'costs'}>>(()=>block?.kind==='costs'?structuredClone(block):{id:crypto.randomUUID(),kind:'costs',title:'Weapon',rows:[]}),[costTarget,setCostTarget]=useState<number>(-1),[costQuery,setCostQuery]=useState('');
 const [dropBlock,setDropBlock]=useState<Extract<GuideBlock,{kind:'drops'}>>(()=>block?.kind==='drops'?structuredClone(block):{id:crypto.randomUUID(),kind:'drops',page:guide.activity});
 const [oddsPage,setOddsPage]=useState(guide.activity),[picked,setPicked]=useState<string|null>(()=>block?.kind==='odds'?block.name:null);
 const [casts,setCasts]=useState<string[]>(()=>block&&(block.kind==='prayers'||block.kind==='spells')?block.names:[]),[castQuery,setCastQuery]=useState('');
 const [image,setImage]=useState(()=>block?.kind==='image'?{url:block.url,caption:block.caption}:{url:'',caption:''});
 const [mapDraft,setMapDraft]=useState<GuideMapData>(()=>block?.kind==='map'?{title:block.title,x:block.x,y:block.y,plane:block.plane,zoom:block.zoom,pins:block.pins,...(block.lines===false?{lines:false}:{})}:newGuideMap());
 const [rewards,setRewards]=useState<GuideRewardsBlock>(()=>block?.kind==='rewards'?structuredClone(block):newRewards(guideQuests.includes(guide.activity)?guide.activity:''));
 const [uploading,setUploading]=useState(false);
 // Uploads go straight to the site's image storage; the server checks the type and the size and daily caps again.
 async function upload(file:File){
  if(file.size>UPLOAD_LIMITS.fileBytes)return setError(`Images can be up to ${UPLOAD_LIMITS.fileBytes/1024/1024} MB. Shrink it or paste a link.`);
  setUploading(true);setError('');
  try{const r=await fetch('/api/staff/guides/upload',{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});const j=await r.json().catch(()=>({})) as {url?:string;error?:string};if(!r.ok||!j.url)throw Error(j.error??'Could not upload that image.');setImage(i=>({...i,url:j.url!}));}
  catch(e){setError(e instanceof Error?e.message:'Could not upload that image.');}
  finally{setUploading(false);}
 }
 const [error,setError]=useState('');
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
 const results=searchGuideItems(query,typeof slot==='string'?guideSlotChoices(slot):guideItemChoices,80);
 const itemPicker=(onPut:(id:string|null)=>void)=><section className="guide-picker"><div className="section-heading"><b>{typeof slot==='number'?`Slot ${slot+1}`:slot}</b><button className="btn sm ghost" onClick={()=>onPut(null)}>Clear slot</button></div>{typeof slot==='number'&&kitSetup.inventory[slot]&&<StackFields key={kitSetup.id+slot} value={guideSlotStack(kitSetup,slot)} onChange={stack}/>}<label className="search"><Search size={16} aria-hidden="true"/><input aria-label="Search loadout items" placeholder="Search items…" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="guide-item-results">{results.map(([id,name])=><button key={id} aria-label={name} title={name} onClick={()=>onPut(id)}><ItemImage id={id}/><span>{name}</span></button>)}</div><p className="fine">Showing up to 80 matches. Search to narrow the catalogue.</p></section>;
 function put(id:string|null){setKit(k=>({...k,profiles:k.profiles.map(p=>p.id!==k.active?p:typeof slot==='string'?{...p,equipment:equipItem(p.equipment,slot,id)}:p.inventory[slot]===id?p:withStack({...p,inventory:p.inventory.map((old,i)=>i===slot?id:old)},slot,null))}));}
 // The open inventory slot's stack size and noted flag; a single, unnoted item stores nothing.
 const stack=(next:{quantity:number;noted:boolean})=>{if(typeof slot==='number')setKit(k=>({...k,profiles:k.profiles.map(p=>p.id===k.active?withStack(p,slot,next):p)}));};
 function apply(){
  if(kind==='gear'||kind==='inventory'||kind==='loadouts'){const done=finishKit(guide,block,kit);if(typeof done==='string')return setError(done);const {tabs,setups:next}=done,id=block?.id??crypto.randomUUID();
   const inventoryId=block?.kind==='loadouts'&&block.inventoryId&&next.some(s=>s.id===block.inventoryId)?block.inventoryId:undefined;
   onApply(kind==='loadouts'?{id,kind,setupIds:tabs,...(inventoryId?{inventoryId}:{})}:{id,kind,setupId:tabs[0],...(tabs.length>1?{setupIds:tabs}:{})},{setups:next,equipment:next[0].equipment,inventory:next[0].inventory});}
  else if(kind==='requirements')onApply({id:block?.id??crypto.randomUUID(),kind},{requirements:requirements.requirements,requiredItems:requirements.requiredItems,requiredQuests:requirements.requiredQuests,requiredDiaries:requirements.requiredDiaries,requiredSkills:requirements.requiredSkills,requiredOther:requirements.requiredOther,recommendedSkills:requirements.recommendedSkills,recommendedItems:requirements.recommendedItems});
  else if(kind==='drops'){if(!dropBlock.page.trim())return setError('Name the boss or activity whose drop table to show.');onApply({...dropBlock,id:block?.id??dropBlock.id},{});}
  else if(kind==='costs'){if(!costs.rows.length||costs.rows.some(r=>!r.parts.length))return setError('Add at least one item or spell, each with what one use consumes.');onApply({...costs,id:block?.id??costs.id},{});}
  else if(kind==='prayers'||kind==='spells'){if(!casts.length)return setError(`Choose at least one ${kind==='prayers'?'prayer':'spell'}.`);onApply({id:block?.id??crypto.randomUUID(),kind,names:casts},{});}
  else if(kind==='map'){if(mapDraft.pins.some(p=>p.label.length>60))return setError('Keep each stop label to 60 characters.');if(mapDraft.pins.some(p=>(p.dialogue??[]).filter(l=>l.trim()).length>MAP_STOP_LIMITS.dialogue))return setError(`Use up to ${MAP_STOP_LIMITS.dialogue} chat options on a stop.`);onApply({id:block?.id??crypto.randomUUID(),kind:'map',...mapDraft,title:mapDraft.title.trim(),pins:mapDraft.pins.map(tidyStop)},{});}
  else if(kind==='rewards'){const problem=rewardsProblem(rewards);if(problem)return setError(problem);onApply({...tidyRewards(rewards),id:block?.id??rewards.id},{});}
  else if(kind==='image'){if(!/^https:\/\//i.test(image.url.trim())&&!isUploadUrl(image.url.trim()))return setError('Upload an image or paste a link that starts with https://.');onApply({id:block?.id??crypto.randomUUID(),kind:'image',url:image.url.trim(),caption:image.caption.trim()},{});}
  else {if(!chart.name.trim()||!Number.isFinite(chart.rate)||chart.rate<1||chart.rate>1e12||!Number.isSafeInteger(chart.count)||chart.count<0||chart.count>1e12)return setError('Enter a valid rate and whole attempt count.');onApply(chart,{});}
 }
 const count=(requirements.recommendedSkills?.length??0)+(requirements.recommendedItems?.length??0)+(requirements.requiredItems?.length??0)+(requirements.requiredQuests?.length??0)+(requirements.requiredDiaries?.length??0)+(requirements.requiredSkills?.length??0)+(requirements.requiredOther?.length??0);
 return <dialog ref={dialog} className="modal guide-insert-dialog" aria-label={`Insert ${kind}`} onCancel={onClose}><header><div><span className="kicker">{block?'Edit section':'Insert into document'}</span><h2>{kind==='gear'?'Gear profile':kind==='inventory'?'Inventory profile':kind==='requirements'?'Requirements':kind==='loadouts'?'Gear and inventory':kind==='costs'?'Cost table':kind==='drops'?'Drop table':kind==='prayers'?'Prayers':kind==='spells'?'Spells':kind==='image'?'Image or GIF':kind==='map'?'Map':kind==='rewards'?'Rewards':'Drop odds & dry streak chart'}</h2></div><button className="icon-btn" aria-label="Close insert editor" onClick={onClose}>×</button></header><div className="guide-insert-body">{error&&<p role="alert">{error}</p>}
 {(kind==='gear'||kind==='inventory'||kind==='loadouts')&&<KitEditor kind={kind} kit={kit} setKit={setKit} setup={kitSetup} slot={slot} onSlot={x=>{setSlot(x);setQuery('');}} picker={itemPicker(put)}/>}
 {kind==='requirements'&&<div className="guide-req-layout"><RequirementPicker guide={requirements} onChange={next=>setRequirements(next)}/><section className="guide-req-chosen"><h3>Added <small>{count}</small></h3>{count?<RequirementBadges guide={requirements} onEdit={setRequirements}/>:<p className="fine">Nothing added yet.</p>}<label className="guide-requirement-note">Additional requirements<textarea rows={3} maxLength={4000} value={requirements.requirements} onChange={e=>setRequirements(g=>({...g,requirements:e.target.value}))}/></label></section></div>}
 {kind==='drops'&&<div className="guide-cost-editor"><DropSourceSearch value={dropBlock.page} onChoose={page=>setDropBlock(d=>({...d,page}))}/>{dropBlock.page&&<div className="drop-source-table"><GuideDrops page={dropBlock.page}/></div>}<p className="fine">Shows the full drop table for this boss or activity, with links to the OSRS Wiki.</p></div>}
 {kind==='costs'&&<div className="guide-cost-editor"><label className="guide-cost-title">First column heading<input maxLength={80} value={costs.title} onChange={e=>setCosts(c=>({...c,title:e.target.value}))}/></label>
  {costs.rows.map((r,i)=><section className="guide-cost-row" key={(r.spell??r.itemId)+i}><div className="guide-cost-row-head">{r.spell!==undefined?<><img src={guideReference(r.spell).icon??'/icons/skills/magic.png'} alt=""/><b>{r.spell}</b></>:<><ItemImage id={r.itemId}/><b>{guideItemChoices.find(([id])=>id===r.itemId)?.[1]??r.itemId}</b></>}<button type="button" className="link" onClick={()=>setCosts(c=>({...c,rows:c.rows.filter((_,n)=>n!==i)}))}>Remove</button></div><div className="guide-cost-parts-edit">{r.parts.map((p,k)=><label key={p.itemId} title={guideItemChoices.find(([id])=>id===p.itemId)?.[1]}><ItemImage id={p.itemId}/><input type="number" min={0.01} step="any" aria-label="Quantity per use" value={p.quantity} onChange={e=>setCosts(c=>({...c,rows:c.rows.map((x,n)=>n===i?{...x,parts:x.parts.map((y,m)=>m===k?{...y,quantity:Math.max(0.01,Number(e.target.value)||1)}:y)}:x)}))}/><button type="button" className="link" aria-label="Remove" onClick={()=>setCosts(c=>({...c,rows:c.rows.map((x,n)=>n===i?{...x,parts:x.parts.filter((_,m)=>m!==k)}:x)}))}>×</button></label>)}<button type="button" className="btn sm ghost" onClick={()=>{setCostTarget(i);setCostQuery('');}}>Add what it uses</button></div></section>)}
  <div className="guide-cost-add"><button type="button" className="btn sm" aria-pressed={costTarget===-1} disabled={costs.rows.length>=12} onClick={()=>{setCostTarget(-1);setCostQuery('');}}>Add an item</button><button type="button" className="btn sm" aria-pressed={costTarget===COST_SPELL} disabled={costs.rows.length>=12} onClick={()=>{setCostTarget(COST_SPELL);setCostQuery('');}}>Add a spell</button></div>
  <label className="search"><Search size={16} aria-hidden="true"/><input aria-label={costTarget===COST_SPELL?'Search spells':'Search items'} placeholder={costTarget===COST_SPELL?'Search the spell to add a row for…':costTarget<0?'Search the item to add a row for…':'Search what this row uses per cast…'} value={costQuery} onChange={e=>setCostQuery(e.target.value)}/></label>
  {costTarget===COST_SPELL?<div className="guide-item-results">{(costQuery.trim()?COST_SPELLS.filter(n=>n.toLowerCase().includes(costQuery.trim().toLowerCase())).slice(0,40):[]).map(name=><button key={name} type="button" aria-label={name} title={name} onClick={()=>{const magic=guideMagic('spell',name);setCosts(c=>({...c,rows:[...c.rows,{spell:name,parts:magic?magicRunes(magic).map(r=>({itemId:r.id,quantity:r.amount})):[]}]}));setCostTarget(costs.rows.length);setCostQuery('');}}><img src={guideReference(name).icon??'/icons/skills/magic.png'} alt=""/><span>{name}</span></button>)}</div>
  :<div className="guide-item-results">{(costQuery.trim()?searchGuideItems(costQuery,guideItemChoices,40):[]).map(([id,name])=><button key={id} type="button" aria-label={name} title={name} onClick={()=>{setCosts(c=>costTarget<0?{...c,rows:[...c.rows,{itemId:id,parts:[]}]}:{...c,rows:c.rows.map((x,n)=>n===costTarget&&!x.parts.some(p=>p.itemId===id)?{...x,parts:[...x.parts,{itemId:id,quantity:1}]}:x)});if(costTarget<0)setCostTarget(costs.rows.length);setCostQuery('');}}><ItemImage id={id}/><span>{name}</span></button>)}</div>}
  <p className="fine">Costs use live Grand Exchange prices. Untradeable items show no price. A spell fills in its runes per cast; change the amounts for a staff or rune pouch.</p></div>}
 {(kind==='prayers'||kind==='spells')&&(()=>{const list=kind==='prayers'?GUIDE_PRAYERS:GUIDE_SPELLS,q=castQuery.trim().toLowerCase(),shown=list.filter(n=>!q||n.toLowerCase().includes(q));return <div className="guide-cast-editor">
  <label className="search"><Search size={16} aria-hidden="true"/><input aria-label={`Search ${kind}`} placeholder={kind==='prayers'?'Search prayers…':'Search spells and teleports…'} value={castQuery} onChange={e=>setCastQuery(e.target.value)}/></label>
  <div className="guide-cast-options">{shown.map(n=>{const on=casts.includes(n),r=guideReference(n);return <button type="button" key={n} aria-pressed={on} onClick={()=>setCasts(c=>on?c.filter(x=>x!==n):c.length<16?[...c,n]:c)}>{r.icon&&<img src={r.icon} alt=""/>}<span>{n}</span>{on&&<Check size={14} aria-hidden="true"/>}</button>;})}</div>
  <p className="fine">{casts.length?`Chosen, in order: ${casts.join(', ')}`:`Pick the ${kind} in the order to use them (up to 16).`}</p></div>;})()}
 {kind==='map'&&<GuideMapEditor value={mapDraft} onChange={setMapDraft}/>}
 {kind==='rewards'&&<GuideRewardsEditor value={rewards} onChange={setRewards}/>}
 {kind==='image'&&<div className="guide-image-editor">{uploads&&<><label className={'guide-upload'+(uploading?' is-busy':'')}><Upload size={18} aria-hidden="true"/><span><b>{uploading?'Uploading…':isUploadUrl(image.url)?'Replace the uploaded image':'Upload an image or GIF'}</b><small>PNG, JPG, WebP or GIF, up to {UPLOAD_LIMITS.fileBytes/1024/1024} MB</small></span><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={uploading} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(f)void upload(f);}}/></label><p className="guide-upload-or">or paste a link</p></>}<label>Image or GIF link<input type="url" placeholder="https://…/picture.gif" value={isUploadUrl(image.url)?'':image.url} onChange={e=>setImage(i=>({...i,url:e.target.value}))}/></label><label>Caption (optional)<input maxLength={200} value={image.caption} onChange={e=>setImage(i=>({...i,caption:e.target.value}))}/></label>{(/^https:\/\//i.test(image.url.trim())||isUploadUrl(image.url))&&<figure className="guide-image"><img src={image.url.trim()} alt="Preview" referrerPolicy="no-referrer"/></figure>}<p className="fine">{uploads?'A direct link works too, for example from Imgur or the OSRS Wiki.':'Use a direct link to a PNG, JPG, WebP or GIF (for example from Imgur or the OSRS Wiki).'}</p></div>}
 {kind==='odds'&&<><DropSourceSearch value={oddsPage} onChoose={setOddsPage}/>{oddsPage&&<div className="drop-source-table"><GuideDrops page={oddsPage} edit={{name:picked,rate:chart.rate,onPick:(name,p)=>{setPicked(name);setChart(c=>({...c,name,...(p?{rate:Math.round(1/p),count:Math.round(1/p)}:{}),unit:'kills'}));},onRate:rate=>setChart(c=>({...c,rate}))}}/></div>}<p className="fine">Use the pen beside a drop or pet to chart it; its rate can be changed in the table or below.</p><div className="guide-insert-fields"><label>Chart title<input maxLength={100} value={chart.name} onChange={e=>setChart(c=>({...c,name:e.target.value}))}/></label><label>Drop rate: 1 in<input type="number" min={1} max={1e12} step="any" value={chart.rate} onChange={e=>setChart(c=>({...c,rate:Number(e.target.value)}))}/></label><label>Kill count<input type="number" min={0} max={1e12} value={chart.count} onChange={e=>setChart(c=>({...c,count:Number(e.target.value)}))}/></label><label>Unit<select value={chart.unit} onChange={e=>setChart(c=>({...c,unit:e.target.value}))}>{['kills','searches','rolls','runs','catches','actions'].map(u=><option key={u}>{u}</option>)}</select></label></div>{chart.rate>=1&&chart.count>=0&&Number.isFinite(chart.rate)&&Number.isFinite(chart.count)&&<GuideOdds block={chart}/>}<p className="fine">For a fixed independent chance per attempt. This chart does not model changing skilling or raid rates.</p></>}
 </div><footer><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" onClick={apply}>{block?'Update section':'Insert section'}</button></footer></dialog>;
}
