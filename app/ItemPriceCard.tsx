'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {HoverTip} from './HoverTip';
import {guideItemImage,guideItems} from '@/lib/guides';
import {cardValue} from '@/lib/item-price';
import {potionEffect} from '@/lib/potion-effects';
import {itemSource} from '@/lib/item-sources';
import './item-price-card.css';

type ItemPrices={tradeable:false;highAlch?:number|null;quests?:string[]}|{tradeable:true;name:string;members:boolean;limit:number|null;high:number|null;highTime:number|null;low:number|null;lowTime:number|null;highAlch:number|null;lowAlch:number|null};
const cache=new Map<string,Promise<ItemPrices|null>>();
function load(id:string){
 let p=cache.get(id);
 if(!p){p=fetch('/api/prices/item?id='+id).then(r=>r.ok?r.json() as Promise<ItemPrices>:null).catch(()=>null);cache.set(id,p);p.then(v=>{if(!v)setTimeout(()=>cache.delete(id),30_000);});}
 return p;
}
const ago=(t:number|null)=>{if(!t)return 'No recent trade';const m=Math.max(1,Math.round((Date.now()/1000-t)/60));return m<60?`Traded ${m} min ago`:m<1440?`Traded ${Math.round(m/60)} h ago`:`Traded ${Math.round(m/1440)} d ago`;};

/** What an item is worth: the latest Grand Exchange buy and sell trades, both alchemy values and the buy limit. A potion
 * also says what it does. An untradeable item we know the source of (an achievement diary reward) says how you get it
 * instead of prices, and an untradeable quest item names its quest.
 * Untradeable items say so, with their high alchemy value when the Wiki lists one. With a quantity, each value
 * shows what the whole stack is worth, with the price of one underneath ("408", then "136 each"). */
export function ItemPriceCard({id,name,quantity=1}:{id:string;name?:string;quantity?:number}){
 const source=itemSource(guideItems[id]??name),[data,setData]=useState<ItemPrices|null|'loading'>('loading');
 useEffect(()=>{if(source)return;let live=true;load(id).then(v=>{if(live)setData(v);});return()=>{live=false;};},[id,source]);
 const title=name??guideItems[id]??'Item',icon=guideItemImage(id)??`/items/${id}.png`,stack=quantity>1,effect=potionEffect(guideItems[id]??name);
 const row=(label:string,value:number|null,img:string,tip?:string)=>{const v=cardValue(value,quantity);return <span className="ipc-cell" title={tip}><img src={img} alt=""/><small>{label}</small><b>{v.big}</b>{v.each&&<em className="ipc-each">{v.each}</em>}</span>;};
 return <span className="ipc">
  <span className="ipc-head">{icon&&<img src={icon} alt=""/>}<b>{title}</b>{stack&&<small className="ipc-qty">× {quantity.toLocaleString('en-US')}</small>}{source?<small className="ipc-members">Untradeable</small>:data&&data!=='loading'&&(data.tradeable?data.members&&<small className="ipc-members">Members</small>:<small className="ipc-members">Untradeable</small>)}</span>
  {effect&&<span className="ipc-effect">{effect}</span>}
  {source?<span className="ipc-source"><img src="/ui/achievement-diaries-icon.png" alt=""/><span><b>Achievement diary reward</b><small>Complete the {source.area} {source.tier} diary</small></span></span>
  :data==='loading'?<span className="ipc-note">Loading prices…</span>
  :!data?<span className="ipc-note">Prices are unavailable right now.</span>
  :!data.tradeable?<>{data.quests?.length?<span className="ipc-source"><img src="/ui/quest-point-icon.png" alt=""/><span><b>Quest item</b><small>{data.quests.slice(0,3).join(' · ')}</small></span></span>:null}{data.highAlch?<span className="ipc-grid is-single">{row('High alch',data.highAlch,'/icons/spells/high-level-alchemy.png')}</span>:null}</>
  :<>
   <span className="ipc-grid">
    {row('Buy',data.high,'/icons/navigation/grand-exchange-icon.png',ago(data.highTime))}
    {row('Sell',data.low,'/icons/navigation/grand-exchange-icon.png',ago(data.lowTime))}
    {row('High alch',data.highAlch,'/icons/spells/high-level-alchemy.png')}
    {row('Low alch',data.lowAlch,'/icons/spells/low-level-alchemy.png')}
   </span>
   <span className="ipc-foot">{data.limit?`Buy limit ${data.limit.toLocaleString('en-US')} · `:''}Latest GE trades · OSRS Wiki</span>
  </>}
 </span>;
}

/** Hover, focus or tap an item to see its price card. On touch the first tap shows the card and the second follows the link. */
export function ItemHover({id,name,quantity,children,className='',focusable=false}:{id:string;name?:string;quantity?:number;children:ReactNode;className?:string;focusable?:boolean}){
 return <HoverTip label={name??guideItems[id]??'Item'} className={'ipc-trigger '+className} tipClass="ipc-tip" tabIndex={focusable?0:-1} content={<ItemPriceCard id={id} name={name} quantity={quantity}/>}>{children}</HoverTip>;
}
