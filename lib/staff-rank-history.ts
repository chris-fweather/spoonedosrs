import type {StaffRole} from './staff-policy';

/** A rank change as staff_audit records it: 'grant' stores {from,to}, 'revoke' stores {from,to:null}. */
export type RankEvent={id:number;target_id:string;action:string;detail:string;created_at:string};
type Step={id:number;at:string;from:StaffRole|null;to:StaffRole|null};
const RANKS:StaffRole[]=['helper','moderator','admin','owner'];
const rank=(value:unknown):StaffRole|null=>RANKS.includes(value as StaffRole)?value as StaffRole:null;

/**
 * Ranks are only stored as they are now (staff_members), so a person's rank at an earlier moment is worked out by
 * replaying their rank changes in staff_audit, oldest first:
 * - the rank right after their last change before that moment (its `to`), or
 * - with no change before it, the rank before their first later change (its `from`), or
 * - with no recorded change at all, their current rank (the owner and anyone added straight to the database).
 * A moment is either an audit row (`beforeId`: the rank just before that change took effect) or a time (`at`, ISO).
 */
export function rankHistory(events:RankEvent[],current:Map<string,StaffRole|null>){
 const steps=new Map<string,Step[]>();
 for(const e of [...events].sort((a,b)=>a.id-b.id)){
  if(e.action!=='grant'&&e.action!=='revoke')continue;
  let d:{from?:unknown;to?:unknown}={};try{d=JSON.parse(e.detail)??{};}catch{continue;}
  const list=steps.get(e.target_id)??[];list.push({id:e.id,at:e.created_at,from:rank(d.from),to:e.action==='revoke'?null:rank(d.to)});steps.set(e.target_id,list);
 }
 return function roleAt(id:string|null|undefined,moment:{beforeId:number}|{at:string}):StaffRole|null{
  if(!id)return null;
  const list=steps.get(id)??[];
  const before=(s:Step)=>'beforeId' in moment?s.id<moment.beforeId:s.at<=moment.at;
  const last=list.filter(before).at(-1);
  if(last)return last.to;
  const next=list.find(s=>!before(s));
  return next?next.from:current.get(id)??null;
 };
}
