import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {backoffDelay,createProviderClient,retryDelay,providerPolicy,type ProviderDatabase} from './provider-client';
import {RequestError} from './request-body';

const rp='https://api.runeprofile.com/v1/accounts/Tester/full';
const wom='https://api.wiseoldman.net/v2/players/Tester';
const temple='https://templeosrs.com/api/collection-log/player_collection_log.php?player=Tester&categories=all&includecount=1';
function setup(fetcher:typeof fetch=async()=>Response.json({ok:true}),extra:Partial<Parameters<typeof createProviderClient>[0]>={}){
 const sql=new DatabaseSync(':memory:');
 for(const file of ['0021_provider_controls.sql','0039_provider_backoff.sql'])sql.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
 const database:ProviderDatabase={prepare(query){let values:(string|number|Uint8Array)[]=[];return {
  bind(...args){values=args.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v);return this;},
  async first<T>(){const row=sql.prepare(query).get(...values);if(!row)return null;
   // D1 represents BLOBs as arrays; exercise that representation on cache hits.
   if(row.body instanceof Uint8Array)row.body=Array.from(row.body) as never;
   return row as T;},
  async run(){return sql.prepare(query).run(...values);}
 };}};
 let now=1_000_000,calls=0,budget=0;
 const options={database,key:async(s:string)=>s,dailyBudget:async()=>{budget++;},now:()=>now,random:()=>0,fetcher:async(...args:Parameters<typeof fetch>)=>{calls++;return fetcher(...args);},...extra};
 return {sql,options,client:createProviderClient(options),advance:(ms:number)=>{now+=ms;},calls:()=>calls,budget:()=>budget};
}
const limited=(seconds?:number)=>(error:unknown)=>error instanceof RequestError && error.status===429 && (!seconds||error.retryAfter===seconds);

