import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {RequestError} from './request-body.ts';
import {enqueueSources,handleSyncBatch,pendingSources,runQueuedSync,MAX_RETRIES,PENDING_MS,WAIT_LIMIT_MS,type ConsumerDeps,type QueueDatabase,type SyncMessage} from './sync-queue.ts';
import {initial,type Journal} from './model.ts';

function database(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(readFileSync(new URL('../drizzle/0041_sync_queue.sql',import.meta.url),'utf8'));
 const db:QueueDatabase={prepare(query){let values:(string|number)[]=[];const st={
  bind(...args:(string|number)[]){values=args;return st;},
  async first<T>(){return (sql.prepare(query).get(...values)??null) as T|null;},
  async run(){return sql.prepare(query).run(...values);},
  async all<T>(){return {results:sql.prepare(query).all(...values) as T[]};},
 };return st;}};
 return {sql,db};
}
const journal=()=>({...structuredClone(initial),username:'Tester'}) as Journal;
function deps(over:Partial<ConsumerDeps>={},saved:Journal[]=[]):ConsumerDeps{
 return {load:async()=>({journal:journal(),revision:3,save:async next=>{saved.push(next);return true;}}),sync:async(_s,j)=>({...j,statsSyncedAt:'2026-11-05T00:00:00Z'}),...over};
}
function message(body:SyncMessage,attempts=1){
 const seen:{acked:boolean;retried:boolean;delay?:number}={acked:false,retried:false};
 return {seen,msg:{body,attempts,ack(){seen.acked=true;},retry(o?:{delaySeconds?:number}){seen.retried=true;seen.delay=o?.delaySeconds;}}};
}

test('a source is queued once per name; a failed send frees it; a stale entry can be queued again',async()=>{
 const {sql,db}=database();const sent:unknown[]=[];
 const queue={sendBatch:async(m:unknown[])=>{sent.push(...m);}};
 try{
  assert.deepEqual(await enqueueSources(db,queue,'Tester',['runeprofile','temple'],1_000),['runeprofile','temple']);
  assert.deepEqual(await enqueueSources(db,queue,'tester',['runeprofile','wom'],2_000),['wom'],'RuneProfile is already waiting');
  assert.deepEqual(sent,[{body:{rsn:'tester',source:'runeprofile',since:1_000}},{body:{rsn:'tester',source:'temple',since:1_000}},{body:{rsn:'tester',source:'wom',since:2_000}}]);
  assert.deepEqual(await pendingSources(db,'TESTER',3_000),['runeprofile','temple','wom']);
  assert.ok(sent.every(m=>!JSON.stringify(m).match(/position|place|ahead/)),'no queue position anywhere');
  await assert.rejects(enqueueSources(db,{sendBatch:async()=>{throw Error('queue down');}},'other',['temple'],1_000),/queue down/);
  assert.deepEqual(await pendingSources(db,'other',1_000),[],'a failed send leaves nothing pending');
  assert.deepEqual(await enqueueSources(db,queue,'tester',['runeprofile'],1_000+PENDING_MS+1),['runeprofile'],'stale after 15 minutes');
 }finally{sql.close();}
});

test('the consumer saves a source that answers, and finishes one that has nothing for the name without saving',async()=>{
 const saved:Journal[]=[];
 assert.deepEqual(await runQueuedSync({rsn:'tester',source:'temple'},1,deps({},saved)),{kind:'done',status:'updated'});
 assert.equal(saved.length,1);assert.equal('syncReport' in saved[0],false);
 const none=await runQueuedSync({rsn:'tester',source:'runeprofile'},1,deps({sync:async()=>{throw Error('Tester has no RuneProfile yet.');}},saved));
 assert.deepEqual(none,{kind:'done',status:'unavailable'});assert.equal(saved.length,1,'nothing saved: saved data is never replaced by an empty answer');
 assert.deepEqual(await runQueuedSync({rsn:'gone',source:'wom'},1,deps({load:async()=>null})),{kind:'done',status:'gone'},'deleted, private or reserved meanwhile');
});

test('a busy or rate-limited source is retried after the wait it asked for; other failures back off',async()=>{
 const busy=await runQueuedSync({rsn:'t',source:'wom'},1,deps({sync:async()=>{throw new RequestError(429,'Wise Old Man has asked us to wait.',90);}}));
 assert.deepEqual(busy,{kind:'retry',delaySeconds:90,reason:'busy'});
 const budget=await runQueuedSync({rsn:'t',source:'temple'},1,deps({sync:async()=>{throw new RequestError(429,'Refresh limit reached.',86_000);}}));
 assert.equal(budget.kind==='retry'&&budget.delaySeconds,43_200,'capped at the queue\'s 12-hour limit');
 const failed=await runQueuedSync({rsn:'t',source:'temple'},3,deps({sync:async()=>{throw TypeError('network');}}));
 assert.deepEqual(failed,{kind:'retry',delaySeconds:120,reason:'failed'});
 const race=await runQueuedSync({rsn:'t',source:'temple'},1,deps({load:async()=>({journal:journal(),revision:1,save:async()=>{throw Error('Progress changed.');}})}));
 assert.deepEqual(race,{kind:'retry',delaySeconds:5,reason:'conflict'});
});

