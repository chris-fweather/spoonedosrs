import {HttpError,linkName,readSession} from './auth';
import {accountName,db,sameOrigin} from './storage';
import {budgetKey,takeBudget} from './request-controls';
import {devAllowsProfile} from './environment';
import {openPluginConflictCase} from './moderation-store';
import type {PluginEvent} from './plugin-sync';
import {newToken,normalizeToken,tokenHash} from './plugin-token';
import {pluginAccess,type PluginStatus} from './plugin-binding';

/** The stored hash of a token, or a 401 when the value cannot be a token. */
async function hashToken(token:string){
 const hash=await tokenHash(token);
 if(!hash)throw new HttpError(401,'That is not a plugin token.');
 return hash;
}

/** Active tokens one Discord account may hold: one per computer is plenty. */
export const MAX_PLUGIN_TOKENS=10;

/** last_used_at is a hint for the owner, not an audit trail; skip most writes to it. */
const LAST_USED_GRANULARITY_MS=5*60_000;
/** The ledger only guards against counting a resent event twice. */
const EVENT_RETENTION_MS=180*86_400_000;

/** label names the computer (the player names the token when making it); the last sync says which character and plugin version it ran. */
export type PluginTokenView={id:string;label:string;createdAt:number;lastUsedAt:number|null;lastSyncAt:number|null;lastSyncName:string|null;pluginVersion:string|null};

