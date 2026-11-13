import type {SyncSource} from './sync-journal';

/** Which public source answers each kind of data, in order (docs/provider-requests.md → Fallback).
 * - skills: official stats and boss KC. The first source that answers wins, so the Wise Old Man snapshot is only
 *   fetched when the OSRS Hiscores have no answer (down, slow, rate limited, invalid, or the name is unranked).
 * - collectionLog: every source that answers is combined. TempleOSRS adds unlocks RuneProfile's log is missing.
 * - milestones: dated 99s and base levels, from Wise Old Man achievements only.
 * - profile: quests, diaries and account type, from RuneProfile only. */
export const SOURCE_ORDER={
 skills:['hiscores','wom'],
 collectionLog:['runeprofile','temple'],
 milestones:['wom'],
 profile:['runeprofile'],
} as const satisfies Record<string,readonly SyncSource[]>;
export type DataType=keyof typeof SOURCE_ORDER;
export const COMBINED:ReadonlySet<DataType>=new Set(['collectionLog']);

/** Tries each source in order. A fallback list stops at the first that answers and skips the rest; a combined list
 * asks them all. `attempt` reports whether a source answered and is never called for a skipped source. When none
 * answers, `used` is empty and the caller keeps what was saved. */
export async function inOrder<S extends string>(sources:readonly S[],attempt:(source:S)=>Promise<boolean>,combine=false){
 const used:S[]=[],unavailable:S[]=[],skipped:S[]=[];
 for(const source of sources){
  if(used.length&&!combine){skipped.push(source);continue;}
  (await attempt(source)?used:unavailable).push(source);
 }
 return {used,unavailable,skipped};
}
