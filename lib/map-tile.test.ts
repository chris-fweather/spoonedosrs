import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapTile, tileKey, tileObjectKey, TILE_VERSION} from './map-tile';
import {hasMaps, isTileVersion, mapAttribution, MEJRS_TILES, tileUrl} from './map-tile-source';

test('tile keys stay inside the game world',()=>{
 const key=(q:string)=>tileKey(new URL('https://x/api/map-tile?'+q),MEJRS_TILES);
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
  const first=await mapTile(new Request('https://x/api/map-tile?z=2&p=0&x=50&y=50&junk=1'),ctx,undefined,MEJRS_TILES);await Promise.all(pending);
  const second=await mapTile(new Request('https://x/api/map-tile?x=50&y=50&z=2&p=0'),ctx,undefined,MEJRS_TILES);
  assert.equal(first.status,200);assert.equal(second.status,200);assert.equal(fetched,1);
  assert.equal((await mapTile(new Request('https://x/api/map-tile?z=2&p=0&x=999&y=1'),ctx,undefined,MEJRS_TILES)).status,404);assert.equal(fetched,1);
 }finally{globalThis.fetch=real.fetch;(globalThis as {caches?:unknown}).caches=real.caches;}
});

/** A Worker-like run: an edge cache, an R2 bucket and GitHub, each a test double. */
function world(upstream:()=>Promise<Response>|Response){
 const store=new Map<string,Response>(),objects=new Map<string,ArrayBuffer>(),pending:Promise<unknown>[]=[];let fetched=0;
 const real={fetch:globalThis.fetch,caches:(globalThis as {caches?:unknown}).caches};
 (globalThis as {caches?:unknown}).caches={default:{match:async(r:Request)=>store.get(r.url)?.clone(),put:async(r:Request,res:Response)=>{store.set(r.url,res);}}};
 globalThis.fetch=(async()=>{fetched++;return upstream();}) as typeof fetch;
 const bucket={get:async(k:string)=>objects.has(k)?{arrayBuffer:async()=>objects.get(k)!}:null,put:async(k:string,v:ArrayBuffer)=>{objects.set(k,v);}};
 const ctx={waitUntil:(p:Promise<unknown>)=>{pending.push(p);}};
 return {store,objects,bucket,ctx,settle:()=>Promise.all(pending),fetched:()=>fetched,restore:()=>{globalThis.fetch=real.fetch;(globalThis as {caches?:unknown}).caches=real.caches;}};
}
const PNG=new Uint8Array([137,80,78,71,13,10,26,10]);
const ask=(q='z=2&p=0&x=50&y=50')=>new Request('https://x/api/map-tile?'+q);

