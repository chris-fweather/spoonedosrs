/**
 * The people on the Credits page: guide writers, the current staff and retired staff with every rank they held.
 * Names are the ones the site already shows publicly (a person's earliest linked RuneScape name with a public profile,
 * as guide bylines use); nobody without one is listed, and Discord IDs and names never leave this module.
 * Anyone can hide themselves with users.credits_listed = 0 (Account settings).
 * Kept free of Worker imports so the queries and the cache can be tested with node:sqlite.
 */
import type {StaffRole} from './staff-policy';
import {GUIDE_CATEGORIES,guideCategory,guideTopicImage} from './guide-topics';

export type CreditRank={role:StaffRole;since:string|null};
export type CreditWriter={name:string;role:StaffRole|null;guides:{id:string;title:string;icon:string}[]};
export type CreditStaff={name:string;role:StaffRole;since:string|null};
export type CreditRetired={name:string;ranks:CreditRank[];until:string|null};
export type CreditsPeople={writers:CreditWriter[];staff:CreditStaff[];retired:CreditRetired[]};

type CreditsDatabase={prepare(query:string):{all<T>():Promise<{results:T[]}>}};
const RANKS:StaffRole[]=['helper','moderator','admin','owner'];
const ORDER:Record<StaffRole,number>={owner:0,admin:1,moderator:2,helper:3};
const rank=(value:unknown):StaffRole|null=>RANKS.includes(value as StaffRole)?value as StaffRole:null;

/** How long the public list may be stale; the endpoint and the shared cache use the same age. */
export const CREDITS_MAX_AGE=600;

/** Everyone who could be credited: authors of a published guide, current staff, and anyone whose rank was ever changed. */
export const CREDIT_PEOPLE_SQL=`SELECT u.discord_id AS id,COALESCE(u.credits_listed,1) AS listed,s.role,
 (SELECT c.display_name FROM claimed_names c LEFT JOIN profile_visibility v ON v.rsn=c.rsn WHERE c.discord_id=u.discord_id AND COALESCE(v.visibility,'public')='public' ORDER BY c.claimed_at,c.rsn LIMIT 1) AS name,
 (SELECT p.staff_badge FROM claimed_names c JOIN profile_presentation p ON p.rsn=c.rsn LEFT JOIN profile_visibility v ON v.rsn=c.rsn WHERE c.discord_id=u.discord_id AND COALESCE(v.visibility,'public')='public' ORDER BY c.claimed_at,c.rsn LIMIT 1) AS badge
 FROM users u LEFT JOIN staff_members s ON s.discord_id=u.discord_id
 WHERE u.discord_id IN (SELECT author_id FROM community_guides WHERE published IS NOT NULL UNION SELECT discord_id FROM staff_members UNION SELECT target_id FROM staff_audit WHERE action IN ('grant','revoke'))`;
export const CREDIT_GUIDES_SQL=`SELECT author_id,id,COALESCE(json_extract(published,'$.title'),title) AS title,json_extract(published,'$.activity') AS activity FROM community_guides WHERE published IS NOT NULL ORDER BY published_at,id`;
export const CREDIT_RANKS_SQL=`SELECT id,target_id,action,detail,created_at FROM staff_audit WHERE action IN ('grant','revoke') ORDER BY id`;

type PersonRow={id:string;listed:number;role:string|null;name:string|null;badge:string|null};
type GuideRow={author_id:string;id:string;title:string;activity:string|null};
type RankRow={id:number;target_id:string;action:string;detail:string;created_at:string};

const grantedRole=(e:RankRow)=>{try{return rank((JSON.parse(e.detail) as {to?:unknown})?.to);}catch{return null;}};

