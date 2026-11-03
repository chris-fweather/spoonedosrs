import type {ReactNode} from 'react';
import {HoverTip} from './HoverTip';
import {badgeLabel,type BadgeInfo} from '@/lib/badge-info';

/** A badge's hover card in the companion pet card's style: name, what it means or how it is earned, then label/value lines. */
export function BadgeCard({info}:{info:BadgeInfo}){
 return <span className="pet-tooltip-content badge-card"><strong className="tooltip-heading">{info.name}</strong>{info.description&&<span>{info.description}</span>}{info.details.map(([label,value])=><span key={label} className="tooltip-detail"><span>{label}:</span> <b>{value}</b></span>)}</span>;
}

/** Hover, focus or tap a badge for its card. The card replaces any native tooltip an ancestor link carries. Inside a link (board rows) pass tabIndex -1 so the row stays one tab stop;
 * a tap still previews the card first, and the next tap follows the link. */
export function BadgeHover({info,className='',tabIndex=0,children}:{info:BadgeInfo;className?:string;tabIndex?:number;children:ReactNode}){
 return <HoverTip className={className} title="" label={badgeLabel(info)} tabIndex={tabIndex} content={<BadgeCard info={info}/>}>{children}</HoverTip>;
}
