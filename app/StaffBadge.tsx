import type {ReactNode} from 'react';
import {STAFF_LABEL,STAFF_TONE,rankNameClass,type PublicStaff,type StaffRole} from '@/lib/staff-policy';
import type {PersonDisplay} from '@/lib/staff-people';
import {BadgeHover} from './BadgeCard';
import {rankBadgeInfo,squireInfo} from '@/lib/badge-info';
import type {NamePrefix} from '@/lib/name-prefix';
import type {Donation} from '@/lib/presentation';
import {OWNER_LAVA_MASK,RANK_STYLE,hasGildedSupporter,displayedBadgeLabel} from '@/lib/staff-appearance';
/** Shared scimitar silhouette; lava flows through the Owner blade's cracks. */
export function RankIcon({staff}:{staff:PublicStaff}) {
 const role=staff.displayRole??staff.role,style=RANK_STYLE[role];
 return <span className={`rank-icon rank-${role}`} aria-hidden="true"><span className="rank-weapon"><img src={style.src} alt=""/>{role==='owner'&&<i className="rank-magma" style={{maskImage:`url(${OWNER_LAVA_MASK})`,WebkitMaskImage:`url(${OWNER_LAVA_MASK})`}}/>}</span></span>;
}
export function StaffBadge({staff}:{staff?:PublicStaff|null}) {return staff?<span className={'staff-badge '+STAFF_TONE[staff.role]}><RankIcon staff={staff}/>{STAFF_LABEL[staff.role]}</span>:null;}
/** A rank as its scimitar and the rank word in the rank colour, without a box. */
export function RankLabel({role}:{role:StaffRole}) {return <span className={'rank-label '+STAFF_TONE[role]}><RankIcon staff={{role,prefix:null}}/>{STAFF_LABEL[role]}</span>;}
/** The Sir (gold) or Squire (steel) before a name. */
export function PrefixWord({prefix,space=false}:{prefix?:NamePrefix|null;space?:boolean}){return prefix?<span className={prefix==='Squire'?'staff-word squire-word':'staff-word'}>{prefix}{space&&' '}</span>:null;}
/** Sir or Squire with the name: a staff member's scimitar card already names it, so only a guide writer off the team
 * (no scimitar) gets a small card on the word itself. */
export function NamePrefixWord({staff,prefix,tabIndex=0,space=false}:{staff?:PublicStaff|null;prefix?:NamePrefix|null;tabIndex?:number;space?:boolean}){
 const word=staff?.displayPrefix??prefix??null;
 if(word==='Squire'&&!staff)return <><BadgeHover className="prefix-hover" info={squireInfo(null)} tabIndex={tabIndex}><PrefixWord prefix={word}/></BadgeHover>{space&&' '}</>;
 return <PrefixWord prefix={word} space={space}/>;
}
/** The rank scimitar (or supporter coin) and Sir or Squire in front of a name. Hover, focus or tap it for what it means;
 * inside a link pass tabIndex -1 so the link stays the only tab stop. Lists that put the prefix with the name pass showWord false.
 * prefix: the Squire of someone not on staff (staff carry theirs in staff.displayPrefix); it gets its own small card. */
export function StaffPrefix({staff,donation,prefix,showHelp=true,tabIndex=0,showWord=true}:{staff?:PublicStaff|null;donation?:Donation;prefix?:NamePrefix|null;showHelp?:boolean;tabIndex?:number;showWord?:boolean}) {
 const info=rankBadgeInfo(staff,donation);
 const wrap=(content:ReactNode)=>showHelp&&info?<BadgeHover className="staff-rank" info={info} tabIndex={tabIndex}>{content}</BadgeHover>:<span className="staff-rank" title={displayedBadgeLabel(staff,donation)||undefined}>{content}</span>;
 const gilded=donation?.badge==='gilded'&&hasGildedSupporter(donation);
 const badge=gilded?<GildedIcon/>:staff?<RankIcon staff={staff}/>:donation?.supporter?<SupporterIcon/>:null;
 if(staff)return wrap(<>{badge}{showWord&&<PrefixWord prefix={staff.displayPrefix}/>}</>);
 const word=showWord&&prefix?(showHelp?<BadgeHover className="staff-rank" info={squireInfo(null)} tabIndex={tabIndex}><PrefixWord prefix={prefix}/></BadgeHover>:<span className="staff-rank"><PrefixWord prefix={prefix}/></span>):null;
 return badge||word?<>{badge&&wrap(badge)}{word}</>:null;
}
/** Every supporter's coin, as thanks; gilded supporters and staff show their scimitar instead. */
export function SupporterIcon(){return <span className="rank-icon rank-supporter" aria-hidden="true"><span className="rank-weapon"><img src="/icons/community/sponsor-coin.png" alt=""/></span></span>;}
export function GildedIcon(){return <span className="rank-icon rank-gilded" aria-hidden="true"><span className="rank-weapon"><img src="/icons/ranks/gilded-scimitar.png" alt=""/></span></span>;}
/** A staff member's name in their rank colour with their scimitar in front; no rank word, the scimitar says it. */
export function StaffName({name,role}:{name:string;role?:StaffRole|null}){return role&&role in STAFF_LABEL?<span className={'staff-name '+STAFF_TONE[role]} title={STAFF_LABEL[role]}><RankIcon staff={{role,prefix:null}}/><b>{name}</b></span>:<span className="staff-name"><b>{name}</b></span>;}
/** A person in the staff portal: scimitar (or supporter coin) and their main RuneScape name in their rank colour (no Sir or
 * donor title there); their Discord name when they have no linked name. */
export function PersonName({person,fallback,role,rankThen}:{person?:{name:string;role:StaffRole|null;display:PersonDisplay|null}|null;fallback?:string;role?:StaffRole|null;
 /** The rank the person held when the row happened (null: not staff then). Wins over their rank today. */
 rankThen?:StaffRole|null}){
 const d=person?.display,rank=rankThen!==undefined?rankThen:person?.role??role??null;
 if(!d)return <StaffName name={person?.name??fallback??'Unknown'} role={rank}/>;
 // The owner's chosen badge only applies while they show as the owner.
 const staff=rank?{role:rank,prefix:null,displayRole:rank===person?.role?d.displayRole:null}:null;
 return <span className="person-name">{d.gilded?<GildedIcon/>:staff?<RankIcon staff={staff}/>:d.supporter?<SupporterIcon/>:null}<b className={rankNameClass(staff)}>{d.rsn}</b></span>;
}
