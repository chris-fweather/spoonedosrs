'use client';
import type {ReactNode} from 'react';
import {ExternalLink,Map as MapIcon} from 'lucide-react';
import {HoverTip} from './HoverTip';
import {ItemHover} from './ItemPriceCard';
import {hoverCard,type HoverTarget} from '@/lib/guide-hovers';
import {SKILL_MAX_LEVEL,skillInfo} from '@/lib/skill-info';
import {wiki} from '@/lib/ui';
import {SPELLBOOK_NAMES,guideMagic,magicNeeds,magicRunes,type GuideMagic} from '@/lib/guide-magic';
import {guideReference} from '@/lib/guide-references';
import {WORLD_MAP_PAGE} from '@/lib/features';
import {travelIcon,travelMapHref,travelSnippetTiles,travelSpot,travelTitle,travelWhat,type GuideTravel} from '@/lib/guide-travel';
import './entity-hover.css';

/** A skill's card, in the item price card's family (same tooltip, same label/value cells): the skill's icon and name
 * with pills for free-to-play or members and its type, what it does in one line, its key facts as a two-column grid
 * (max level first; a fact naming a spell, prayer, item or boss shows its game icon) and a link to its OSRS Wiki page. */
export function SkillCard({name}:{name:string}){
 const info=skillInfo(name);if(!info)return null;
 const facts=[{label:'Max level',value:String(SKILL_MAX_LEVEL)},...info.facts];
 return <span className="skc">
  <span className="skc-head"><img src={`/icons/skills/${info.name.toLowerCase()}.png`} alt="" width={30} height={30}/>
   <span className="skc-title"><b>{info.name}</b><span className="skc-pills"><small className={'skc-pill'+(info.members?' is-members':'')}>{info.members?'Members':'Free-to-play'}</small>{info.category&&<small className="skc-pill">{info.category}</small>}</span></span>
  </span>
  <span className="skc-summary">{info.summary}</span>
  <span className="skc-grid">{facts.map(f=><span key={f.label} className={'skc-cell'+(f.icon?' has-icon':'')}>{f.icon&&<img src={f.icon} alt="" width={24} height={24}/>}<small>{f.label}</small><b>{f.value}</b></span>)}</span>
  <span className="skc-foot"><a href={wiki(info.name)} target="_blank" rel="noreferrer">OSRS Wiki<ExternalLink size={11} aria-hidden="true"/></a></span>
 </span>;
}

/** The map snippet's size: the card's inner width, and short enough to keep the card compact. */
/** `scale` draws the zoom-2 squares a little smaller, so the snippet shows more of the area around the landing spot. */
const SNIPPET={width:296,height:160,scale:.7};
/** A small piece of the world map centred on where a destination lands, with a marker, from the guide maps' own tiles.
 * Squares that fail to load (offline, or open sea) leave the map's dark background, so the marker and the caption
 * (the area's name and the tile) still say where it is. */
function TravelSnippet({spot}:{spot:GuideTravel}){
 const {width,height,scale}=SNIPPET,tiles=travelSnippetTiles({x:spot.x,y:spot.y,plane:spot.plane},width/scale,height/scale);
 const tile=`${spot.x}, ${spot.y}${spot.plane?` · floor ${spot.plane}`:''}`;
 return <span className="trc-map" aria-hidden="true">
  {tiles.map(t=><img key={t.src} src={t.src} alt="" width={256} height={256} loading="lazy" decoding="async" style={{left:Math.floor(t.left*scale),top:Math.floor(t.top*scale),width:Math.ceil(256*scale)+1,height:Math.ceil(256*scale)+1}} onError={e=>{e.currentTarget.style.visibility='hidden';}}/>)}
  <span className="trc-marker"/>
  <span className="trc-caption">{spot.area&&<b>{spot.area}</b>}<small>{tile}</small></span>
 </span>;
}
/** A travel destination's card, in the skill card's family: its icon, where it goes and what it is ("Standard spellbook
 * · 37 Magic", "Fairy ring · BLP"), a map snippet of the landing spot, what it needs from the travel data, and links to
 * the world map there and the OSRS Wiki. */
