import {PLUGIN_FEATURES} from './plugin-page';

/**
 * A verified profile: the RuneScape name is linked to a Discord account, and that same Discord account proved the
 * game account through the RuneLite plugin under this name (a plugin_account_owners binding whose current name is
 * this one). A binding under the name held by anyone else, a binding under an old name (a rename not synced yet)
 * or a name that is not linked is not verified. Nothing is restricted by it yet: see docs/verification.md.
 */
export function profileVerified(claim:string|null|undefined,bindings:readonly string[]):boolean{
 return !!claim&&bindings.includes(claim)&&bindings.every(owner=>owner===claim);
}

/**
 * The same rule as one SQL expression (1 or 0) for a query that has the claimed_names row as `alias`.
 * Two indexed lookups on plugin_account_owners(rsn). While the plugin page is off (the live site until the plugin
 * is on the Plugin Hub) it is a constant 0, so the live site neither queries nor shows anything new.
 */
export function verifiedSql(alias='c',shown=PLUGIN_FEATURES):string{
 if(!shown)return '0';
 return `(EXISTS(SELECT 1 FROM plugin_account_owners vo WHERE vo.rsn=${alias}.rsn AND vo.discord_id=${alias}.discord_id)`
  +` AND NOT EXISTS(SELECT 1 FROM plugin_account_owners vx WHERE vx.rsn=${alias}.rsn AND vx.discord_id<>${alias}.discord_id))`;
}
