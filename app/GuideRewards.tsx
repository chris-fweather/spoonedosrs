'use client';
import type {ReactNode} from 'react';
import {GuideRef,ItemImage,InlineText,useGuidePrices} from './GuideParts';
import {ItemHover} from './ItemPriceCard';
import {guideInline,guideItems,GUIDE_REWARD_ANY_SKILL,type GuideInline,type GuideRewardsBlock,type GuideRewardSource,type GuideRewardTier} from '@/lib/guides';
import {guideReference} from '@/lib/guide-references';
import './guide-rewards.css';

const n=(v:number)=>v.toLocaleString('en-US');
/** XP for any skill (a lamp) shows the antique lamp; a skill shows its icon. */
const xpIcon=(skill:string)=>skill===GUIDE_REWARD_ANY_SKILL?'/items/4447.png':`/icons/skills/${skill.toLowerCase()}.png`;

/** Each casket tier's reward casket (its inventory icon) and name. A casket without a tier shows the plain casket. */
export const REWARD_TIERS:Record<GuideRewardTier,{label:string;title:string}>={
 beginner:{label:'Beginner',title:'Reward casket (beginner)'},easy:{label:'Easy',title:'Reward casket (easy)'},
 medium:{label:'Medium',title:'Reward casket (medium)'},hard:{label:'Hard',title:'Reward casket (hard)'},
 elite:{label:'Elite',title:'Reward casket (elite)'},master:{label:'Master',title:'Reward casket (master)'},
};
const casketIcon=(tier?:GuideRewardTier)=>tier?`/icons/ui-reward/casket-${tier}.png`:'/items/405.png';
/** Where chest loot comes from: its name, its icon in the window's title bar and `title`, the default title for a new
 * section (the game's window title; the Chambers' window just says "Rewards", so the raid's name stands in). Every
 * source shares one window, the game's stone reward frame (clientscript 228, "steelborder") with the loot laid out in a row,
 * so every chest reads the same. */
export const REWARD_SOURCES:Record<GuideRewardSource,{label:string;title:string;art?:string}>={
 loot:{label:'Other loot',title:''},
 barrows:{label:'Barrows',title:'Barrows chest',art:'/bosses/barrows-chests.png'},
 cox:{label:'Chambers of Xeric',title:'Chambers of Xeric',art:'/bosses/chambers-of-xeric.png'},
 tob:{label:'Theatre of Blood',title:'Theatre of Blood',art:'/bosses/theatre-of-blood.png'},
 toa:{label:'Tombs of Amascut',title:'Tombs of Amascut',art:'/bosses/tombs-of-amascut.png'},
 lunar:{label:'Lunar Chest',title:'Lunar Chest',art:'/bosses/lunar-chests.png'},
 gauntlet:{label:'The Gauntlet',title:'Reward Chest (The Gauntlet)',art:'/bosses/the-gauntlet.png'},
};

/** One award row: an icon column and a text column, so every row's text starts at the same place. */
const Row=({icon,children,className=''}:{icon?:ReactNode;children:ReactNode;className?:string})=><li className={className}><span className="gr-icon">{icon}</span><span className="gr-text">{children}</span></li>;
/** A line's icon: the first thing it mentions that has one (the item, skill or spell it unlocks), else `fallback`. */
function lineIcon(text:string,fallback?:string){
 const first=(nodes:GuideInline[]):string|null=>{for(const x of nodes){if(typeof x==='string'||x.kind==='emoji')continue;const icon=x.kind==='ref'?guideReference(x.name).icon:first(x.children);if(icon)return icon;}return null;};
 return first(guideInline(text))??fallback;
}
/** Icons for lines that mention nothing with an icon: a quest's unlocks get the quest list's icon, a diary's perks the
 * diary's. Caskets and chests have none. */
const LINE_ICON:Partial<Record<GuideRewardsBlock['variant'],string>>={quest:'/ui/quest-list-icon.png',diary:'/ui/achievement-diaries-icon.png'};
/** The rows of a reward list: quest points, XP, items (with their price cards) and lines of text such as unlocks, which
 * may mention items and skills. Every row has its icon in the same column: a line takes what it mentions (its icon then
 * shows once, in the column, not again in the text). A skill's XP names the skill as a mention too, with its hover. */
