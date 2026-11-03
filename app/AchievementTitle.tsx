'use client';
import {titleEffect} from '@/lib/presentation';
import {achievementTitleInfo} from '@/lib/badge-info';
import './title-rarities.css';
import {BadgeHover} from './BadgeCard';

/** An earned title in its rarity colour; hover, focus or tap it for how it is earned and its rarity.
 * Inside a link (board rows) pass tabIndex -1 so the link stays the only tab stop. */
export function AchievementTitle({label,className='',showHelp=true,tabIndex=0}:{label:string;className?:string;showHelp?:boolean;tabIndex?:number}) {
 const text=<span className={`achievement-text ${titleEffect(label)}`}>{label}</span>;
 if(!showHelp)return <span className={`achievement-title ${className}`}>{text}</span>;
 return <span className={`achievement-title ${className}`}><BadgeHover className="achievement-help" info={achievementTitleInfo(label)} tabIndex={tabIndex}>{text}</BadgeHover></span>;
}