/** Every rank a person held, in order, with when they first got it, from their rank changes (staff_audit). */
export function rankSteps(events:RankRow[]):{ranks:CreditRank[];until:string|null}{
 const ranks:CreditRank[]=[];let until:string|null=null;
 const add=(role:StaffRole|null,since:string|null)=>{if(role&&ranks.at(-1)?.role!==role)ranks.push({role,since});};
 for(const e of events){
  let d:{from?:unknown;to?:unknown}={};try{d=JSON.parse(e.detail)??{};}catch{continue;}
  // A rank held before the first recorded change has no known start.
  if(!ranks.length)add(rank(d.from),null);
  if(e.action==='revoke')until=e.created_at;else{add(rank(d.to),e.created_at);until=null;}
 }
 return {ranks,until};
}

export async function loadCreditsPeople(database:CreditsDatabase):Promise<CreditsPeople>{
 const [people,guides,events]=await Promise.all([
  database.prepare(CREDIT_PEOPLE_SQL).all<PersonRow>(),
  database.prepare(CREDIT_GUIDES_SQL).all<GuideRow>(),
  database.prepare(CREDIT_RANKS_SQL).all<RankRow>(),
 ]);
 const shown=new Map(people.results.filter(p=>p.listed!==0&&p.name).map(p=>[p.id,p]));
 const byPerson=new Map<string,RankRow[]>();
 for(const e of events.results){const list=byPerson.get(e.target_id)??[];list.push(e);byPerson.set(e.target_id,list);}
 // The owner may show a different rank's scimitar on their profile; the Credits page shows the same one.
 const displayed=(p:PersonRow):StaffRole|null=>{const role=rank(p.role);return role==='owner'&&rank(p.badge)?rank(p.badge):role;};
 const byName=(a:{name:string},b:{name:string})=>a.name.localeCompare(b.name,'en',{sensitivity:'base'});

 // Each guide shows its topic's art, as on the guide cards, or its group's icon.
 const guideIcon=(activity:string|null)=>{const a=activity??'';return guideTopicImage(a)??GUIDE_CATEGORIES.find(c=>c.id===guideCategory(a))?.icon??'/icons/navigation/collection-log-icon.png';};
 const written=new Map<string,{id:string;title:string;icon:string}[]>();
 for(const g of guides.results)if(shown.has(g.author_id)){const list=written.get(g.author_id)??[];list.push({id:g.id,title:g.title,icon:guideIcon(g.activity)});written.set(g.author_id,list);}
 const writers=[...written].map(([id,list])=>{const p=shown.get(id)!;return {name:p.name!,role:displayed(p),guides:list};})
  .sort((a,b)=>b.guides.length-a.guides.length||byName(a,b));

 const staff:CreditStaff[]=[],retired:CreditRetired[]=[];
 for(const p of shown.values()){
  const role=displayed(p);
  // Since their latest grant of the rank they hold now (a rank never granted through the portal has no date).
  if(role)staff.push({name:p.name!,role,since:(byPerson.get(p.id)??[]).filter(e=>e.action==='grant'&&grantedRole(e)===p.role).at(-1)?.created_at??null});
  else{const steps=rankSteps(byPerson.get(p.id)??[]);if(steps.ranks.length)retired.push({name:p.name!,ranks:steps.ranks,until:steps.until});}
 }
 staff.sort((a,b)=>ORDER[a.role]-ORDER[b.role]||(a.since??'').localeCompare(b.since??'')||byName(a,b));
 retired.sort((a,b)=>(b.until??'').localeCompare(a.until??'')||byName(a,b));
 return {writers,staff,retired};
}

type CreditsCache={match(key:string):Promise<Response|undefined>;put(key:string,response:Response):Promise<void>};
/** The list from the shared cache when fresh, otherwise loaded and stored for CREDITS_MAX_AGE. A cache failure never
 * blocks the list. */
export async function cachedCreditsPeople(load:()=>Promise<CreditsPeople>,cache:CreditsCache|null,key:string):Promise<CreditsPeople>{
 if(cache)try{const hit=await cache.match(key);if(hit)return await hit.json() as CreditsPeople;}catch{/* load instead */}
 const people=await load();
 if(cache)try{await cache.put(key,Response.json(people,{headers:{'Cache-Control':`public, max-age=${CREDITS_MAX_AGE}`}}));}catch{/* next request loads again */}
 return people;
}