function RewardRows({block:b}:{block:GuideRewardsBlock}){
 return <ul className="gr-list">
  {!!b.questPoints&&<Row icon={<img src="/ui/quest-point-icon.png" alt=""/>}><b>{b.questPoints}</b> Quest point{b.questPoints>1?'s':''}</Row>}
  {b.xp?.map((x,i)=><Row key={'xp'+i} icon={<img src={xpIcon(x.skill)} alt=""/>}><b>{n(x.amount)}</b> {x.skill===GUIDE_REWARD_ANY_SKILL?'XP in a skill of your choice':<><GuideRef name={x.skill}/> XP</>}</Row>)}
  {b.items?.map(i=><li key={'it'+i.id}><ItemHover id={i.id} quantity={i.quantity} className="gr-item" focusable><span className="gr-icon"><ItemImage id={i.id}/></span><span className="gr-text">{i.quantity>1&&<b>{n(i.quantity)} × </b>}<span className="gr-name">{guideItems[i.id]??'Item'}</span></span></ItemHover></li>)}
  {b.lines?.map((l,i)=>{const icon=lineIcon(l,LINE_ICON[b.variant]);return <Row key={'l'+i} className="gr-line" icon={icon&&<img src={icon} alt=""/>}><InlineText text={l}/></Row>;})}
 </ul>;
}
const hasRows=(b:GuideRewardsBlock)=>!!(b.questPoints||b.xp?.length||b.items?.length||b.lines?.length);

/** Money is worth its face value: coins and platinum tokens have no Grand Exchange price. */
const MONEY:Record<string,number>={'995':1,'13204':1000};
/** The loot's stack size in the game's colours: yellow, white from 100K, green from 10M. */
function Stack({q}:{q:number}){
 if(q<=1)return null;
 return <small className={'gr-stack'+(q>=1e7?' is-m':q>=1e5?' is-k':'')}>{q>=1e7?Math.floor(q/1e6)+'M':q>=1e5?Math.floor(q/1e3)+'K':q}</small>;
}
/** What the loot is worth at Grand Exchange prices, once they load. */
function useWorth(items:{id:string;quantity:number}[]){
 const loaded=useGuidePrices(items.map(i=>i.id)),prices=loaded&&loaded!=='unavailable'?{...loaded,...MONEY}:null;
 const known=prices?items.filter(i=>prices[i.id]!==undefined):[];
 return known.length&&prices?Math.round(known.reduce((t,i)=>t+prices[i.id]*i.quantity,0)):null;
}
/** Loot as the game lays it out: the items on their own, with their stack sizes in the corner. `row` lays them in one
 * centred, wrapping row (the reward window); without it they sit in rows of `cols` (three by default), as on the clue
 * scroll. */
function Loot({items,row,cols}:{items:{id:string;quantity:number}[];row?:boolean;cols?:number}){
 return <ul className={'gr-loot'+(row?' is-row':'')} style={cols?{['--gr-cols' as string]:Math.min(cols,items.length)}:undefined}>{items.map(i=><li key={i.id}><ItemHover id={i.id} quantity={i.quantity} className="gr-item gr-cell" focusable><ItemImage id={i.id}/><Stack q={i.quantity}/></ItemHover></li>)}</ul>;
}
/** A casket's or chest's notes under the loot (its pet and rate, say): lines of text in the game's font, centred like the
 * worth line above them and balanced so no word is left alone on a line; any quest points or XP stay as rows. */
function Notes({block:b}:{block:GuideRewardsBlock}){
 const rows={...b,items:undefined,lines:undefined};
 return <>
  {hasRows(rows)&&<div className="gr-awards"><RewardRows block={rows}/></div>}
  {b.lines?.map((l,i)=><p key={i} className="gr-note"><InlineText text={l}/></p>)}
 </>;
}
function Worth({items,lead}:{items:{id:string;quantity:number}[];lead:string}){
 const worth=useWorth(items);
 return worth===null?null:<p className="gr-worth">{lead} <b>{n(worth)}</b> coins!</p>;
}

/** The parchment scroll the game shows quest completions, clue rewards and the diary journal on (a 3D model in the game,
 * drawn here in CSS): rolled ends top and bottom around the sheet. */
const Scroll=({children}:{children:ReactNode})=><><span className="gr-roll is-top" aria-hidden="true"/><div className="gr-sheet">{children}</div><span className="gr-roll is-bottom" aria-hidden="true"/></>;
/** The scroll's picture on a round parchment plate, at twice its size and pixel-crisp. It is only a picture, so it has no price card. */
function Emblem({itemId,src}:{itemId?:string;src?:string}){
 return <div className="gr-emblem">{itemId?<ItemImage id={itemId}/>:<img src={src} alt=""/>}</div>;
}

