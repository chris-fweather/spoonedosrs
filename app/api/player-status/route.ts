import {providerFetch,acquireSync} from '@/lib/request-controls';
import {RequestError} from '@/lib/request-body';
import {env} from 'cloudflare:workers';
import {logEvent} from '@/lib/log';
import {enqueueSources} from '@/lib/sync-queue';
import {accountName,db,freshJournal,saveDiscoveredJournal} from '@/lib/storage';
import {ensureAuthTables} from '@/lib/auth';
import {discoverPlayer,type PlayerLookup} from '@/lib/player-lookup';
import type {Journal} from '@/lib/model';
import {hydratePublicJournal,sourcesCheckedAt} from '@/lib/public-journal';

export async function GET(req:Request){
 const value=new URL(req.url).searchParams.get('username');let username:string;
 try{if(!value)throw Error('Enter a RuneScape name.');username=accountName(value);}catch(e){return Response.json({error:(e as Error).message},{status:400,headers:{'Cache-Control':'no-store'}});}
 try{
  await ensureAuthTables();
  const rsn=username.toLowerCase();
  const row=await db().prepare(`SELECT j.data,j.revision,v.visibility,c.discord_id AS claimed,r.discord_id AS reserved FROM journals j
   LEFT JOIN profile_visibility v ON v.rsn=j.id LEFT JOIN claimed_names c ON c.rsn=j.id
   LEFT JOIN profile_link_owners r ON r.rsn=j.id WHERE j.id=?`).bind(rsn)
   .first<{data:string;revision:number;visibility:string|null;claimed:string|null;reserved:string|null}>();
  let journal:Journal|null=null;try{journal=row?{...JSON.parse(row.data),revision:row.revision}:null;}catch{}
  const updated=journal?Math.max(Date.parse(journal.statsSyncedAt??'')||0,Date.parse(journal.logSyncedAt??'')||0):0;
  // Claimed journals refresh only through authenticated sync. Never expose hidden skill data here.
  if(row&&(row.claimed||row.reserved||row.visibility==='private'||Date.now()-updated<300_000)){
   const result:PlayerLookup={username,state:'found',hiscores:'unavailable',runeprofile:'unavailable',skills:[],checkedAt:new Date().toISOString(),persisted:!!updated&&!row.claimed&&!row.reserved&&row.visibility!=='private'};
   return Response.json(result,{headers:{'Cache-Control':'no-store'}});
  }
  const cacheKey=new Request(new URL('/api/player-status?username='+encodeURIComponent(rsn),req.url));
  let cache:Cache|undefined;
  try{cache=await caches.open('spooned-lookup-negative-v3');const negative=await cache.match(cacheKey);if(negative)return Response.json(await negative.json(),{headers:{'Cache-Control':'no-store'}});}catch{ /* Cache failures cannot block valid discovery. */ }
  // Persist only keyed digests, never IP addresses. Existing fresh profiles do not use this budget.
  const ip=req.headers.get('CF-Connecting-IP');
  if(ip&&env.SESSION_SECRET){
   const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
   const window=Math.floor(Date.now()/600_000),digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(window+':'+ip));
   const id=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
   const budget=await db().prepare(`INSERT INTO public_lookup_limits(id,window,count) VALUES(?,?,1)
    ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count<20 RETURNING count`).bind(id,window).first<{count:number}>();
   if(!budget)return Response.json({error:'Too many new player lookups. Please retry in a few minutes.'},{status:429,headers:{'Cache-Control':'no-store','Retry-After':'600'}});
   await db().prepare('DELETE FROM public_lookup_limits WHERE window<?').bind(window-1).run();
  }
  // A new name gets every public source at once; an unclaimed journal (compact or an older full one) repeats
  // that at most daily (TempleOSRS allows one request every 12.5 seconds site-wide) and otherwise refreshes
  // official stats. Claimed, reserved and private journals returned above.
  const allSources=!(Date.now()-Date.parse(sourcesCheckedAt(journal)??'')<86_400_000);
  const release=await acquireSync(username);
  const start=journal?hydratePublicJournal(journal):freshJournal(username);
  // With the sync queue (lib/sync-queue.ts) a full pull answers with the official Hiscores at once and queues the
  // paced sources. A name the Hiscores do not know is still asked of every source here: there is no journal to queue onto.
  const queue=allSources?env.SYNC_QUEUE:undefined;
  let discovery,queuing=false;try{
   discovery=await discoverPlayer(username,start,providerFetch,!queue);
   if(queue){if(discovery.lookup.hiscores==='found')queuing=true;else discovery=await discoverPlayer(username,start,providerFetch,true);}
  }finally{await release();}
  const {lookup,journal:discovered}=discovery;
  logEvent('player-lookup',{rsn,allSources,queued:queuing,state:lookup.state,hiscores:lookup.hiscores,runeprofile:lookup.runeprofile,temple:lookup.temple,wom:lookup.wom});
  const persisted=discovered?await saveDiscoveredJournal(discovered,row?.revision??0,journal,allSources?lookup.checkedAt:undefined):false;
  if(queuing&&persisted){
   await enqueueSources(db(),queue!,rsn,['runeprofile','temple']);
   return Response.json({...lookup,skills:[],persisted,status:'sync_queued'},{headers:{'Cache-Control':'no-store'}});
  }
  if(cache&&lookup.state!=='found'){
   try{await cache.put(cacheKey,Response.json({...lookup,skills:[],persisted:false},{headers:{'Cache-Control':`public, max-age=${lookup.state==='not_found'?60:15}`}}));}catch{}
  }
  // Source data is served through /api/journal, which rechecks privacy if a claim raced this lookup.
  return Response.json({...lookup,skills:[],persisted},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof RequestError?e.message:'Public data could not be loaded. Please retry.'},{status:e instanceof RequestError?e.status:503,headers:{'Cache-Control':'no-store',...(e instanceof RequestError&&e.retryAfter?{'Retry-After':String(e.retryAfter)}:{})}});}
}
