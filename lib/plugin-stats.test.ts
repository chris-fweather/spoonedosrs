import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {cachedPluginStats,countPluginStats,PLUGIN_STATS_MAX_AGE} from './plugin-stats';

function setup(){
 const sql=new DatabaseSync(':memory:');
 sql.exec("CREATE TABLE claimed_names(rsn TEXT PRIMARY KEY NOT NULL,display_name TEXT NOT NULL,discord_id TEXT NOT NULL,claimed_at INTEGER NOT NULL)");
 sql.exec(readFileSync(new URL('../drizzle/0032_plugin_sync.sql',import.meta.url),'utf8'));
 const database={prepare(query:string){return {async first<T>(){return (sql.prepare(query).get() as T|undefined)??null;}};}};
 const token=(id:string,discord:string,revoked:number|null=null)=>sql.prepare('INSERT INTO plugin_tokens(id,discord_id,token_hash,label,created_at,revoked_at) VALUES(?,?,?,?,0,?)').run(id,discord,'hash-'+id,'PC',revoked);
 const seen=(key:string,discord:string,rsn:string)=>sql.prepare('INSERT INTO plugin_accounts(account_key,discord_id,rsn,display_name,first_seen,last_seen) VALUES(?,?,?,?,0,0)').run(key,discord,rsn,rsn);
 const claim=(rsn:string,discord:string)=>sql.prepare('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,0)').run(rsn,rsn,discord);
 return {sql,database,token,seen,claim};
}

test('an empty site counts zero connected accounts',async()=>{
 const x=setup();try{assert.deepEqual(await countPluginStats(x.database),{connectedAccounts:0});}finally{x.sql.close();}
});

test('connected accounts are distinct characters the plugin saw and that are linked to the same player with an active token',async()=>{
 const x=setup();try{
  x.token('t1','alice');x.token('t2','bob');x.token('t3','carol',123);
  x.seen('a1','alice','zezima');x.claim('zezima','alice');            // counted
  x.seen('a2','alice','alt one');x.claim('alt one','alice');          // counted
  x.seen('a3','alice','alt one');                                     // same character, second account key: once
  x.seen('b1','bob','zezima');                                        // bob saw a name alice holds: not his link
  x.seen('b2','bob','not added');                                     // seen, never added: not connected
  x.seen('c1','carol','gone');x.claim('gone','carol');                // every token removed: not connected
  x.claim('site only','dave');                                        // linked on the site, never through the plugin
  assert.deepEqual(await countPluginStats(x.database),{connectedAccounts:2});
 }finally{x.sql.close();}
});

test('stats are served from the shared cache until it expires, and a failing cache never blocks the count',async()=>{
 const store=new Map<string,Response>();let loads=0;
 const cache={async match(k:string){return store.get(k)?.clone();},async put(k:string,r:Response){store.set(k,r);}};
 const load=async()=>{loads++;return {connectedAccounts:7};};
 assert.deepEqual(await cachedPluginStats(load,cache,'k'),{connectedAccounts:7});
 assert.deepEqual(await cachedPluginStats(load,cache,'k'),{connectedAccounts:7});
 assert.equal(loads,1);
 assert.equal(store.get('k')?.headers.get('Cache-Control'),`public, max-age=${PLUGIN_STATS_MAX_AGE}`);
 const broken={async match():Promise<Response|undefined>{throw Error('down');},async put(){throw Error('down');}};
 assert.deepEqual(await cachedPluginStats(load,broken,'k'),{connectedAccounts:7});
 assert.deepEqual(await cachedPluginStats(load,null,'k'),{connectedAccounts:7});
 assert.equal(loads,3);
});

test('the public endpoint returns counts only and is cached',()=>{
 const route=readFileSync(new URL('../app/api/plugin/stats/route.ts',import.meta.url),'utf8');
 assert.match(route,/caches\.open\('spooned-plugin-stats-v1'\)/);
 assert.match(route,/public, max-age=\$\{PLUGIN_STATS_MAX_AGE\}/);
 assert.ok(PLUGIN_STATS_MAX_AGE>=300&&PLUGIN_STATS_MAX_AGE<=600);
});