test('fresh responses are shared between independent clients and consume no extra quota',async()=>{
 const x=setup();try{
  assert.equal((await x.client(rp)).headers.get('X-Spooned-Cache'),'miss');
  const other=createProviderClient(x.options);
  const hit=await other(rp);assert.deepEqual(await hit.json(),{ok:true});
  assert.equal(hit.headers.get('X-Spooned-Cache'),'hit');assert.equal(x.calls(),1);assert.equal(x.budget(),1);
  x.advance(60_001);await other(rp);assert.equal(x.calls(),2);
 }finally{x.sql.close();}
});
test('different players share each provider allowance, while other providers stay independent',async()=>{
 const x=setup();try{
  await x.client(temple);
  await assert.rejects(x.client(temple.replace('Tester','Other')),limited(13));
  await x.client(rp);await x.client(wom);
  x.advance(12_499);await assert.rejects(x.client(temple.replace('Tester','Other')),limited(1));
  x.advance(1);await x.client(temple.replace('Tester','Other'));
  assert.equal(x.calls(),4);
 }finally{x.sql.close();}
});
test('concurrent fills across clients make only one upstream request',async()=>{
 let release:()=>void=()=>{};let started:()=>void=()=>{};
 const ready=new Promise<void>(r=>{started=r;});const block=new Promise<void>(r=>{release=r;});
 const x=setup(async()=>{started();await block;return Response.json({ok:1});});
 try{const pending=x.client(rp);await ready;
  await assert.rejects(createProviderClient(x.options)(rp),limited(2));
  release();await pending;await x.client(rp);assert.equal(x.calls(),1);
 }finally{release();x.sql.close();}
});
test('429 cooldown is shared across clients and survives the normal pacing gap',async()=>{
 const x=setup(async()=>new Response(null,{status:429,headers:{'Retry-After':'120'}}));try{
  await assert.rejects(x.client(wom),limited(120));
  x.advance(60_000);
  await assert.rejects(createProviderClient(x.options)(wom.replace('Tester','Other')),limited(60));
  assert.equal(x.calls(),1);
  assert.equal(x.sql.prepare('SELECT lease_until FROM provider_responses').get()?.lease_until,0);
 }finally{x.sql.close();}
});
test('exhausted quota on a successful response blocks new reads but allows cache hits',async()=>{
 const x=setup(async()=>Response.json({ok:1},{headers:{'RateLimit-Remaining':'0','RateLimit-Reset':'90'}}));try{
  await x.client(wom);await x.client(wom);
  x.advance(5_000);await assert.rejects(x.client(wom.replace('Tester','Other')),limited(85));
  assert.equal(x.calls(),1);
 }finally{x.sql.close();}
});
test('read client rejects mutations, credentials, unsupported endpoints and redirects',async()=>{
 const x=setup(async(_url,init)=>{assert.equal(init?.redirect,'manual');assert.match(new Headers(init?.headers).get('User-Agent')??'',/SpoonedOSRS.*snooked/);return Response.json({});});try{
  for(const init of [{method:'POST'},{headers:{Cookie:'secret'}},{headers:{Authorization:'secret'}},{headers:{'X-API-Key':'secret'}}])await assert.rejects(x.client(rp,init),{status:400});
  await assert.rejects(x.client('https://api.wiseoldman.net/v2/players/Tester/update'),{status:400});
  await assert.rejects(x.client('https://other.example/v1/accounts/Tester/full'),{status:400});
  await x.client(rp);assert.equal(x.calls(),1);
 }finally{x.sql.close();}
});
test('upstream redirects are returned unfollowed and never cached',async()=>{
 const x=setup(async()=>new Response(null,{status:302,headers:{Location:'https://other.example/'}}));try{
  const first=await x.client(rp);assert.equal(first.status,302);assert.equal(first.ok,false);assert.equal(first.headers.get('Location'),null);
  assert.equal(x.sql.prepare('SELECT body FROM provider_responses').get()?.body,null);
  x.advance(2100);await x.client(rp);assert.equal(x.calls(),2);
 }finally{x.sql.close();}
});
test('negative lookup cache works; private results and cookies are never persisted',async()=>{
 const missing=setup(async()=>new Response(null,{status:404}));try{await missing.client(rp);assert.equal((await missing.client(rp)).status,404);assert.equal(missing.calls(),1);}finally{missing.sql.close();}
 for(const headers of [{'Cache-Control':'private'},{'Cache-Control':'no-store'},{'Set-Cookie':'session=secret'}]){
  const x=setup(async()=>Response.json({ok:1},{headers}));try{await x.client(rp);x.advance(2100);await x.client(rp);assert.equal(x.calls(),2);assert.equal(x.sql.prepare('SELECT body FROM provider_responses').get()?.body,null);}finally{x.sql.close();}
 }
});
test('errors, malformed JSON and oversized responses do not poison the cache',async()=>{
 for(const make of [()=>new Response('oops'),()=>new Response('a'.repeat(1_800_001))]){
  const x=setup(async()=>make());try{await assert.rejects(x.client(rp),{status:502});assert.equal(x.sql.prepare('SELECT body FROM provider_responses').get()?.body,null);}finally{x.sql.close();}
 }
 const x=setup(async()=>{throw Error('network');});try{await assert.rejects(x.client(rp),/network/);assert.equal(x.sql.prepare('SELECT lease_until FROM provider_responses').get()?.lease_until,0);}finally{x.sql.close();}
});
test('the retired RuneProfile model endpoint is no longer an allowed source',async()=>{
 const x=setup();try{await assert.rejects(x.client('https://runeprofile.com/api/profiles/models/Tester'),{status:400});assert.equal(x.calls(),0);}finally{x.sql.close();}
});
test('paused imports still serve fresh cache, but never fetch expired or absent records',async()=>{
 const x=setup();try{await x.client(rp);const paused=createProviderClient({...x.options,paused:true});await paused(rp);x.advance(60_001);await assert.rejects(paused(rp),{status:503});assert.equal(x.calls(),1);}finally{x.sql.close();}
});
test('Retry-After parsing honors dates, long waits and fallback without immediate retries',()=>{
 assert.equal(retryDelay(new Headers({'Retry-After':'86401'}),0),86_401_000);
 assert.equal(retryDelay(new Headers({'Retry-After':new Date(120_000).toUTCString()}),0),120_000);
 assert.equal(retryDelay(new Headers({'Retry-After':'nonsense'}),0),60_000);
 assert.equal(retryDelay(new Headers({'Retry-After':'0'}),0),1000);
 assert.equal(providerPolicy(new URL(rp)).ttl,60_000);
 assert.equal(providerPolicy(new URL(temple)).ttl,300_000);
});
test('Wise Old Man achievements use their own slower lane and a long cache beside the snapshot',async()=>{
 const x=setup();try{
  assert.equal(providerPolicy(new URL(wom+'/achievements')).provider,'womAchievements');
  await x.client(wom);x.advance(3_334);await x.client(wom+'/achievements');assert.equal(x.calls(),2);
  x.advance(3_334);await assert.rejects(x.client(wom.replace('Tester','Other')+'/achievements'),limited(9),'the lane gap still applies once the shared slot is free');
  x.advance(3_600_000);await x.client(wom+'/achievements');assert.equal(x.calls(),2,'cached for hours');
  await assert.rejects(x.client(wom+'/achievements/progress'),{status:400});
 }finally{x.sql.close();}
});
test('both Wise Old Man lanes share one slot, so together they stay at 18 requests a minute',async()=>{
 const x=setup();try{
  await x.client(wom);
  await assert.rejects(x.client(wom.replace('Tester','Other')+'/achievements'),limited(4),'the shared slot is still busy');
  // Worst case over a minute: each lane takes every turn it can, and the total never passes 18.
  let started=0;
  for(let t=0;t<60_000;t+=100){x.advance(100);
   for(const url of [wom.replace('Tester','P'+t),wom.replace('Tester','A'+t)+'/achievements']){try{await x.client(url);started++;}catch(error){if(!limited()(error))throw error;}}
  }
  assert.ok(started<=18&&started>=15,`${started} calls in a minute`);
 }finally{x.sql.close();}
});
test('a refusal on one Wise Old Man lane stops the other lane until the wait ends',async()=>{
 const x=setup(async url=>String(url).endsWith('/achievements')?new Response(null,{status:429,headers:{'Retry-After':'90'}}):Response.json({ok:1}));try{
  await assert.rejects(x.client(wom+'/achievements'),limited(90));
  x.advance(30_000);await assert.rejects(x.client(wom),limited(60));
  x.advance(60_000);await x.client(wom);assert.equal(x.calls(),2);
 }finally{x.sql.close();}
});
test('refusals without Retry-After back off 1, 2, 4, 8 minutes, capped at 15, and reset after a good answer',async()=>{
 let refuse=true;
 const x=setup(async()=>refuse?new Response(null,{status:503}):Response.json({ok:1}));try{
  const waits:number[]=[];
  for(let i=0;i<6;i++){
   await x.client(temple.replace('Tester','P'+i)).then(()=>assert.fail('should refuse'),(error:RequestError)=>{waits.push(error.retryAfter!);x.advance(error.retryAfter!*1000);});
  }
  assert.deepEqual(waits,[60,120,240,480,900,900]);
  refuse=false;await x.client(temple);x.advance(12_500);
  refuse=true;await assert.rejects(x.client(temple.replace('Tester','Again')),limited(60),'a good answer resets the backoff');
 }finally{x.sql.close();}
 assert.equal(backoffDelay(1,()=>1),72_000,'jitter adds up to 20%');assert.equal(backoffDelay(50,()=>0),900_000);
});
test('our Wise Old Man key raises the pacing, is sent upstream, and never reaches the cache key',async()=>{
 const keys:string[]=[],sent:(string|null)[]=[];
 const x=setup(async(_url,init)=>{sent.push(new Headers(init?.headers).get('x-api-key'));return Response.json({ok:1});},{apiKeys:{wom:'our-key'},key:async(s:string)=>{keys.push(s);return s;}});try{
  await x.client(wom);x.advance(1_000);await x.client(wom.replace('Tester','Other'));
  await assert.rejects(x.client(wom.replace('Tester','Third')),limited(1));
  assert.deepEqual(sent,['our-key','our-key']);assert.ok(keys.every(k=>!k.includes('our-key')));
  await x.client(rp);assert.equal(sent.at(-1),null,'other providers never get the key');
  await assert.rejects(x.client(wom,{headers:{'X-API-Key':'caller'}}),{status:400},'callers still cannot send a key');
 }finally{x.sql.close();}
});
