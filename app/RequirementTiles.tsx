'use client';
import {ItemHover} from './ItemPriceCard';
import {guideItemImage} from '@/lib/guides';
import {wiki} from '@/lib/ui';
import './adventure-requirements.css';

const FALLBACK='/ui/collection-log-icon.png';
/** An item's official inventory icon, falling back to the collection log mark when the game has none we can use. */
export function RequirementItemIcon({id}:{id:string}){return <img className="req-item-icon" src={guideItemImage(id)??`/items/${id}.png`} alt="" onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=FALLBACK;}}/>;}
type Item={id:string;name:string};
/** One required item, the same tile in quest and diary panels and guides: icon, name (to the OSRS Wiki), a short note
 * and the amount before the name, with the price card (stack total included) on hover, focus or tap. Alternatives share one tile and
 * keep a price card per icon. */
export function ItemRequirementTile({items,quantity=1,note,label,className=''}:{items:Item[];quantity?:number;note?:string;label?:string;className?:string}){
 const qty=quantity>1?<small className="req-qty">{quantity.toLocaleString('en-US')} ×</small>:null;
 const noteTag=note?<small className="req-note" title={note}>{note}</small>:null;
 if(items.length===1&&!label){
  const [item]=items;
  return <li className={('has-card '+className).trim()}><ItemHover id={item.id} name={item.name} quantity={quantity} className="req-card" focusable>
   <RequirementItemIcon id={item.id}/>{qty}<span className="req-name"><a href={wiki(item.name)} target="_blank" rel="noreferrer">{item.name}</a>{noteTag}</span>
  </ItemHover></li>;
 }
 return <li className={('req-alts '+className).trim()}>
  <span className="req-alt-icons">{items.map(item=><ItemHover key={item.id} id={item.id} name={item.name} quantity={quantity} className="req-alt" focusable><RequirementItemIcon id={item.id}/></ItemHover>)}</span>
  {qty}<span className="req-name"><b>{label??items.map(i=>i.name).join(' or ')}</b>{noteTag}</span>
 </li>;
}
