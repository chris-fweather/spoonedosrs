/** Donation rules that need no database: anonymous numbers, claim codes, amounts and who may move a donation.
 * See docs/supporters.md. */

/** Crockford base32, as plugin tokens use: no I, L, O or U, so a code survives being read aloud or retyped. */
const ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const GROUPS=4,GROUP=4;

/** "Anonymous #0042": the public reference of an anonymous donation. Anyone can read it, so it proves nothing. */
export function anonymousLabel(n:number):string{return 'Anonymous #'+String(n).padStart(4,'0');}

/** A one-time claim code, CLM-XXXX-XXXX-XXXX-XXXX: 80 random bits. Shown once; only its hash is stored. */
export function newClaimCode():string{
 // 256 is a multiple of 32, so each byte modulo 32 keeps every character equally likely.
 const chars=Array.from(crypto.getRandomValues(new Uint8Array(GROUPS*GROUP)),b=>ALPHABET[b%32]);
 return ['CLM',...Array.from({length:GROUPS},(_,i)=>chars.slice(i*GROUP,(i+1)*GROUP).join(''))].join('-');
}

/** The code's characters without prefix, dashes or spaces, upper case; null when it cannot be a claim code. */
export function normalizeClaimCode(value:unknown):string|null{
 if(typeof value!=='string'||value.length>60)return null;
 const body=value.toUpperCase().replace(/[\s-]/g,'').replace(/^CLM/,'');
 return body.length===GROUPS*GROUP&&[...body].every(c=>ALPHABET.includes(c))?body:null;
}

/** SHA-256 (hex) of the normalised code; null when the value cannot be a code. */
export async function claimCodeHash(code:unknown):Promise<string|null>{
 const body=normalizeClaimCode(code);
 if(!body)return null;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('spooned-claim:'+body));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}

/** Compares two strings in time that depends only on their length, not on where they first differ. */
export function constantTimeEqual(a:string,b:string):boolean{
 const length=Math.max(a.length,b.length);
 let diff=a.length^b.length;
 for(let i=0;i<length;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
 return diff===0;
}

/** True when the code matches the stored hash. A missing hash (already claimed) never matches. */
export async function claimCodeMatches(code:unknown,storedHash:string|null):Promise<boolean>{
 const hash=await claimCodeHash(code);
 // Hash a dummy when the code is malformed, so a bad code and a wrong code take the same work.
 const candidate=hash??await claimCodeHash('CLM-0000-0000-0000-0000');
 const ok=!!storedHash&&constantTimeEqual(candidate!,storedHash);
 return ok&&hash!==null;
}

/** A RuneScape name a donation can support: 1–12 letters, numbers, spaces, hyphens or underscores, trimmed, with
 * at least one letter or number. The same rule on the Support page and the server; null for anything else. */
export function validSupportName(value:unknown):string|null{
 if(typeof value!=='string')return null;
 const name=value.trim();
 return /^[A-Za-z0-9 _-]{1,12}$/.test(name)&&/[A-Za-z0-9]/.test(name)?name:null;
}

/** Up to $100,000 per entry, in whole minor units. */
export const MAX_DONATION_MINOR=10_000_000;
export function validAmount(value:unknown):number|null{
 return Number.isSafeInteger(value)&&Number(value)>0&&Number(value)<=MAX_DONATION_MINOR?Number(value):null;
}
export function validCurrency(value:unknown):string|null{
 return typeof value==='string'&&/^[A-Z]{3}$/.test(value)?value:null;
}

export type LedgerRow={amountMinor:number;currency:string;kind:'payment'|'grant';status:'completed'|'refunded'|'reversed'};
/** A profile's supporter total: completed donations only. Refunded and reversed ones count for nothing. */
export function profileTotal(rows:LedgerRow[]):{amountMinor:number;currency:string|null;granted:boolean}{
 const live=rows.filter(r=>r.status==='completed');
 const sums=new Map<string,number>();
 for(const r of live)sums.set(r.currency,(sums.get(r.currency)??0)+r.amountMinor);
 const [currency,amountMinor]=[...sums].sort((a,b)=>b[1]-a[1])[0]??[null,0];
 return {amountMinor,currency,granted:live.some(r=>r.kind==='grant')};
}

/** Whether visitors see a profile as a supporter: it has a completed donation or grant, and its owner has not hidden it. */
export function showsSupporter(total:{amountMinor:number|null;granted:boolean}|null,showSupporter:boolean):boolean{
 return !!total&&showSupporter&&((total.amountMinor??0)>0||total.granted);
}

/**
 * Who may move a donation to another profile: only its donor, only between their own linked names (or to nobody),
 * and only if it supports one of their own names or nobody now. A gift to someone else's profile stays theirs.
 */
export function canReassign(d:{donorId:string|null;targetRsn:string|null;status:string},userId:string,ownNames:readonly string[],to:string|null):boolean{
 if(d.status!=='completed'||!d.donorId||d.donorId!==userId)return false;
 const own=new Set(ownNames.map(n=>n.toLowerCase()));
 if(d.targetRsn!==null&&!own.has(d.targetRsn.toLowerCase()))return false;
 return to===null||own.has(to.toLowerCase());
}

/** Donations open once a payment provider is connected (docs/supporters.md). Until then the Support page's
 * "who it supports" picker shows only in the dev environment, for review. */
export const DONATIONS_OPEN:boolean=false;
