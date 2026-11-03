import {HttpError,readSession} from './auth';
import {accountName,db,sameOrigin} from './storage';
import {takeBudget} from './request-controls';
import {anonymousLabel,canReassign,claimCodeHash,claimCodeMatches,newClaimCode,validAmount,validSupportName,validCurrency} from './donation-rules';

/** The donation ledger (table donations) and the per-profile totals derived from it. See docs/supporters.md. */

/** Statements that rebuild one profile's supporter total from its completed donations. Run them in the same batch
 * as the ledger change, so the total and the ledger never disagree. */
export function recomputeTotal(rsn:string){
 const database=db(),key=rsn.toLowerCase();
 return [
  database.prepare('DELETE FROM profile_supporter_totals WHERE rsn=?').bind(key),
  database.prepare(`INSERT OR IGNORE INTO profile_supporter_totals(rsn,amount_minor,currency,granted)
   SELECT target_rsn,SUM(amount_minor),currency,MAX(kind='grant') FROM donations WHERE target_rsn=? AND status='completed'
   GROUP BY currency ORDER BY SUM(amount_minor) DESC`).bind(key),
 ];
}

/** The profile a donation supports; null means nobody. Staff entries need a name the site already has (a linked name or
 * a saved journal), so a typo cannot create support for a stranger. A donor's own choice at checkout (and the provider
 * webhook that turns it into a donation) may name any valid RuneScape name: support is stored on the name and shows
 * once that name's profile is on the site. `tracked` says whether it is already. */
async function targetProfile(value:unknown,allowUntracked=false):Promise<{rsn:string;name:string;tracked:boolean}|null>{
 if(value===null||value===undefined||(typeof value==='string'&&!value.trim()))return null;
 const name=validSupportName(value);
 if(!name)throw new HttpError(400,'Enter a RuneScape name of up to 12 letters, numbers, spaces, hyphens or underscores, or leave it blank.');
 const row=await db().prepare(`SELECT n.rsn,COALESCE(c.display_name,j.name,n.rsn) AS name FROM (SELECT rsn FROM claimed_names WHERE rsn=? UNION SELECT id FROM journals WHERE id=?) n
  LEFT JOIN claimed_names c ON c.rsn=n.rsn LEFT JOIN journal_summaries j ON j.rsn=n.rsn`).bind(name.toLowerCase(),name.toLowerCase()).first<{rsn:string;name:string}>();
 if(row)return {...row,tracked:true};
 if(!allowUntracked)throw new HttpError(404,`${name} has no profile on the site yet.`);
 return {rsn:name.toLowerCase(),name,tracked:false};
}

/** A profile's total is in one currency; a donation in another would not add up on the supporters board. */
async function sameCurrency(rsn:string|null,currency:string){
 if(!rsn)return;
 const row=await db().prepare("SELECT currency FROM donations WHERE target_rsn=? AND status='completed' AND kind='payment' AND currency<>? LIMIT 1").bind(rsn,currency).first<{currency:string}>();
 if(row)throw new HttpError(409,`That profile's supporter total is in ${row.currency}. Record this donation in ${row.currency}.`);
}

export type NewDonation={amountMinor:unknown;currency:unknown;target:unknown;donorId:string|null;anonymous:boolean;source:'staff'|'provider';providerRef?:string|null;createdBy?:string|null};
export type Recorded={id:string;anonymousNumber:number|null;label:string|null;claimCode:string|null;target:string|null};

/**
 * Records one completed donation and updates the chosen profile's total. An anonymous donation (no donor) gets the
 * next public number and a one-time claim code, returned here and never again.
 */
