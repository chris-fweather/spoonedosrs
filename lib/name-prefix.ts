import {SQUIRE_PREFIX} from './features';
import type {StaffRole} from './staff-policy';

/** The word someone may show before their name: Sir, or Squire (the rank below it). */
export type NamePrefix='Sir'|'Squire';
export const NAME_PREFIXES:readonly NamePrefix[]=['Sir','Squire'];
/** A stored prefix choice, or null for anything else. */
export function cleanNamePrefix(value:unknown):NamePrefix|null{return NAME_PREFIXES.includes(value as NamePrefix)?value as NamePrefix:null;}

/** The prefix a person has earned. Moderators, admins and the owner earn Sir; helpers and anyone with a published guide
 * earn Squire, and Sir always wins over Squire. While Squire is off (the live site for now), every staff rank earns Sir, as
 * before, and guide writers earn nothing. */
export function earnedPrefix(role:StaffRole|null|undefined,guideWriter:boolean,squire=SQUIRE_PREFIX):NamePrefix|null{
 if(!squire)return role?'Sir':null;
 if(role&&role!=='helper')return 'Sir';
 return role==='helper'||guideWriter?'Squire':null;
}

/** The prefix shown before a name. The stored choice only says "show my prefix" (people opt in, as with Sir), so it always
 * shows the one they earn today: a helper promoted to moderator goes from Squire to Sir without choosing again. */
export function shownPrefix(stored:unknown,role:StaffRole|null|undefined,guideWriter:boolean,squire=SQUIRE_PREFIX):NamePrefix|null{
 return cleanNamePrefix(stored)?earnedPrefix(role,guideWriter,squire):null;
}

/** Why someone is a Squire, for the small card on the word itself (non-staff guide writers have no scimitar to hover). */
export function squireReason(role:StaffRole|null|undefined):string{
 return role==='helper'?'Helper on the Spooned OSRS team.':'Wrote a published Spooned OSRS guide.';
}
