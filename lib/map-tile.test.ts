import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapTile, tileKey} from './map-tile';

test('tile keys stay inside the game world',()=>{
 const key=(q:string)=>tileKey(new URL('https://x/api/map-tile?'+q));
 assert.deepEqual(key('z=2&p=0&x=50&y=50'),{z:2,p:0,x:50,y:50});
 assert.equal(key('z=2&p=0&x=500&y=50'),'outside');
 assert.equal(key('z=-3&p=0&x=9&y=1'),'outside');
 assert.equal(key('z=9&p=0&x=1&y=1'),null);
 assert.equal(key('z=2&p=4&x=1&y=1'),null);
});

test('the edge cache answers repeat views without going back to GitHub',async()=>{
 const real={fetch:globalThis.fetch,caches:(globalThis as {caches?:unknown}).caches};
 const store=new Map<string,Response>(),pending:Promise<unknown>[]=[];let fetched=0;
 (globalThis as {caches?:unknown}).caches={default:{match:async(r:Request)=>store.get(r.url)?.clone(),put:async(r:Request,res:Response)=>{store.set(r.url,res);}}};
 globalThis.fetch=(async()=>{fetched++;return new Response(new Uint8Array([137,80,78,71]),{status:200});}) as typeof fetch;
 try{
  const ctx={waitUntil:(p:Promise<unknown>)=>{pending.push(p);}};
  const first=await mapTile(new Request('https://x/api/map-tile?z=2&p=0&x=50&y=50&junk=1'),ctx);await Promise.all(pending);
  const second=await mapTile(new Request('https://x/api/map-tile?x=50&y=50&z=2&p=0'),ctx);
  assert.equal(first.status,200);assert.equal(second.status,200);assert.equal(fetched,1);
  assert.equal((await mapTile(new Request('https://x/api/map-tile?z=2&p=0&x=999&y=1'),ctx)).status,404);assert.equal(fetched,1);
 }finally{globalThis.fetch=real.fetch;(globalThis as {caches?:unknown}).caches=real.caches;}
});
