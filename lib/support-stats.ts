/**
 * Public numbers for the Support page. A count only: nothing here names a player, an amount or a donation.
 * Kept free of Worker imports so the count can be tested with node:sqlite.
 */
import {cachedStats,type StatsCache} from './stats-cache';

export type SupportStats={supporters:number};
type StatsDatabase={prepare(query:string):{first<T>():Promise<T|null>}};

/** How long the public counter may be stale; the endpoint and the shared cache use the same age. */
export const SUPPORT_STATS_MAX_AGE=600;

/**
 * Supporters: profiles that show supporter status to visitors, the same profiles the Supporters board lists (in any
 * currency). Read from the profile_support view, so a profile whose owner hid a gifted supporter status is left out,
 * and a hidden amount still counts (it shows as "Supporter"). Private profiles, and names only another player's link
 * covers, are left out, as on the boards. Refunded or reversed donations are already gone from the totals behind the view.
 */
export const SUPPORTERS_SQL=`SELECT COUNT(*) AS n FROM profile_support s
 LEFT JOIN profile_visibility v ON v.rsn=s.rsn LEFT JOIN claimed_names c ON c.rsn=s.rsn
 WHERE s.supporter=1 AND COALESCE(v.visibility,'public')='public'
 AND (c.rsn IS NOT NULL OR (EXISTS(SELECT 1 FROM journal_summaries j WHERE j.rsn=s.rsn) AND NOT EXISTS(SELECT 1 FROM profile_link_owners r WHERE r.rsn=s.rsn)))`;

export async function countSupportStats(database:StatsDatabase):Promise<SupportStats>{
 const row=await database.prepare(SUPPORTERS_SQL).first<{n:number}>();
 return {supporters:Number(row?.n??0)};
}

export function cachedSupportStats(load:()=>Promise<SupportStats>,cache:StatsCache|null,key:string):Promise<SupportStats>{
 return cachedStats(load,cache,key,SUPPORT_STATS_MAX_AGE);
}
