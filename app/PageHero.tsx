import type {ReactNode} from 'react';
import './page-hero.css';
/** The banner at the top of a community page: the castle art behind a kicker, the page title with its icon (and an
 * optional status badge right after it), one line of text and the page's stats and actions, with Rocky on the right.
 * Every community page uses this one component, so titles, icons, stats, badges and buttons share one size. */
export function PageHero({kicker,icon,iconClass,title,text,badge,actions}:{kicker:string;icon:string;iconClass?:string;title:string;text:string;badge?:ReactNode;actions?:ReactNode}){
 const heading=<h1><img className={'page-title-icon'+(iconClass?' '+iconClass:'')} src={icon} alt=""/>{title}</h1>;
 return <header className="page-hero">
  <div className="page-hero-text"><span className="kicker">{kicker}</span>{badge?<div className="page-hero-title">{heading}{badge}</div>:heading}<p>{text}</p>{actions&&<div className="page-hero-actions">{actions}</div>}</div>
  <img className="page-hero-art" src="/brand/rocky-mascot.webp" alt=""/>
 </header>;
}