export async function recordDonation(input:NewDonation):Promise<Recorded>{
 const amount=validAmount(input.amountMinor),currency=validCurrency(input.currency);
 if(!amount)throw new HttpError(400,'Enter an amount between 0.01 and 100,000.');
 if(!currency)throw new HttpError(400,'Choose a currency.');
 if(input.anonymous===!!input.donorId)throw new HttpError(400,'A donation has a donor or is anonymous, not both.');
 const profile=await targetProfile(input.target,input.source==='provider'),target=profile?.rsn??null;
 await sameCurrency(target,currency);
 const id=crypto.randomUUID(),now=Date.now();
 const claimCode=input.anonymous?newClaimCode():null,claimHash=claimCode?await claimCodeHash(claimCode):null;
 const database=db();
 // The number is taken inside the insert, so two donations at once never share one.
 const insert=database.prepare(`INSERT INTO donations(id,amount_minor,currency,target_rsn,donor_id,anonymous_number,claim_hash,kind,source,provider_ref,created_by,created_at,updated_at)
  SELECT ?,?,?,?,?,CASE WHEN ? THEN (SELECT COALESCE(MAX(anonymous_number),0)+1 FROM donations) END,?,'payment',?,?,?,?,?`)
  .bind(id,amount,currency,target,input.donorId,input.anonymous?1:0,claimHash,input.source,input.providerRef??null,input.createdBy??null,now,now);
 try{await database.batch([insert,...(target?recomputeTotal(target):[])]);}
 catch(e){if(/UNIQUE/.test(String(e))&&input.providerRef)throw new HttpError(409,'That payment was already recorded.');throw e;}
 const row=await database.prepare('SELECT anonymous_number FROM donations WHERE id=?').bind(id).first<{anonymous_number:number|null}>();
 const number=row?.anonymous_number??null;
 return {id,anonymousNumber:number,label:number?anonymousLabel(number):null,claimCode,target:profile?.name??null};
}

/** A refund or chargeback: the donation stays in the ledger for the record but no longer counts toward any total. */
export async function reverseDonation(id:unknown,status:'refunded'|'reversed'){
 if(typeof id!=='string'||id.length>64)throw new HttpError(400,'Choose a donation.');
 const row=await db().prepare("SELECT target_rsn FROM donations WHERE id=? AND status='completed'").bind(id).first<{target_rsn:string|null}>();
 if(!row)throw new HttpError(404,'That donation was already refunded or does not exist.');
 await db().batch([db().prepare("UPDATE donations SET status=?,updated_at=? WHERE id=? AND status='completed'").bind(status,Date.now(),id),...(row.target_rsn?recomputeTotal(row.target_rsn):[])]);
}

type Row={id:string;amount_minor:number;currency:string;target_rsn:string|null;target_name:string|null;donor_id:string|null;anonymous_number:number|null;kind:'payment'|'grant';status:string;created_at:number};
export type DonationView={id:string;amountMinor:number;currency:string;target:string|null;label:string|null;kind:'payment'|'grant';status:string;createdAt:number;movable:boolean};

async function signedIn(request:Request,write:boolean){
 if(write){try{sameOrigin(request);}catch{throw new HttpError(403,'Use account settings to make changes.');}}
 const user=await readSession(request);
 if(!user)throw new HttpError(401,'Sign in to manage your donations.');
 return user.id;
}
async function ownNames(userId:string){
 return (await db().prepare('SELECT rsn FROM claimed_names WHERE discord_id=?').bind(userId).all<{rsn:string}>()).results.map(r=>r.rsn);
}

