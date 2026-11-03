import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync} from 'node:fs';
import {cachedSupportStats,countSupportStats,SUPPORT_STATS_MAX_AGE} from './support-stats';

const dir=new URL('../drizzle/',import.meta.url);
/** The real schema: every migration in order. Discord IDs here are made up. */
function setup(){
 const sql=new DatabaseSync(':memory:');
 for(const file of readdirSync(dir).filter(f=>/^\d{4}_.+\.sql$/.test(f)).sort())sql.exec(readFileSync(new URL(file,dir),'utf8'));
 const database={prepare(query:string){return {async first<T>(){return (sql.prepare(query).get() as T|undefined)??null;}};}};
 sql.prepare("INSERT INTO users(discord_id,username,updated_at) VALUES('900000000000000001','someone',0)").run();
 const claim=(rsn:string,discord='900000000000000001')=>sql.prepare('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,0)').run(rsn,rsn,discord);
 const total=(rsn:string,amount:number,granted=0,currency='USD')=>sql.prepare('INSERT INTO profile_supporter_totals(rsn,amount_minor,currency,granted) VALUES(?,?,?,?)').run(rsn,amount,currency,granted);
 const hideSupporter=(rsn:string)=>sql.prepare('INSERT INTO profile_presentation(rsn,show_supporter) VALUES(?,0)').run(rsn);
 const hideAmount=(rsn:string)=>sql.prepare('INSERT INTO profile_presentation(rsn,show_donation) VALUES(?,0)').run(rsn);
 const privateProfile=(rsn:string)=>sql.prepare("INSERT INTO profile_visibility(rsn,visibility) VALUES(?,'private')").run(rsn);
 const summary=(rsn:string)=>sql.prepare("INSERT INTO journal_summaries(rsn,name,data) VALUES(?,?,'{}')").run(rsn,rsn);
 const owner=(rsn:string)=>sql.prepare('INSERT INTO profile_link_owners(rsn,discord_id,linked_at) VALUES(?,?,0)').run(rsn,'900000000000000002');
 return {sql,database,claim,total,hideSupporter,hideAmount,privateProfile,summary,owner};
}

test('an empty site counts zero supporters',async()=>{
 const x=setup();try{assert.deepEqual(await countSupportStats(x.database),{supporters:0});}finally{x.sql.close();}
});

test('supporters are the profiles that show supporter status on the site, as the Supporters board lists them',async()=>{
 const x=setup();try{
  x.claim('alice');x.total('alice',1000);                       // counted
  x.claim('bob');x.total('bob',500,0,'EUR');                    // counted: any currency
  x.claim('carol');x.total('carol',0,1);                        // counted: granted supporter status without an amount
  x.claim('dave');x.total('dave',2500);x.hideAmount('dave');    // counted: a hidden amount still shows "Supporter"
  x.claim('erin');x.total('erin',1000);x.hideSupporter('erin'); // left out: the owner hid gifted supporter status
  x.claim('frank');x.total('frank',1000);x.privateProfile('frank'); // left out: private profile
  x.claim('gina');x.total('gina',0);                            // left out: every donation refunded
  x.summary('unlinked');x.total('unlinked',700);                // counted: an unlinked public profile on the board
  x.summary('held');x.total('held',700);x.owner('held');        // left out: a name another player's link covers
  x.claim('hank');                                              // linked, never supported
  assert.deepEqual(await countSupportStats(x.database),{supporters:5});
 }finally{x.sql.close();}
});

test('the count is served from the shared cache, and a failing cache never blocks it',async()=>{
 const store=new Map<string,Response>();let loads=0;
 const cache={async match(k:string){return store.get(k)?.clone();},async put(k:string,r:Response){store.set(k,r);}};
 const load=async()=>{loads++;return {supporters:4};};
 assert.deepEqual(await cachedSupportStats(load,cache,'k'),{supporters:4});
 assert.deepEqual(await cachedSupportStats(load,cache,'k'),{supporters:4});
 assert.equal(loads,1);
 assert.equal(store.get('k')?.headers.get('Cache-Control'),`public, max-age=${SUPPORT_STATS_MAX_AGE}`);
 const broken={async match():Promise<Response|undefined>{throw Error('down');},async put(){throw Error('down');}};
 assert.deepEqual(await cachedSupportStats(load,broken,'k'),{supporters:4});
 assert.equal(loads,2);
});

test('the public endpoint returns the count only and is cached for ten minutes',()=>{
 const route=readFileSync(new URL('../app/api/support/stats/route.ts',import.meta.url),'utf8');
 assert.match(route,/caches\.open\('spooned-support-stats-v1'\)/);
 assert.match(route,/public, max-age=\$\{SUPPORT_STATS_MAX_AGE\}/);
 assert.equal(SUPPORT_STATS_MAX_AGE,600);
 assert.match(readFileSync(new URL('../app/support/SupportPage.tsx',import.meta.url),'utf8'),/fetch\('\/api\/support\/stats'/);
});