export function validLabel(value:unknown):string{
 const label=typeof value==='string'?value.trim():'';
 if(!label)return 'RuneLite';
 if(label.length>40||!/^[\p{L}\p{N} '._-]+$/u.test(label))throw new HttpError(400,'Name the token in up to 40 letters, numbers or spaces.');
 return label;
}

/** Token changes must come from the site's own Account page. */
async function owner(request:Request){
 if(request.method!=='GET'){
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new HttpError(403,'Manage plugin tokens from your Account page.');
  sameOrigin(request);
 }
 const session=await readSession(request);
 if(!session)throw new HttpError(401,'Log in with Discord to manage plugin tokens.');
 return session.discordId;
}

export async function listPluginTokens(request:Request):Promise<PluginTokenView[]>{
 const discordId=await owner(request);
 const rows=await db().prepare(`SELECT t.id,t.label,t.created_at,t.last_used_at,t.last_sync_at,COALESCE(c.display_name,t.last_sync_rsn) AS last_sync_name,t.plugin_version
  FROM plugin_tokens t LEFT JOIN claimed_names c ON c.rsn=t.last_sync_rsn WHERE t.discord_id=? AND t.revoked_at IS NULL ORDER BY t.created_at DESC`)
  .bind(discordId).all<{id:string;label:string;created_at:number;last_used_at:number|null;last_sync_at:number|null;last_sync_name:string|null;plugin_version:string|null}>();
 return rows.results.map(r=>({id:r.id,label:r.label,createdAt:r.created_at,lastUsedAt:r.last_used_at,lastSyncAt:r.last_sync_at,lastSyncName:r.last_sync_name,pluginVersion:r.plugin_version}));
}

/** Creates a token and returns it once. Only its hash is stored. */
export async function createPluginToken(request:Request,label:unknown):Promise<PluginTokenView&{token:string}>{
 const discordId=await owner(request),name=validLabel(label);
 const token=newToken(),id=crypto.randomUUID(),now=Date.now();
 const result=await db().prepare(`INSERT INTO plugin_tokens(id,discord_id,token_hash,label,created_at)
  SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM plugin_tokens WHERE discord_id=? AND revoked_at IS NULL)<?`)
  .bind(id,discordId,await hashToken(token),name,now,discordId,MAX_PLUGIN_TOKENS).run();
 if(!result.meta.changes)throw new HttpError(409,`You can have up to ${MAX_PLUGIN_TOKENS} plugin tokens. Remove one you no longer use.`);
 return {id,label:name,createdAt:now,lastUsedAt:null,lastSyncAt:null,lastSyncName:null,pluginVersion:null,token};
}

export async function revokePluginToken(request:Request,id:unknown){
 const discordId=await owner(request);
 if(typeof id!=='string'||id.length>64)throw new HttpError(400,'Choose a token to remove.');
 const result=await db().prepare('UPDATE plugin_tokens SET revoked_at=? WHERE id=? AND discord_id=? AND revoked_at IS NULL').bind(Date.now(),id,discordId).run();
 if(!result.meta.changes)throw new HttpError(404,'That token was already removed.');
}

/** The Discord account behind a plugin request's bearer token. */
export async function authenticatePlugin(request:Request):Promise<{discordId:string;tokenId:string}>{
 const header=request.headers.get('authorization')??'';
 const token=/^Bearer ([A-Za-z0-9 -]{16,40})$/.exec(header)?.[1];
 if(!token||!normalizeToken(token))throw new HttpError(401,'Add your plugin token in the plugin settings.');
 const row=await db().prepare(`SELECT t.id,t.discord_id,t.last_used_at FROM plugin_tokens t JOIN users u ON u.discord_id=t.discord_id
  WHERE t.token_hash=? AND t.revoked_at IS NULL`).bind(await hashToken(token)).first<{id:string;discord_id:string;last_used_at:number|null}>();
 if(!row)throw new HttpError(401,'This plugin token was removed or never existed. Create a new one on your Account page.');
 const now=Date.now();
 if(!row.last_used_at||now-row.last_used_at>LAST_USED_GRANULARITY_MS)await db().prepare('UPDATE plugin_tokens SET last_used_at=? WHERE id=?').bind(now,row.id).run();
 return {discordId:row.discord_id,tokenId:row.id};
}

/** Notes a saved sync on the token that made it, for the RuneLite plugin section of the Account page. */
export async function recordTokenSync(tokenId:string,rsn:string,version:string){
 await db().prepare('UPDATE plugin_tokens SET last_sync_at=?,last_sync_rsn=?,plugin_version=? WHERE id=?').bind(Date.now(),rsn.toLowerCase(),/^[0-9A-Za-z.+-]{1,20}$/.test(version)?version:null,tokenId).run();
}

/** A sync the player must act on first; `code` tells the plugin what to show. */
export class PluginActionError extends HttpError{
 code:'add_character'|'claimed_elsewhere'|'review_pending';
 constructor(code:PluginActionError['code'],message:string){super(409,message);this.code=code;}
}

/** Remembers that this Discord account's plugin saw the character logged in. That is the proof for Add and Request review. */
async function recordSeen(key:string,discordId:string,display:string){
 const now=Date.now();
 await db().prepare(`INSERT INTO plugin_accounts(account_key,discord_id,rsn,display_name,first_seen,last_seen) VALUES(?,?,?,?,?,?)
  ON CONFLICT(account_key,discord_id) DO UPDATE SET rsn=excluded.rsn,display_name=excluded.display_name,last_seen=excluded.last_seen`).bind(key,discordId,display.toLowerCase(),display,now,now).run();
}

type Owner={claim:string|null;reservation:string|null};
async function owners(rsn:string):Promise<Owner>{
 const row=await db().prepare('SELECT c.discord_id AS claim,r.discord_id AS reservation FROM (SELECT ? AS rsn) n LEFT JOIN claimed_names c ON c.rsn=n.rsn LEFT JOIN profile_link_owners r ON r.rsn=n.rsn')
  .bind(rsn).first<Owner>();
 return row??{claim:null,reservation:null};
}
async function reviewPending(rsn:string,discordId:string){
 return !!await db().prepare("SELECT 1 FROM staff_cases WHERE rsn=? AND action='relink' AND target_id=? AND state='pending'").bind(rsn,discordId).first();
}

/**
 * Binds game accounts to this Discord account: once proven through the plugin, no one else can sync or add them,
 * under any name. Never takes a binding from someone else (only staff move those). True when every key is bound here.
 */
async function bindAccounts(keys:string[],discordId:string,rsn:string):Promise<boolean>{
 if(!keys.length)return true;
 const now=Date.now(),database=db();
 const results=await database.batch(keys.map(key=>database.prepare(`INSERT INTO plugin_account_owners(account_key,discord_id,rsn,rsn_at_binding,bound_at,updated_at) VALUES(?,?,?,?,?,?)
  ON CONFLICT(account_key) DO UPDATE SET rsn=excluded.rsn,updated_at=excluded.updated_at WHERE plugin_account_owners.discord_id=excluded.discord_id`).bind(key,discordId,rsn,rsn,now,now)));
 return results.every(r=>r.meta.changes>0);
}

/** The game accounts this player's plugin saw under a name, and who each is bound to: another person's binding first. */
async function seenUnder(rsn:string,discordId:string){
 const rows=await db().prepare(`SELECT p.account_key,p.display_name,o.discord_id AS bound FROM plugin_accounts p LEFT JOIN plugin_account_owners o ON o.account_key=p.account_key
  WHERE p.rsn=? AND p.discord_id=? ORDER BY p.last_seen DESC LIMIT 10`).bind(rsn,discordId).all<{account_key:string;display_name:string;bound:string|null}>();
 const list=rows.results;
 const boundTo=list.find(r=>r.bound&&r.bound!==discordId)?.bound??list.find(r=>r.bound)?.bound??null;
 return {display:list[0]?.display_name??null,keys:list.map(r=>r.account_key),boundTo};
}

/**
 * Syncs only characters already linked to the token's Discord account and not proven by another one through the
 * plugin. Any other character is recorded as seen and refused with a reason: the player adds it, or asks staff to
 * review, from their Account page. The plugin keeps its queued pets and drops meanwhile.
 */
export async function bindCharacter(name:string,discordId:string,account:string):Promise<string>{
 const display=accountName(name),rsn=display.toLowerCase();
 if(!devAllowsProfile(rsn))throw new HttpError(403,'The dev environment only holds the owner\'s profile.');
 const key=await budgetKey('plugin-account:'+account);
 await recordSeen(key,discordId,display);
 const [o,bound]=await Promise.all([owners(rsn),db().prepare('SELECT discord_id,rsn FROM plugin_account_owners WHERE account_key=?').bind(key).first<{discord_id:string;rsn:string}>()]);
 const input={...o,me:discordId,boundTo:bound?.discord_id??null,reviewPending:false};
 let access=pluginAccess(input);
 // Bind on the first linked sync; refresh the name after a change. A binding someone made meanwhile wins.
 if(access.bind&&!(bound?.discord_id===discordId&&bound.rsn===rsn)&&!await bindAccounts([key],discordId,rsn))
  access=pluginAccess({...input,boundTo:(await db().prepare('SELECT discord_id FROM plugin_account_owners WHERE account_key=?').bind(key).first<{discord_id:string}>())?.discord_id??null});
 if(access.status==='linked')
  return (await db().prepare('SELECT display_name FROM claimed_names WHERE rsn=?').bind(rsn).first<{display_name:string}>())?.display_name??display;
 if(access.status==='can_add')throw new PluginActionError('add_character',access.renamedOwn
  ?`${display} looks like a new name for a character you verified. Add it to your profiles on spoonedosrs.com to keep syncing.`
  :`Add ${display} to your profiles on spoonedosrs.com to start syncing it.`);
 if(await reviewPending(rsn,discordId))throw new PluginActionError('review_pending',`${display} is linked to another Discord account. Staff are reviewing your request.`);
 throw new PluginActionError('claimed_elsewhere',`${display} is linked to another Discord account. Request a review on spoonedosrs.com if it is yours.`);
}

/** `verified`: this player's plugin proved the character before (it stays theirs after unlinking, until released). */
export type SeenCharacter={name:string;lastSeen:number;status:PluginStatus;verified:boolean};

/** Characters this player's plugin has seen, and what they can do about each. */
export async function listCharacters(request:Request):Promise<SeenCharacter[]>{
 const discordId=await owner(request);
 const rows=await db().prepare(`SELECT p.rsn,MAX(p.display_name) AS name,MAX(p.last_seen) AS last_seen,c.discord_id AS claim,r.discord_id AS reservation,
  EXISTS(SELECT 1 FROM staff_cases s WHERE s.rsn=p.rsn AND s.action='relink' AND s.target_id=? AND s.state='pending') AS pending,
  MAX(CASE WHEN o.discord_id<>? THEN o.discord_id END) AS bound_other,MAX(o.discord_id=?) AS bound_me
  FROM plugin_accounts p LEFT JOIN claimed_names c ON c.rsn=p.rsn LEFT JOIN profile_link_owners r ON r.rsn=p.rsn
  LEFT JOIN plugin_account_owners o ON o.account_key=p.account_key
  WHERE p.discord_id=? GROUP BY p.rsn ORDER BY last_seen DESC LIMIT 50`).bind(discordId,discordId,discordId,discordId)
  .all<{rsn:string;name:string;last_seen:number;claim:string|null;reservation:string|null;pending:number;bound_other:string|null;bound_me:number|null}>();
 return rows.results.map(r=>{
  const access=pluginAccess({claim:r.claim,reservation:r.reservation,me:discordId,boundTo:r.bound_other??(r.bound_me?discordId:null),reviewPending:!!r.pending});
  return {name:r.name,lastSeen:r.last_seen,status:access.status,verified:!r.bound_other&&!!r.bound_me};
 });
}

/**
 * Add a seen character to this player's profiles, ask staff to review another account's hold on it, or release this
 * player's own plugin verification of it. Unlinking a name keeps the verification, so nobody else can add the
 * character afterwards; Release is the explicit way to let it go, and only once the name is unlinked.
 */
export async function characterAction(request:Request,name:unknown,action:unknown){
 const discordId=await owner(request);
 const display=accountName(name),rsn=display.toLowerCase();
 if(!devAllowsProfile(rsn))throw new HttpError(403,'The dev environment only holds the owner\'s profile.');
 const seen=await seenUnder(rsn,discordId);
 if(!seen.display)throw new HttpError(403,`Log in to ${display} with the plugin first, so the site knows you play it.`);
 const o=await owners(rsn),access=pluginAccess({...o,me:discordId,boundTo:seen.boundTo,reviewPending:false});
 if(action==='add'){
  if(access.status==='claimed_elsewhere')throw new HttpError(409,`${display} is linked to another Discord account. Request a review instead.`);
  await linkName(seen.display,discordId);
  // Adding through the plugin proves the character: it is bound to this account from now on.
  if(!await bindAccounts(seen.keys,discordId,rsn))throw new HttpError(409,`${display} is linked to another Discord account. Request a review instead.`);
  return {status:'linked' as const};
 }
 if(action==='review'){
  if(access.status!=='claimed_elsewhere')throw new HttpError(409,`${display} is not linked to anyone else. Add it instead.`);
  await takeBudget('plugin-review:'+discordId,5,86_400);
  await openPluginConflictCase(display,discordId,access.boundElsewhere?seen.boundTo:null);
  return {status:'review_pending' as const};
 }
 if(action==='release'){
  if(o.claim===discordId)throw new HttpError(409,`Unlink ${display} first. A linked character stays verified to you.`);
  await db().prepare(`DELETE FROM plugin_account_owners WHERE discord_id=? AND account_key IN (SELECT account_key FROM plugin_accounts WHERE rsn=? AND discord_id=?)`).bind(discordId,rsn,discordId).run();
  return {status:pluginAccess({...o,me:discordId,boundTo:seen.boundTo===discordId?null:seen.boundTo,reviewPending:false}).status};
 }
 throw new HttpError(400,'Choose Add, Request review or Release.');
}

/** Notes received events. A resent event is ignored by the ledger; the journal merge is already idempotent. */
export async function recordPluginEvents(discordId:string,rsn:string,events:PluginEvent[]){
 const database=db(),now=Date.now();
 const writes=events.map(e=>database.prepare('INSERT OR IGNORE INTO plugin_events(discord_id,event_id,rsn,type,received_at) VALUES(?,?,?,?,?)').bind(discordId,e.id,rsn.toLowerCase(),e.type,now));
 if(Math.random()<0.01)writes.push(database.prepare('DELETE FROM plugin_events WHERE received_at<?').bind(now-EVENT_RETENTION_MS));
 if(writes.length)await database.batch(writes);
}
