import {ACCOUNT_MODES,type AccountMode} from './account-mode';
import {badgeTier,DONATOR_TITLE,type Mark} from './flair';
import {achievementDescription,titleRarity,type Donation} from './presentation';
import {displayedBadgeLabel,GILDED_SUPPORTER_MINIMUM_USD,hasGildedSupporter} from './staff-appearance';
import {STAFF_LABEL,type PublicStaff,type StaffRole} from './staff-policy';
import {squireReason} from './name-prefix';

/** What a badge's hover card says: its name, what it means or how it is earned (empty for staff ranks), then short label/value lines. */
export type BadgeInfo={name:string;description:string;details:[string,string][]};

const cap=(text:string)=>text.charAt(0).toUpperCase()+text.slice(1);
const money=(minor:number,currency='USD')=>new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits:minor%100?2:0}).format(minor/100);
const shownAmount=(d?:Donation)=>d&&!d.hidden&&d.amountMinor!=null&&d.amountMinor>0?money(d.amountMinor,d.currency):null;

/** A pinned achievement emblem: what earned it, its tier and the title it unlocks. */
export function emblemInfo(mark:Mark,title?:string|null):BadgeInfo{
 const details:[string,string][]=[['Tier',cap(badgeTier(mark.id))]];
 if(title)details.push(['Title',title]);
 return {name:mark.name,description:/[.!]$/.test(mark.detail)?mark.detail:mark.detail+'.',details};
}

/** The scimitar or coin in front of a name: the badge shown (a cosmetic choice never names another role), plus Sir.
 * Staff cards are the job title (an admin's custom "Head Admin", else "Site Admin"), then Rank and Name prefix, with no sentence. */
export function rankBadgeInfo(staff?:PublicStaff|null,donation?:Donation):BadgeInfo|null{
 const name=displayedBadgeLabel(staff,donation);if(!name)return null;
 const details:[string,string][]=[],amount=shownAmount(donation);
 if(donation?.badge==='gilded'&&hasGildedSupporter(donation))return {name,description:`Donated ${money(GILDED_SUPPORTER_MINIMUM_USD)} or more to Spooned OSRS.`,details:staff?.displayPrefix?[['Name prefix',staff.displayPrefix]]:[]};
 if(!staff)return {name,description:'Donated to support Spooned OSRS.',details:amount?[['Donated',amount]]:[]};
 const role=staff.displayRole??staff.role;
 // The title belongs to the real rank; while the owner shows another rank's scimitar, the card names that rank instead.
 const title=role===staff.role&&staff.title?staff.title:name;
 details.push(['Rank',STAFF_LABEL[role]]);
 if(staff.displayPrefix)details.push(['Name prefix',staff.displayPrefix]);
 return {name:title,description:'',details};
}

/** The Squire word's own card, where no scimitar card carries it: a guide writer who is not on staff. */
export function squireInfo(role?:StaffRole|null):BadgeInfo{return {name:'Squire',description:squireReason(role),details:[]};}

const ACCOUNT_MODE_DESCRIPTION:Record<Exclude<AccountMode,'normal'>,string>={
 ironman:'Plays self-sufficiently: no trading, Grand Exchange or help from other players.',
 hardcore_ironman:'An Ironman with one life. A dangerous death turns them into a regular Ironman.',
 ultimate_ironman:'An Ironman who also cannot use a bank.',
 group_ironman:'Ironman rules shared by a group of up to five players, who trade only with each other.',
 hardcore_group_ironman:'A Group Ironman team with a shared pool of lives.',
 unranked_group_ironman:'Group Ironman rules without the group hiscores.',
};
export function accountModeInfo(mode:AccountMode):BadgeInfo|null{
 if(mode==='normal'||!ACCOUNT_MODE_DESCRIPTION[mode])return null;
 return {name:ACCOUNT_MODES[mode],description:ACCOUNT_MODE_DESCRIPTION[mode],details:[['Source','OSRS Hiscores']]};
}

/** The supporter title after a name. */
export function supporterTitleInfo(title:string,donation?:Donation):BadgeInfo{
 const amount=shownAmount(donation);
 return {name:title,description:title===DONATOR_TITLE?'Donated $10 or more to Spooned OSRS.':'Supports Spooned OSRS.',details:amount?[['Donated',amount]]:[]};
}

/** An achievement title under a name, with its rarity. */
export function achievementTitleInfo(label:string):BadgeInfo{
 const description=achievementDescription(label);
 return {name:label,description:/[.!]$/.test(description)?description:description+'.',details:[['Rarity',cap(titleRarity(label))]]};
}

export const VERIFIED_INFO:BadgeInfo={name:'Verified',description:'This name is linked to the same Discord account that proved it through the RuneLite plugin.',details:[]};

/** One line for screen readers and plain-title fallbacks. */
export function badgeLabel(info:BadgeInfo){return [info.name,...(info.description?[info.description]:[]),...info.details.map(([k,v])=>`${k}: ${v}`)].join(' · ');}
