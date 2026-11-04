/** Cache key for a player's share card. It carries the site-wide board version (any change to visibility, ranks, supporter
 * badges or presentation bumps it) and the player's own journal revision, so a card is never reused after either changes. */
export function shareCardKey(requestUrl:string,name:string|undefined,boardVersion:number,journalRevision:number){
 return new Request(new URL('/api/share?cache=castle-v8&name='+encodeURIComponent(name?.toLowerCase()??'')+'&board='+boardVersion+'&revision='+journalRevision,requestUrl));
}
/** Only a public profile gets a drawn card. Private (by the owner or by staff) and anything unknown gets the static site image. */
export function drawsPlayerCard(visibility:string|null|undefined){return (visibility??'public')==='public';}
/** How long a drawn public card is shared per location. Matches the board cache window the card ranks come from. */
export const SHARE_CARD_SECONDS=300;
