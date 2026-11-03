/**
 * Who may sync or add a RuneScape character seen by the RuneLite plugin. Pure, so every case is unit tested.
 *
 * Two kinds of ownership meet here:
 * - the site link: the RuneScape *name* linked (claimed) or reserved by a Discord account. Linking alone proves nothing.
 * - the plugin binding: the game *account* (its keyed account hash) proven by a Discord account whose plugin synced it
 *   while the name was linked to it, or that added it from "Seen by the RuneLite plugin". The binding follows the
 *   account through name changes, so it wins over the name.
 */
export type PluginStatus='linked'|'can_add'|'claimed_elsewhere'|'review_pending';
export type NameHolders={claim:string|null;reservation:string|null};
export type PluginAccessInput=NameHolders&{
 /** The Discord account whose plugin token made the sync or whose Account page asks. */
 me:string;
 /** Who the game account is bound to, if anyone. With several accounts seen under one name, another person's binding wins. */
 boundTo:string|null;
 /** This person already asked staff to review the name. */
 reviewPending:boolean;
};
export type PluginAccess={
 status:PluginStatus;
 /** The game account is bound to someone else: refused even when the name is unlinked or linked to this person. */
 boundElsewhere:boolean;
 /** Syncing now records (or refreshes) this person's binding. */
 bind:boolean;
 /** A character this person verified before, under a name not linked to them yet: a name change, most likely. */
 renamedOwn:boolean;
};

/** Who holds the name for someone other than this player, if anyone. */
export function heldBy(o:NameHolders,me:string):string|null{
 return o.claim?(o.claim===me?null:o.claim):o.reservation&&o.reservation!==me?o.reservation:null;
}

export function pluginAccess(i:PluginAccessInput):PluginAccess{
 const boundElsewhere=!!i.boundTo&&i.boundTo!==i.me,refused=i.reviewPending?'review_pending':'claimed_elsewhere';
 if(boundElsewhere)return {status:refused,boundElsewhere,bind:false,renamedOwn:false};
 if(i.claim===i.me)return {status:'linked',boundElsewhere,bind:true,renamedOwn:false};
 if(heldBy(i,i.me))return {status:refused,boundElsewhere,bind:false,renamedOwn:false};
 return {status:'can_add',boundElsewhere,bind:false,renamedOwn:i.boundTo===i.me};
}
