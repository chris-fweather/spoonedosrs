import type {StaffRole} from './staff-policy';
import {DEFAULT_APPEARANCE,parseAppearance,type Appearance} from './appearance';
import {selectedTitle,type Donation} from './presentation';
import {coerceFlair,displayTitle} from './flair';
import {headPortrait,type HeadPortrait} from './head-portrait';
import type {Journal} from './model';
import type {NamePrefix} from './name-prefix';
/** prefix: the Sir or Squire this name shows before it (each linked name keeps its own choice). */
/** head: the portrait wearing the account's head-slot item (null when bare: the plain portrait shows). */
export type LinkedMenuAccount={prefix?:NamePrefix|null;name:string;portrait:string;head:HeadPortrait|null;title:string|null;achievementTitle:string|null;donation:Donation};
export function characterPortrait(appearance:Appearance){const a=parseAppearance(appearance);return `/portraits/${a.body}-${a.hair}-${a.skin??'default'}.svg?v=jaw3`;}
/** equipped and displayPiece: the account's saved look (claimed_names), checked against its journal as on the profile. */
export function menuAccount(input:{prefix?:NamePrefix|null;supporter?:boolean;name:string;appearance?:Appearance;equipped?:unknown;displayPiece?:unknown;title:string|null;choice:string;mark:string|null;owner:boolean;role?:StaffRole|null;donation:Donation;journal:Journal}):LinkedMenuAccount{
 const appearance=input.appearance??DEFAULT_APPEARANCE,portrait=characterPortrait(appearance);
 const worn=input.equipped!==undefined||input.displayPiece!==undefined?coerceFlair(input.journal,{equipped:input.equipped,displayPiece:input.displayPiece},{staffRole:input.role}).equipped.head:null;
 return {prefix:input.prefix??null,name:input.name,portrait,head:headPortrait(appearance,worn,portrait),title:displayTitle(input.name,input.title),achievementTitle:selectedTitle(input.journal,input.choice,input.mark,input.owner,input.supporter??displayTitle(input.name,input.title)==='the Generous',input.role),donation:input.donation};}