test('a batch acknowledges, retries, and after the last retry sends to the dead-letter queue without losing data',async()=>{
 const {sql,db}=database();
 try{
  const queue={sendBatch:async()=>{}};
  await enqueueSources(db,queue,'a',['temple']);await enqueueSources(db,queue,'b',['wom']);await enqueueSources(db,queue,'c',['runeprofile']);
  const ok=message({rsn:'a',source:'temple'}),wait=message({rsn:'b',source:'wom'},2),last=message({rsn:'c',source:'runeprofile'},MAX_RETRIES+1);
  const saved:Journal[]=[];
  const batchDeps=deps({sync:async(source,j)=>{if(source==='temple')return j;throw new RequestError(429,'busy',30);}},saved);
  await handleSyncBatch([ok.msg,wait.msg,last.msg,message({rsn:'x',source:'evil' as never}).msg],db,batchDeps);
  assert.deepEqual(ok.seen,{acked:true,retried:false});
  assert.deepEqual(wait.seen,{acked:false,retried:true,delay:30});
  assert.deepEqual(last.seen,{acked:false,retried:true,delay:undefined},'a plain retry on the last delivery moves it to the dead-letter queue');
  assert.deepEqual(await pendingSources(db,'a'),[],'landed');assert.deepEqual(await pendingSources(db,'b'),['wom'],'still on its way');
  assert.deepEqual(await pendingSources(db,'c'),[],'finally failed: no longer shown as pending');
  assert.equal(saved.length,1,'only the source that answered saved anything');
 }finally{sql.close();}
});

test('a crowd behind one slow source all get their turn: waiting does not use up the retries',async()=>{
 const {sql,db}=database();
 try{
  // TempleOSRS takes one request every 12.5 seconds. Forty names refresh in the same moment.
  const GAP=12_500;let clock=1_000_000,slotFree=0;const done=new Set<string>(),failed:string[]=[];
  type Waiting={at:number;body:SyncMessage;attempts:number};const line:Waiting[]=[];
  const queue={sendBatch:async(ms:{body:SyncMessage}[])=>{for(const m of ms)line.push({at:clock,body:m.body,attempts:1});},
   send:async(body:SyncMessage,o?:{delaySeconds?:number})=>{line.push({at:clock+(o?.delaySeconds??0)*1000,body,attempts:1});}};
  for(let i=0;i<40;i++)await enqueueSources(db,queue,'player'+i,['temple'],clock);
  const crowd=deps({sync:async(_s,j)=>{if(clock<slotFree)throw new RequestError(429,'TempleOSRS refreshes are busy.',Math.max(1,Math.ceil((slotFree-clock)/1000)));slotFree=clock+GAP;return j;}});
  let seed=7;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let step=0;line.length&&step<100_000;step++){
   line.sort((a,b)=>a.at-b.at);const next=line.shift()!;clock=Math.max(clock,next.at);
   const m={body:next.body,attempts:next.attempts,ack(){done.add(next.body.rsn);},retry(o?:{delaySeconds?:number}){if(next.attempts>MAX_RETRIES)failed.push(next.body.rsn);else line.push({at:clock+(o?.delaySeconds??0)*1000,body:next.body,attempts:next.attempts+1});}};
   const before=line.length;
   await handleSyncBatch([m],db,crowd,queue,()=>clock,random);
   if(line.length>before)done.delete(next.body.rsn);// sent on to wait again: not finished yet
  }
  assert.deepEqual(failed,[],'nobody is dropped');
  assert.equal(done.size,40,'every name is synced');
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM sync_pending').get()!.n,0,'nothing is left showing as queued');
  assert.ok(clock-1_000_000<40*GAP*3,'the line clears in about the time the source allows');
 }finally{sql.close();}
});

test('a waiting source stays shown as queued, and is given up after the wait limit',async()=>{
 const {sql,db}=database();
 try{
  let clock=1_800_000_000_000;const sent:{body:SyncMessage;delay?:number}[]=[];
  const queue={sendBatch:async()=>{},send:async(body:SyncMessage,o?:{delaySeconds?:number})=>{sent.push({body,delay:o?.delaySeconds});}};
  await enqueueSources(db,queue,'a',['temple'],clock);
  const busy=deps({sync:async()=>{throw new RequestError(429,'busy',12);}});
  const first=message({rsn:'a',source:'temple',since:clock});
  clock+=20*60_000;// past PENDING_MS: without the refresh it would no longer show as queued
  await handleSyncBatch([first.msg],db,busy,queue,()=>clock,()=>0.5);
  assert.deepEqual(first.seen,{acked:true,retried:false});
  assert.equal(sent.length,1);assert.equal(sent[0].body.waits,1);assert.equal(sent[0].delay,12+10);
  assert.deepEqual(await pendingSources(db,'a',clock),['temple']);
  const late=message({rsn:'a',source:'temple',since:clock-WAIT_LIMIT_MS-1,waits:40});
  await handleSyncBatch([late.msg],db,busy,queue,()=>clock,()=>0.5);
  assert.deepEqual(late.seen,{acked:true,retried:false});assert.equal(sent.length,1,'not sent again');
  assert.deepEqual(await pendingSources(db,'a',clock),[]);
 }finally{sql.close();}
});