export function TravelCard({spot,href}:{spot:GuideTravel;href:string}){
 // What it needs, one per line like a guide's requirements: "37 Magic", the quest's name, "1,000 coins".
 const needs=[
  ...(spot.req.s??[]).map(([skill,level])=>({key:'s'+skill,icon:`/icons/skills/${skill.toLowerCase()}.png`,text:`${level} ${skill}`})),
  ...(spot.req.q??[]).filter((q,i,all)=>all.indexOf(q)===i).map(q=>({key:'q'+q,icon:'/ui/quest-point-icon.png',text:q})),
  ...(spot.req.c?[{key:'c',icon:'/items/995.png',text:`${spot.req.c.toLocaleString('en-US')} coins`}]:[]),
 ];
 return <span className="skc trc">
  <span className="skc-head"><img src={travelIcon(spot)} alt="" width={30} height={30}/>
   <span className="skc-title"><b>{travelTitle(spot)}</b><span className="trc-what">{travelWhat(spot)}{spot.unlock&&<small className="skc-pill">Unlock needed</small>}</span></span>
  </span>
  <TravelSnippet spot={spot}/>
  {needs.length>0&&<span className="trc-needs">{needs.map(n=><span key={n.key}><img src={n.icon} alt="" width={20} height={20}/><b>{n.text}</b></span>)}</span>}
  <span className="skc-foot trc-foot">{WORLD_MAP_PAGE&&<a href={travelMapHref(spot)}><MapIcon size={12} aria-hidden="true"/>World map</a>}<a href={href} target="_blank" rel="noreferrer">OSRS Wiki<ExternalLink size={11} aria-hidden="true"/></a></span>
 </span>;
}

/** A prayer's or spell's card, in the travel card's family: its game icon, its name and what it does in one line, what
 * it needs as a plain list ("94 Magic", "Ancient Magicks", the quest, a prayer scroll) and, for a spell, its spellbook's icon
 * then one cast's runes with their icons and amounts, then a link to its OSRS Wiki page. */
export function MagicCard({magic,href}:{magic:GuideMagic;href:string}){
 const needs=magicNeeds(magic),runes=magicRunes(magic),book=magic.kind==='spell'?magic.book??'standard':null,icon=guideReference(magic.name).icon??`/icons/skills/${magic.kind==='prayer'?'prayer':'magic'}.png`;
 return <span className="skc trc mgc">
  <span className="skc-head"><img src={icon} alt="" width={30} height={30}/>
   <span className="skc-title"><b>{magic.name}</b><span className="trc-what">{magic.effect}</span></span>
  </span>
  <span className="trc-needs">{needs.map(n=><span key={n.key}><img src={n.icon} alt="" width={20} height={20}/><b>{n.text}</b></span>)}</span>
  {runes.length>0&&<span className="mgc-runes" aria-label={'Runes per cast: '+runes.map(r=>`${r.amount} ${r.name}`).join(', ')}>{book&&<span className="mgc-book" title={SPELLBOOK_NAMES[book]}><img src={`/icons/game/spellbook-${book}.png`} alt={SPELLBOOK_NAMES[book]} width={22} height={22}/></span>}{runes.map(r=><span key={r.id} title={`${r.amount} ${r.name}`}><img src={r.icon} alt="" width={22} height={22}/><b>{r.amount}</b></span>)}</span>}
  <span className="skc-foot"><a href={href} target="_blank" rel="noreferrer">OSRS Wiki<ExternalLink size={11} aria-hidden="true"/></a></span>
 </span>;
}

/** Hover, focus or tap a game thing for its card (lib/guide-hovers decides which): an item's price, a skill's rundown,
 * where a teleport or transport lands, what a prayer or spell does and needs. Things without a card render as they are. The skill, travel and magic cards hold links,
 * so they stay open while the pointer moves onto them. */
export function EntityHover({target,name,quantity,href,children,className='',focusable=false}:{target:HoverTarget|null;name?:string;quantity?:number;/** The Wiki page a travel card links to. */href?:string;children:ReactNode;className?:string;focusable?:boolean}){
 const card=target&&hoverCard(target);
 if(card==='price'&&target?.kind==='item')return <ItemHover id={target.id} name={name} quantity={quantity} className={className} focusable={focusable}>{children}</ItemHover>;
 if(card==='skill'&&target?.kind==='skill'&&skillInfo(target.name))return <HoverTip label={target.name} className={'skc-trigger '+className} tipClass="skc-tip" tabIndex={focusable?0:-1} interactive content={<SkillCard name={target.name}/>}>{children}</HoverTip>;
 const spot=card==='travel'&&target?.kind==='travel'?travelSpot(target.travel,target.name):null;
 if(spot)return <HoverTip label={name??travelTitle(spot)} className={'skc-trigger '+className} tipClass="skc-tip" tabIndex={focusable?0:-1} interactive content={<TravelCard spot={spot} href={href??wiki(spot.name)}/>}>{children}</HoverTip>;
 const magic=card==='magic'&&(target?.kind==='prayer'||target?.kind==='spell')?guideMagic(target.kind,target.name):null;
 if(magic)return <HoverTip label={name??magic.name} className={'skc-trigger '+className} tipClass="skc-tip" tabIndex={focusable?0:-1} interactive content={<MagicCard magic={magic} href={href??wiki(magic.name)}/>}>{children}</HoverTip>;
 return <>{children}</>;
}
