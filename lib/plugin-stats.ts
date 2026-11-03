/**
 * Public numbers for the plugin page. Counts only: nothing here names a player or an account.
 * Kept free of Worker imports so the count and the cache can be tested with node:sqlite.
 */
import {cachedStats,type StatsCache} from './stats-cache';

export type PluginStats={connectedAccounts:number};
type StatsDatabase={prepare(query:string):{first<T>():Promise<T|null>}};

/** How long the public counter may be stale; the endpoint and the shared cache use the same age. */
export const PLUGIN_STATS_MAX_AGE=600;

/**
 * Connected accounts: distinct RuneScape characters that the plugin has seen logged in (plugin_accounts) and that are
 * linked to the same Discord account (claimed_names), while that account still holds an active plugin token. Those are
 * the characters whose syncs the plugin delivers. A character seen by two players counts once; names only seen,
 * linked to someone else, or whose owner removed every token are left out.
 */
export const CONNECTED_ACCOUNTS_SQL=`SELECT COUNT(DISTINCT p.rsn) AS n FROM plugin_accounts p
 JOIN claimed_names c ON c.rsn=p.rsn AND c.discord_id=p.discord_id
 WHERE EXISTS(SELECT 1 FROM plugin_tokens t WHERE t.discord_id=p.discord_id AND t.revoked_at IS NULL)`;

export async function countPluginStats(database:StatsDatabase):Promise<PluginStats>{
 const row=await database.prepare(CONNECTED_ACCOUNTS_SQL).first<{n:number}>();
 return {connectedAccounts:Number(row?.n??0)};
}

/** The stats from the shared cache when fresh, otherwise counted and stored for PLUGIN_STATS_MAX_AGE. A cache failure
 * never blocks the count. */
export function cachedPluginStats(load:()=>Promise<PluginStats>,cache:StatsCache|null,key:string):Promise<PluginStats>{
 return cachedStats(load,cache,key,PLUGIN_STATS_MAX_AGE);
}
