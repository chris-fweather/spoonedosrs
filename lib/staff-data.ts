import {env} from 'cloudflare:workers';
import type {PublicStaff} from './staff-policy';
import type {RateOverride} from './rate-catalogue';
import {SQUIRE_PREFIX} from './features';
/** Discord ids with at least one published guide (they earn Squire). Empty while Squire is off, without a query. */
export async function guideWriters(ids?:string[]):Promise<Set<string>> {
 if(!SQUIRE_PREFIX||ids?.length===0)return new Set();
 try {
  const where=ids?` AND author_id IN (${ids.map(()=>'?').join(',')})`:'';
  const rows=await env.DB!.prepare(`SELECT DISTINCT author_id FROM community_guides WHERE published IS NOT NULL${where}`).bind(...(ids??[])).all<{author_id:string}>();
  return new Set(rows.results.map(r=>r.author_id));
 }catch(error){if(String(error).includes('no such table'))return new Set();throw error;}
}
export async function publicStaff(id:string):Promise<PublicStaff|null> {
 try {return await env.DB!.prepare('SELECT role,prefix,title FROM staff_members WHERE discord_id=?').bind(id).first<PublicStaff>();}
 catch(error){if(String(error).includes('no such table'))return null;throw error;}
}
export async function publicStaffList():Promise<Map<string,PublicStaff>> {
 try {const rows=await env.DB!.prepare('SELECT discord_id,role,prefix,title FROM staff_members').all<PublicStaff & {discord_id:string}>();return new Map(rows.results.map(r=>[r.discord_id,{role:r.role,prefix:r.prefix,title:r.title??null}]));}
 catch(error){if(String(error).includes('no such table'))return new Map();throw error;}
}
export async function reviewedRates():Promise<RateOverride[]> {
 try {return (await env.DB!.prepare("SELECT kind,target,payload,source,revision FROM staff_overrides WHERE kind='rate'").all<RateOverride>()).results;}
 catch(error){if(String(error).includes('no such table'))return [];throw error;}
}