test('a GitHub tile is saved to R2 under its version and served from R2 once the edge cache is gone',async()=>{
 const w=world(()=>new Response(PNG,{status:200}));
 try{
  const first=await mapTile(ask(),w.ctx,w.bucket,MEJRS_TILES);await w.settle();
  assert.equal(first.headers.get('X-Tile-Source'),'upstream');assert.deepEqual([...w.objects.keys()],[`${MEJRS_TILES}/2/0_50_50.png`]);
  w.store.clear();
  const second=await mapTile(ask(),w.ctx,w.bucket,MEJRS_TILES);
  assert.equal(second.status,200);assert.equal(second.headers.get('X-Tile-Source'),'r2');assert.equal(w.fetched(),1,'R2 answered, not GitHub');
  assert.match(second.headers.get('Cache-Control')??'',/immutable/);
 }finally{w.restore();}
});
test('with GitHub down, a stored tile still loads; a tile stored nowhere is a 502 that is never cached or stored',async()=>{
 const w=world(()=>new Response('down',{status:503}));
 try{
  w.objects.set(tileObjectKey({z:2,p:0,x:50,y:50},MEJRS_TILES),PNG.buffer);
  assert.equal((await mapTile(ask(),w.ctx,w.bucket,MEJRS_TILES)).status,200);
  const cold=await mapTile(ask('z=2&p=0&x=51&y=50'),w.ctx,w.bucket,MEJRS_TILES);await w.settle();
  assert.equal(cold.status,502);assert.equal(cold.headers.get('Cache-Control'),'no-store');
  assert.ok(![...w.store.keys()].some(k=>k.includes('x=51')),'not in the edge cache');assert.equal(w.objects.size,1,'not in R2');
 }finally{w.restore();}
});
test('open sea is cached at the edge for a day but never stored in R2; an error page is never stored as a tile',async()=>{
 const sea=world(()=>new Response(null,{status:404}));
 try{const r=await mapTile(ask(),sea.ctx,sea.bucket,MEJRS_TILES);await sea.settle();assert.equal(r.status,404);assert.equal(sea.store.size,1);assert.equal(sea.objects.size,0);}finally{sea.restore();}
 const html=world(()=>new Response('<html>rate limited</html>',{status:200}));
 try{const r=await mapTile(ask(),html.ctx,html.bucket,MEJRS_TILES);await html.settle();assert.equal(r.status,502);assert.equal(html.objects.size,0);assert.equal(html.store.size,0);}finally{html.restore();}
});
test('invalid tile keys are refused before any lookup',async()=>{
 const w=world(()=>new Response(PNG));
 try{for(const q of ['z=9&p=0&x=1&y=1','z=2&p=4&x=1&y=1','z=2&p=0&x=-1&y=1','z=a&p=0&x=1&y=1'])assert.equal((await mapTile(ask(q),w.ctx,w.bucket,MEJRS_TILES)).status,400,q);assert.equal(w.fetched(),0);}finally{w.restore();}
});

const OWN='spooned-2026-11-01';
test('our own tiles come from R2 only: a stored tile loads, a missing one is open sea, GitHub is never asked',async()=>{
 const w=world(()=>new Response(PNG));
 try{
  w.objects.set(tileObjectKey({z:2,p:0,x:50,y:50},OWN),PNG.buffer);
  w.objects.set(tileObjectKey({z:2,p:0,x:51,y:50},MEJRS_TILES),PNG.buffer);// Mejrs' copy of the next square is not ours
  const hit=await mapTile(ask(),w.ctx,w.bucket,OWN);
  assert.equal(hit.status,200);assert.equal(hit.headers.get('X-Tile-Source'),'r2');assert.match(hit.headers.get('Cache-Control')??'',/immutable/);
  const sea=await mapTile(ask('z=2&p=0&x=51&y=50'),w.ctx,w.bucket,OWN);await w.settle();
  assert.equal(sea.status,404);assert.equal(sea.headers.get('Cache-Control'),'public, max-age=86400');
  assert.equal(w.fetched(),0,'never GitHub');assert.equal(w.objects.size,2,'nothing written to R2');
  assert.equal(w.store.size,2,'both answers are kept at the edge');
  w.objects.clear();
  assert.equal((await mapTile(ask(),w.ctx,w.bucket,OWN)).status,200,'the edge cache answers a repeat view');
 }finally{w.restore();}
});
test('our own tiles: an R2 failure or a missing bucket is a 502 that is never cached, never open sea',async()=>{
 const w=world(()=>new Response(PNG));
 try{
  const broken={get:async()=>{throw Error('R2 down');},put:async()=>undefined};
  const r=await mapTile(ask(),w.ctx,broken,OWN);await w.settle();
  assert.equal(r.status,502);assert.equal(r.headers.get('Cache-Control'),'no-store');assert.equal(w.store.size,0);
  assert.equal((await mapTile(ask(),undefined,undefined,OWN)).status,502,'the app route fallback has no bucket');
  assert.equal(w.fetched(),0);
 }finally{w.restore();}
});
test('the edge cache keeps each version apart, so a switch never serves the old copy',async()=>{
 const w=world(()=>new Response(PNG));
 try{
  await mapTile(ask(),w.ctx,w.bucket,MEJRS_TILES);await w.settle();// a Mejrs tile, now at the edge and in R2
  const own=await mapTile(ask(),w.ctx,w.bucket,OWN);
  assert.equal(own.status,404,'our copy has no such tile yet; the Mejrs one is not served in its place');
  assert.ok([...w.store.keys()].every(k=>/[?&]v=(mejrs-master|spooned-2026-11-01)$/.test(k)));
 }finally{w.restore();}
});
test('tile versions, addresses and the map credit',async()=>{
 assert.equal(TILE_VERSION,'spooned-maps-2026-11-03','production serves our own per-map render since 1.0.0');
 assert.ok(isTileVersion(OWN));assert.ok(isTileVersion(MEJRS_TILES));
 for(const bad of ['','spooned-','Spooned-2026','spooned-../x','mejrs','spooned-a/b'])assert.ok(!isTileVersion(bad),bad);
 await assert.rejects(()=>mapTile(ask(),undefined,undefined,'spooned-../x'));
 assert.equal(tileUrl(2,0,50,50,OWN),'/api/map-tile?z=2&p=0&x=50&y=50&v=spooned-2026-11-01');
 assert.deepEqual(tileKey(new URL('https://x'+tileUrl(2,1,50,51,MEJRS_TILES)),MEJRS_TILES),{z:2,p:1,x:50,y:51},'the version in the address is ignored by the route');
 assert.match(mapAttribution(MEJRS_TILES),/Mejrs/);assert.match(mapAttribution(OWN),/Spooned OSRS.*RuneLite.*Jagex/);assert.doesNotMatch(mapAttribution(OWN),/Mejrs/);
});