/** The signed-in person's donations: ones they made while signed in, and anonymous ones they claimed. */
export async function myDonations(request:Request):Promise<DonationView[]>{
 const userId=await signedIn(request,false);
 const [rows,names]=await Promise.all([db().prepare(`SELECT d.id,d.amount_minor,d.currency,d.target_rsn,COALESCE(c.display_name,j.name,d.target_rsn) AS target_name,d.donor_id,d.anonymous_number,d.kind,d.status,d.created_at
  FROM donations d LEFT JOIN claimed_names c ON c.rsn=d.target_rsn LEFT JOIN journal_summaries j ON j.rsn=d.target_rsn
  WHERE d.donor_id=? ORDER BY d.created_at DESC LIMIT 100`).bind(userId).all<Row>(),ownNames(userId)]);
 return rows.results.map(r=>({id:r.id,amountMinor:r.amount_minor,currency:r.currency,target:r.target_name,label:r.anonymous_number?anonymousLabel(r.anonymous_number):null,kind:r.kind,status:r.status,createdAt:r.created_at,
  movable:canReassign({donorId:r.donor_id,targetRsn:r.target_rsn,status:r.status},userId,names,null)}));
}

/** Moves one of the signed-in person's donations to another of their own linked names, or to nobody. */
export async function moveDonation(request:Request,id:unknown,to:unknown){
 const userId=await signedIn(request,true);
 if(typeof id!=='string'||id.length>64)throw new HttpError(400,'Choose a donation.');
 let target:string|null=null;
 if(to!==null&&to!==''){try{target=accountName(to).toLowerCase();}catch{throw new HttpError(400,'Choose one of your linked names.');}}
 const [row,names]=await Promise.all([db().prepare('SELECT donor_id,target_rsn,status,currency,kind FROM donations WHERE id=?').bind(id).first<{donor_id:string|null;target_rsn:string|null;status:string;currency:string;kind:string}>(),ownNames(userId)]);
 if(!row||!canReassign({donorId:row.donor_id,targetRsn:row.target_rsn,status:row.status},userId,names,target))throw new HttpError(403,'You can move only your own donations, between your own linked names.');
 if(row.kind==='payment')await sameCurrency(target,row.currency);
 const affected=[...new Set([row.target_rsn,target].filter((r):r is string=>!!r))];
 // The guard repeats the ownership check, so a name unlinked meanwhile cannot receive it.
 const update=db().prepare(`UPDATE donations SET target_rsn=?,updated_at=? WHERE id=? AND donor_id=? AND status='completed'
  AND (? IS NULL OR EXISTS(SELECT 1 FROM claimed_names WHERE rsn=? AND discord_id=?))`).bind(target,Date.now(),id,userId,target,target,userId);
 await db().batch([update,...affected.flatMap(recomputeTotal)]);
}

const CLAIM_FAILED='That claim code does not match an unclaimed donation.';
/** Attaches an anonymous donation to the signed-in account by its one-time claim code alone: the code is tied to one
 * donation, found by the code's hash (unique, migration 0035). The public number is only a label and is not needed.
 * A donation that supports no profile yet goes to `to`, one of the claimer's own linked names; one already given to a
 * profile stays on it. */