/** Laid out like the diary scroll: what you are awarded (quest points, XP, items), then what the quest unlocks. */
function Quest({b}:{b:GuideRewardsBlock}){
 const rewards={...b,lines:undefined},unlocks={...b,questPoints:undefined,xp:undefined,items:undefined};
 return <Scroll>
  <header className="gr-head"><b className="gr-kicker">Congratulations!</b><h3>You have completed {b.title}!</h3></header>
  <div className="gr-body">
   <Emblem itemId={b.itemId} src="/ui/quest-point-icon.png"/>
   <div className="gr-awards">
    {hasRows(rewards)&&<><small className="gr-label">You are awarded:</small><RewardRows block={rewards}/></>}
    {hasRows(unlocks)&&<><small className="gr-label">Unlocks:</small><RewardRows block={unlocks}/></>}
   </div>
  </div>
 </Scroll>;
}
function Casket({b}:{b:GuideRewardsBlock}){
 const items=b.items??[],notes={...b,items:undefined};
 return <Scroll>
  <header className="gr-head is-stacked"><Emblem src={casketIcon(b.tier)}/><b className="gr-kicker">{b.title}</b>{b.tier&&<small className="gr-sub">{REWARD_TIERS[b.tier].label} clue scroll</small>}</header>
  {items.length>0&&<><Loot items={items} cols={items.length>9?6:3}/><Worth items={items} lead="Your treasure is worth around"/></>}
  {hasRows(notes)&&<Notes block={notes}/>}
 </Scroll>;
}
function Diary({b}:{b:GuideRewardsBlock}){
 const rewards={...b,lines:undefined},perks={...b,questPoints:undefined,xp:undefined,items:undefined};
 return <Scroll>
  <header className="gr-head"><b className="gr-kicker">{b.title}</b><small className="gr-sub">Achievement Diary</small></header>
  <div className="gr-body">
   <Emblem itemId={b.itemId} src="/ui/achievement-diaries-icon.png"/>
   <div className="gr-awards">
    {hasRows(rewards)&&<><small className="gr-label">You are awarded:</small><RewardRows block={rewards}/></>}
    {hasRows(perks)&&<><small className="gr-label">Perks:</small><RewardRows block={perks}/></>}
   </div>
  </div>
 </Scroll>;
}
function Chest({b}:{b:GuideRewardsBlock}){
 const source=REWARD_SOURCES[b.source??'loot'],items=b.items??[],notes={...b,items:undefined};
 return <div className="gr-window">
  <header className="gr-bar"><img src={source.art??'/ui/collection-log-icon.png'} alt=""/><h3>{b.title}</h3></header>
  <div className="gr-pane">
   {items.length>0&&<><Loot items={items} row/><Worth items={items} lead="Worth around"/></>}
   {hasRows(notes)&&<Notes block={notes}/>}
  </div>
 </div>;
}

/** A rewards section in the game's own style, one per kind of reward:
 * - quest: the quest completion scroll (interface 153): "Congratulations!", "You have completed …!", the quest's picture,
 *   "You are awarded:" over the awards and "Unlocks:" over what the quest opens up, as the diary scroll splits its perks.
 * - casket: the clue scroll reward (interface 73), also a scroll: the tier's reward casket, the items in rows of three
 *   straight on the parchment and "Your treasure is worth around … coins!" (the game says it in chat).
 * - diary: the game only says so in chat and gives the rewards through the diary's NPC; this is our scroll in the same
 *   style as the quest's, with the rewards and the perks.
 * - chest: the stone-framed reward window of Barrows (interface 155), the raids (539, 23, 771) and the Lunar Chest (868),
 *   one look for every source: the source's icon by the title and the loot on its own in a row. */
export function GuideRewards({block:b}:{block:GuideRewardsBlock}){
 const source=b.variant==='chest'?b.source??'loot':undefined;
 return <section className={'guide-rewards is-'+b.variant+(source?' from-'+source:'')} data-variant={b.variant} data-tier={b.tier} data-source={source} aria-label={`${b.title}: rewards`}>
  {b.variant==='quest'?<Quest b={b}/>:b.variant==='casket'?<Casket b={b}/>:b.variant==='diary'?<Diary b={b}/>:<Chest b={b}/>}
 </section>;
}
