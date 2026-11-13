'use client';
import {EntityHover} from './EntityHover';
import {guideMagicNames} from '@/lib/guide-magic';
import {guideReference} from '@/lib/guide-references';
import './guide-prayer-book.css';

/** A guide's prayers as the game's prayer book: every prayer in the book's own order, five to a row, with the chosen ones
 * lit like active prayers in game. The rest are dimmed, or left as empty slots when the writer hides them, so each chosen
 * prayer stays where players know to find it. Every prayer shown opens its card on hover, focus or tap. */
export function GuidePrayerBook({names,hide=false}:{names:string[];hide?:boolean}){
 const chosen=new Set(names.map(n=>guideReference(n).name));
 return <section className="guide-casts guide-prayer-book"><h3>Prayers</h3>
  <div className="gpb-book" role="list" aria-label={`Prayer book: ${[...chosen].join(', ')}`}>{guideMagicNames('prayer').map(name=>{
   const on=chosen.has(name),r=guideReference(name);
   if(!on&&hide)return <span key={name} className="gpb-slot is-empty" role="listitem" aria-hidden="true"/>;
   return <span key={name} className={'gpb-slot'+(on?' is-on':' is-off')} role="listitem"><EntityHover target={{kind:'prayer',name}} name={name} href={r.href} focusable>
    <img src={r.icon??'/icons/skills/prayer.png'} alt={on?name:`${name} (not used)`}/></EntityHover></span>;
  })}</div>
 </section>;
}
