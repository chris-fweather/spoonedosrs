import {badgeTier,type Mark} from '@/lib/flair';
/** Five twinkling stars around a legendary emblem, each on its own beat (app/globals.css .emblem-star). */
const STARS=[0,1,2,3,4];
/** Tint the sprite itself by tier. Every legendary emblem (All pets, Max cape, Complete collection log, Quest and Diary
 * complete, All combat tasks) shares the Max cape's golden shine with twinkling stars. */
export function AchievementEmblem({mark,className=''}:{mark:Mark;className?:string}) {
 const tier=badgeTier(mark.id),collection=mark.id.startsWith('pets-')||mark.id.startsWith('clog-')||mark.id.startsWith('combat-');
 return <span className={`achievement-emblem ${tier} ${collection?'collection-emblem':'plain-emblem'} ${tier==='legendary'?'legendary-emblem':''} ${mark.id==='max-cape'?'max-emblem':''} ${mark.id.startsWith('pets-')?'pet-emblem':''} ${className}`}><img src={mark.img} alt={mark.name}/>{tier==='legendary'&&STARS.map(n=><span key={n} className={`emblem-star emblem-star-${n}`} aria-hidden="true">✦</span>)}</span>;
}
