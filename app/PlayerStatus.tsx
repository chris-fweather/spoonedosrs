import type {PlayerLookup} from '@/lib/player-lookup';

const day=(at:string|null|undefined)=>{const t=Date.parse(at??'');return Number.isFinite(t)?new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):null;};

/** Shown when the OSRS Hiscores have no player by this name. With saved progress the name usually changed (or the account
 * was removed from the Hiscores): say so, and that the page shows what was saved, so it never reads as "nothing found"
 * above a full profile. Without saved progress, the name is probably misspelt. */
export function PlayerStatus({lookup,username,saved,savedAt,onRetry}:{lookup:PlayerLookup|null;username:string;saved:boolean;savedAt?:string|null;onRetry:()=>void}){
 if(lookup?.state!=='not_found')return null;
 const when=day(savedAt);
 return <div className="player-status not_found" role="status"><span>
  {saved?<><b>{username} is not on the OSRS Hiscores right now</b><small>The name may have changed, or the account may be hidden from the Hiscores. This page shows the progress saved{when?` on ${when}`:''}; if you know the new name, search for it.</small></>
   :<><b>Player not found in public sources</b><small>Check the spelling of {username}. A missing public listing does not prove the account does not exist.</small></>}
 </span><button type="button" className="link" onClick={onRetry}>Check again</button></div>;
}
