export type StaffRole = 'helper' | 'moderator' | 'admin' | 'owner';
/** displayPrefix: the Sir or Squire shown before the name (lib/name-prefix.ts); prefix is the staff portal's own Sir setting. */
/** title: the job title an admin gave them for their scimitar's hover card ("Head Admin"); null shows "Site <rank>". */
export type PublicStaff = {role: StaffRole; prefix: 'Sir' | null; title?: string | null; displayRole?:StaffRole|null; displayPrefix?:'Sir'|'Squire'|null};
export const STAFF_TITLE_MAX=32;
/** A staff hover title: trimmed, single spaces, 2–32 letters, numbers, spaces and & ' -. Empty clears it (null). */
export function staffTitle(value:unknown):string|null {
  if(value===null||value===undefined)return null;
  if(typeof value!=='string')throw Error('Enter a title in plain text.');
  const title=value.trim().replace(/\s+/g,' ');
  if(!title)return null;
  if(title.length<2||title.length>STAFF_TITLE_MAX)throw Error(`Keep the title between 2 and ${STAFF_TITLE_MAX} characters.`);
  if(!/^[A-Za-z0-9 &'-]+$/.test(title)||!/[A-Za-z]/.test(title))throw Error("Use letters, numbers, spaces and & ' - only.");
  return title;
}
export const STAFF_LABEL: Record<StaffRole,string> = {helper:'Helper',moderator:'Moderator',admin:'Admin',owner:'Owner'};
/** Rank colour class: helper green, moderator blue, admin red, owner gold (colours in app/globals.css, --rank-*). */
/** The username in the rank's colour wherever a staff member's name shows (the rank they display, if the owner picked another). */
export function rankNameClass(staff?:PublicStaff|null){return staff?'player-username rank-name-'+(staff.displayRole??staff.role):'player-username';}
export const STAFF_TONE: Record<StaffRole,string> = {helper:'rank-text-helper',moderator:'rank-text-moderator',admin:'rank-text-admin',owner:'rank-text-owner'};
export function mayGrant(actor:{id:string;role:StaffRole}, target:{id:string;role:StaffRole|null}, next:StaffRole|null) {
  if(actor.id===target.id || target.role==='owner' || next==='owner') return false;
  if(actor.role==='owner') return true;
  return actor.role==='admin' && target.role!=='admin' && (next===null||next==='helper'||next==='moderator');
}
/** Staff profile controls (visibility, title, badge, unlink, relink): admins and the owner, never on their own account,
 * the owner's, or (for admins) another admin's. The same reach as mayGrant. */
export function mayManageProfile(actor:{id:string;role:StaffRole}, owner:{id:string;role:StaffRole|null}) {
  if(actor.role!=='owner'&&actor.role!=='admin') return false;
  if(actor.id===owner.id || owner.role==='owner') return false;
  return actor.role==='owner' || owner.role!=='admin';
}
export function evidenceUrl(value:unknown, wikiOnly=false):string {
  if(typeof value!=='string'||value.length>1500) throw Error('Add a source URL.');
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password) throw Error('Use a public HTTPS source link.');
  if(wikiOnly && (url.hostname!=='oldschool.runescape.wiki'||!url.pathname.startsWith('/w/'))) throw Error('Rate corrections need the relevant OSRS Wiki page.');
  return url.href;
}
const RANK_ORDER:Record<StaffRole,number>={helper:0,moderator:1,admin:2,owner:3};
/** A reviewer decides proposals from their own rank or below: a moderator never signs off an admin's change. */
export function mayReviewProposal(reviewer:StaffRole,proposer:StaffRole|null|undefined){return !proposer||RANK_ORDER[reviewer]>=RANK_ORDER[proposer];}
/** SQL for a rank's order (helper 0 … owner 3), so writes can recheck mayReviewProposal against the ranks at that moment. */
export function rankOrderSql(role:string){return `CASE ${role} WHEN 'helper' THEN 0 WHEN 'moderator' THEN 1 WHEN 'admin' THEN 2 WHEN 'owner' THEN 3 END`;}
/** SQL that is true while the proposer (a staff_members discord_id expression) ranks no higher than `reviewerRole` (a bound value or column).
 * Someone no longer on staff counts as no rank, like mayReviewProposal. */
export function proposerRankGuard(proposerId:string,reviewerRole:string){return `COALESCE((SELECT ${rankOrderSql('p.role')} FROM staff_members p WHERE p.discord_id=${proposerId}),-1)<=${rankOrderSql(reviewerRole)}`;}
