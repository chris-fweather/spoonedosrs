import type {ReactNode} from 'react';
import {ArrowLeft,ArrowRight} from 'lucide-react';
/** `extra` sits beside the page count, such as a board's players-per-page choice. */
export function Pagination({page,pages,onPage,label='Results',extra}:{page:number;pages:number;onPage:(page:number)=>void;label?:string;extra?:ReactNode}) {
 const total=Math.max(1,pages),current=Math.max(0,Math.min(page,total-1));
 return <nav className="slim-pagination" aria-label={`${label} pages`}>{extra?<span className="slim-pagination-info"><span aria-live="polite">Page {current+1} of {total}</span>{extra}</span>:<span aria-live="polite">Page {current+1} of {total}</span>}<div><button type="button" disabled={current===0} onClick={()=>onPage(current-1)} aria-label={`Previous ${label.toLowerCase()} page`} title="Previous page"><ArrowLeft size={25} strokeWidth={1.25}/></button><button type="button" disabled={current>=total-1} onClick={()=>onPage(current+1)} aria-label={`Next ${label.toLowerCase()} page`} title="Next page"><ArrowRight size={25} strokeWidth={1.25}/></button></div></nav>;
}
