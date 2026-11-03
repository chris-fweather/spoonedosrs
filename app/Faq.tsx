'use client';
import {useId,useState,type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
import './faq.css';

/** Questions as an accordion: opening one closes the others. The first starts open. */
export function Faq({items}:{items:ReadonlyArray<readonly [string,ReactNode]>}){
 const [open,setOpen]=useState(0),id=useId();
 return <div className="support-faq">{items.map(([q,a],i)=><div key={q} className={'support-faq-item'+(open===i?' is-open':'')}><button type="button" aria-expanded={open===i} aria-controls={id+i} onClick={()=>setOpen(open===i?-1:i)}><span>{q}</span><ChevronDown size={18} aria-hidden="true"/></button><div id={id+i} role="region" hidden={open!==i}><p>{a}</p></div></div>)}</div>;
}