const MAPS='spooned-maps-2026-11-07';
test('a version drawn per world map reads <version>/<mapId>/…, and only with a valid map id',async()=>{
 const key=(q:string,v=MAPS)=>tileKey(new URL('https://x/api/map-tile?'+q),v);
 assert.ok(hasMaps(MAPS));assert.ok(!hasMaps(OWN));assert.ok(!hasMaps(MEJRS_TILES));
 assert.deepEqual(key('z=2&p=0&x=50&y=50&m=3'),{z:2,p:0,x:50,y:50,m:3});
 assert.deepEqual(key('z=2&p=0&x=50&y=50&m=-1'),{z:2,p:0,x:50,y:50,m:-1},'the areas no map of the game shows');
 for(const m of ['','x','-2','4096','1.5','../1','99999'])assert.equal(key('z=2&p=0&x=50&y=50&m='+m),null,m);
 assert.equal(key('z=2&p=0&x=50&y=50'),null,'a map version needs the map');
 assert.equal(key('z=2&p=0&x=50&y=50&m=0',OWN),null,'a single sheet takes no map');
 assert.equal(key('z=2&p=0&x=50&y=50&m=0',MEJRS_TILES),null);
 assert.equal(tileObjectKey({z:2,p:1,x:50,y:51,m:3},MAPS),`${MAPS}/3/2/1_50_51.png`);
 assert.equal(tileUrl(2,0,50,50,MAPS,3),`/api/map-tile?z=2&p=0&x=50&y=50&m=3&v=${MAPS}`);
 assert.equal(tileUrl(2,0,50,50,MAPS),`/api/map-tile?z=2&p=0&x=50&y=50&m=0&v=${MAPS}`,'the surface when no map is named');
 assert.equal(tileUrl(2,0,50,50,OWN,3),'/api/map-tile?z=2&p=0&x=50&y=50&v=spooned-2026-11-01','a sheet never names a map');
 const w=world(()=>new Response(PNG));
 try{
  w.objects.set(`${MAPS}/3/2/0_50_50.png`,PNG.buffer);
  assert.equal((await mapTile(ask('z=2&p=0&x=50&y=50&m=3'),w.ctx,w.bucket,MAPS)).status,200);
  assert.equal((await mapTile(ask('z=2&p=0&x=50&y=50&m=4'),w.ctx,w.bucket,MAPS)).status,404,'another map has nothing there');
  assert.equal((await mapTile(ask('z=2&p=0&x=50&y=50&m=zz'),w.ctx,w.bucket,MAPS)).status,400);
  await w.settle();
  assert.ok([...w.store.keys()].some(k=>k.includes('&m=3&v=')),'the edge cache keeps maps apart');
  assert.equal(w.fetched(),0);
 }finally{w.restore();}
});