export async function claimDonation(request:Request,code:unknown,to?:unknown){
 const userId=await signedIn(request,true);
 let target:string|null=null;
 if(to!==undefined&&to!==null&&to!==''){
  try{target=accountName(to).toLowerCase();}catch{throw new HttpError(400,'Choose one of your linked names.');}
  if(!(await ownNames(userId)).includes(target))throw new HttpError(403,'Choose one of your linked names.');
 }
 // Ten tries an hour per account: with 80-bit codes, guessing is hopeless either way.
 await takeBudget('donation-claim:'+userId,10,3600);
 const hash=await claimCodeHash(code);
 const row=hash?await db().prepare('SELECT id,anonymous_number,claim_hash,target_rsn,currency,kind FROM donations WHERE claim_hash=? AND donor_id IS NULL').bind(hash).first<{id:string;anonymous_number:number|null;claim_hash:string|null;target_rsn:string|null;currency:string;kind:string}>():null;
 // One answer for a malformed, wrong or already-used code, so none can be told apart.
 if(!await claimCodeMatches(code,row?.claim_hash??null)||!row)throw new HttpError(403,CLAIM_FAILED);
 const result=await db().prepare('UPDATE donations SET donor_id=?,claim_hash=NULL,updated_at=? WHERE id=? AND donor_id IS NULL AND claim_hash=?').bind(userId,Date.now(),row.id,row.claim_hash).run();
 if(!result.meta.changes)throw new HttpError(403,CLAIM_FAILED);
 let supports=row.target_rsn;
 if(!row.target_rsn&&target){
  if(row.kind==='payment')await sameCurrency(target,row.currency).catch(()=>{target=null;});
  if(target){
   const set=db().prepare(`UPDATE donations SET target_rsn=?,updated_at=? WHERE id=? AND donor_id=? AND target_rsn IS NULL AND status='completed'
    AND EXISTS(SELECT 1 FROM claimed_names WHERE rsn=? AND discord_id=?)`).bind(target,Date.now(),row.id,userId,target,userId);
   await db().batch([set,...recomputeTotal(target)]);
   supports=target;
  }
 }
 const name=supports?(await db().prepare('SELECT COALESCE(c.display_name,j.name,?) AS name FROM (SELECT ? AS rsn) x LEFT JOIN claimed_names c ON c.rsn=x.rsn LEFT JOIN journal_summaries j ON j.rsn=x.rsn').bind(supports,supports).first<{name:string}>())?.name??supports:null;
 return {label:row.anonymous_number?anonymousLabel(row.anonymous_number):'Your donation',supports:name};
}

export type StaffDonation={id:string;amountMinor:number;currency:string;target:string|null;donor:string|null;label:string|null;kind:string;status:string;source:string;createdAt:number};
/** The latest ledger entries, for the owner's donations panel. Claim codes and hashes never leave the server. */
export async function recentDonations():Promise<StaffDonation[]>{
 const rows=await db().prepare(`SELECT d.id,d.amount_minor,d.currency,COALESCE(c.display_name,d.target_rsn) AS target,COALESCE(u.global_name,u.username) AS donor,d.anonymous_number,d.kind,d.status,d.source,d.created_at
  FROM donations d LEFT JOIN claimed_names c ON c.rsn=d.target_rsn LEFT JOIN users u ON u.discord_id=d.donor_id ORDER BY d.created_at DESC LIMIT 50`)
  .all<{id:string;amount_minor:number;currency:string;target:string|null;donor:string|null;anonymous_number:number|null;kind:string;status:string;source:string;created_at:number}>();
 return rows.results.map(r=>({id:r.id,amountMinor:r.amount_minor,currency:r.currency,target:r.target,donor:r.donor,label:r.anonymous_number?anonymousLabel(r.anonymous_number):null,kind:r.kind,status:r.status,source:r.source,createdAt:r.created_at}));
}

/** The Discord account behind a linked name, for a donation staff enter on a signed-in donor's behalf. */
export async function donorFromName(value:unknown):Promise<string>{
 let name:string;
 try{name=accountName(value);}catch{throw new HttpError(400,"Enter the donor's linked RuneScape name, or mark the donation anonymous.");}
 const row=await db().prepare('SELECT discord_id FROM claimed_names WHERE rsn=?').bind(name.toLowerCase()).first<{discord_id:string}>();
 if(!row)throw new HttpError(404,`${name} is not linked to a Discord account.`);
 return row.discord_id;
}

/** What a donor chose before paying, checked the same way a recorded donation is. Signed-in donors are always
 * attributed to their account; logged-out donors are anonymous. */
export async function checkoutChoice(request:Request,body:Record<string,unknown>){
 try{sameOrigin(request);}catch{throw new HttpError(403,'Donate from the Support page.');}
 const user=await readSession(request);
 const profile=await targetProfile(body.target,true);
 const amount=validAmount(body.amountMinor);
 if(!amount)throw new HttpError(400,'Enter an amount between 0.01 and 100,000.');
 return {donorId:user?.id??null,anonymous:!user,target:profile?.rsn??null,name:profile?.name??null,tracked:profile?.tracked??false,amount};
}
