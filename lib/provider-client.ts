import {RequestError} from './request-body';

/** Read quotas are shared by the whole app, never multiplied by player count.
 * Temple's 5/min is conservative updater guidance pending an agreed read quota.
 * The Hiscores allowance is our safeguard, not a published entitlement.
 *
 * `gap` is each lane's minimum time between calls. Lanes in the same `group` also share the group's gap, so their
 * total stays under the provider's published limit. `keyed` applies when we hold that provider's API key.
 */
const policies = {
  temple: {label:'TempleOSRS', gap:12_500, ttl:300_000},
  runeprofile: {label:'RuneProfile', gap:2_100, ttl:60_000},
  wom: {label:'Wise Old Man', gap:4_000, ttl:300_000, group:'wom', keyed:{gap:1_000}},
  // Dated skill achievements change rarely: a slower lane and a long cache keep WOM's shared limit for snapshots.
  womAchievements: {label:'Wise Old Man', gap:12_000, ttl:21_600_000, group:'wom', keyed:{gap:3_000}},
  hiscores: {label:'OSRS Hiscores', gap:1_100, ttl:60_000},
} as const;
/** Wise Old Man allows 20 requests a minute without an API key and 100 with one (docs.wiseoldman.net/api).
 * Both WOM lanes share one slot that keeps us at 18 and 90 a minute, a 10% margin. */
const groups = {
  wom: {gap:3_334, keyed:{gap:667}},
} as const;
type Group=keyof typeof groups;
/** Backoff after a 429/503 that names no wait: 1, 2, 4, 8 minutes, capped at 15, plus up to 20% jitter. */
export function backoffDelay(strikes:number, random=Math.random) {
  const base=Math.min(15*60_000,60_000*2**Math.max(0,strikes-1));
  return Math.ceil(base*(1+0.2*random()));
}
export function providerPolicy(url:URL) {
  if(url.protocol!=='https:' || url.username || url.password || url.port)throw new RequestError(400,'Unsupported import source.');
  let provider:keyof typeof policies;
  if(url.hostname==='templeosrs.com' && url.pathname==='/api/collection-log/player_collection_log.php')provider='temple';
  else if(url.hostname==='api.runeprofile.com' && /^\/v1\/accounts\/[^/]+\/full$/.test(url.pathname))provider='runeprofile';
  else if(url.hostname==='api.wiseoldman.net' && /^\/v2\/players\/[^/]+$/.test(url.pathname))provider='wom';
  else if(url.hostname==='api.wiseoldman.net' && /^\/v2\/players\/[^/]+\/achievements$/.test(url.pathname))provider='womAchievements';
  else if(url.hostname==='secure.runescape.com' && url.pathname==='/m=hiscore_oldschool/index_lite.json')provider='hiscores';
  else throw new RequestError(400,'Unsupported import source.');
  url.hash='';url.searchParams.sort();
  const policy:{label:string;gap:number;ttl:number;group?:Group;keyed?:{gap:number}}=policies[provider];
  return {provider,...policy};
}

/** Respect both seconds and HTTP-date Retry-After; never shorten a provider's wait. */
export function retryDelay(headers:Headers, now:number, fallback=60_000) {
  const value=headers.get('Retry-After');
  if(value!==null){
    const ms=/^\d+(\.\d+)?$/.test(value.trim())?Number(value)*1000:Date.parse(value)-now;
    if(Number.isFinite(ms) && ms>=0)return Math.max(1000,Math.ceil(ms));
  }
  const reset=headers.get('RateLimit-Reset');
  if(reset!==null && /^\d+(\.\d+)?$/.test(reset.trim()))return Math.max(fallback,Math.ceil(Number(reset)*1000));
  return fallback;
}

type Value=string|number|ArrayBuffer;
export interface ProviderStatement {
  bind(...values:Value[]):ProviderStatement;
  first<T>():Promise<T|null>;
  run():Promise<unknown>;
}
export interface ProviderDatabase {prepare(sql:string):ProviderStatement}
type Cached={status:number;content_type:string;body:ArrayBuffer|number[]|null;fetched_at:number;expires_at:number};
/** `apiKeys` holds keys we own for a provider group (never a caller's): sent upstream, never cached or logged. */
type Options={database:ProviderDatabase;key:(url:string)=>Promise<string>;dailyBudget:()=>Promise<void>;fetcher?:typeof fetch;now?:()=>number;paused?:boolean;apiKeys?:Partial<Record<Group,string>>;random?:()=>number};
const MAX_BYTES=1_800_000;

async function boundedBody(response:Response) {
  const reader=response.body?.getReader();
  if(!reader)return new ArrayBuffer(0);
  const chunks:Uint8Array[]=[];let size=0;
  try{
    for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>MAX_BYTES){await reader.cancel();throw new RequestError(502,'Provider response is too large.');}chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return bytes.buffer;
}

/** D1 coordinates cache fills and pacing across Worker instances/regions.
 * A busy slot fails quickly with Retry-After instead of holding user requests open.
 * Only public GETs are accepted; auth/cookies and arbitrary update endpoints cannot pass.
 */
export function createProviderClient(options:Options):typeof fetch {
  const {database,key,dailyBudget}=options;
  const clock=options.now??Date.now,fetcher=options.fetcher??fetch;
  return async(input,init)=>{
    const request=new Request(input,init),url=new URL(request.url),policy=providerPolicy(url);
    if(request.method!=='GET' || request.headers.has('Authorization') || request.headers.has('Cookie') || request.headers.has('X-API-Key'))throw new RequestError(400,'Only public read requests are supported.');
    const id=await key(url.href),now=clock();
    const cached=await database.prepare('SELECT status,content_type,body,fetched_at,expires_at FROM provider_responses WHERE id=?').bind(id).first<Cached>();
    const serve=(row:Cached)=>new Response(row.status===404?null:new Uint8Array(row.body??[]),{status:row.status,headers:{'Content-Type':row.content_type,'Cache-Control':'no-store','X-Spooned-Cache':'hit','X-Source-Fetched-At':new Date(row.fetched_at).toISOString()}});
    if(cached && cached.expires_at>now && (cached.status===200||cached.status===404))return serve(cached);
    if(options.paused)throw new RequestError(503,'Imports are temporarily paused. Saved profiles remain available.',300);
    request.signal.throwIfAborted();
    const token=crypto.randomUUID();
    const lease=await database.prepare(`INSERT INTO provider_responses(id,token,lease_until) VALUES(?,?,?)
      ON CONFLICT(id) DO UPDATE SET token=excluded.token,lease_until=excluded.lease_until
      WHERE provider_responses.lease_until<=? AND provider_responses.expires_at<=? RETURNING id`).bind(id,token,now+30_000,now,now).first();
    if(!lease){
      const fresh=await database.prepare('SELECT status,content_type,body,fetched_at,expires_at FROM provider_responses WHERE id=?').bind(id).first<Cached>();
      if(fresh && fresh.expires_at>clock() && (fresh.status===200||fresh.status===404))return serve(fresh);
      throw new RequestError(429,`${policy.label} data is already being fetched. Please retry shortly.`,2);
    }
    try{
      // Single atomic slot per lane: fixed minute boundaries cannot create a double burst. A grouped lane is taken only
      // while the group's shared slot is free, then the shared slot is taken, so the group's total never runs over and a
      // busy lane never wastes the group's turn. (If two lanes race between those steps, the loser only waits a lane gap.)
      const gateTime=clock(),apiKey=policy.group?options.apiKeys?.[policy.group]:undefined;
      const groupSlot=policy.group?'group:'+policy.group:null;
      const busy=async(slots:string[])=>{
        let next=gateTime+1000;
        for(const slot of slots){const gate=await database.prepare('SELECT next_at FROM provider_pacing WHERE provider=?').bind(slot).first<{next_at:number}>();if(gate&&gate.next_at>gateTime)next=Math.max(next,gate.next_at);}
        return new RequestError(429,`${policy.label} refreshes are busy. Your saved progress is unchanged.`,Math.max(1,Math.ceil((next-clock())/1000)));
      };
      const laneGap=apiKey&&policy.keyed?policy.keyed.gap:policy.gap;
      const lane=await database.prepare(`INSERT INTO provider_pacing(provider,next_at) SELECT ?,? WHERE COALESCE((SELECT next_at FROM provider_pacing WHERE provider=?),0)<=?
        ON CONFLICT(provider) DO UPDATE SET next_at=excluded.next_at WHERE provider_pacing.next_at<=? RETURNING next_at`).bind(policy.provider,gateTime+laneGap,groupSlot??policy.provider,gateTime,gateTime).first();
      if(!lane)throw await busy(groupSlot?[groupSlot,policy.provider]:[policy.provider]);
      if(policy.group&&groupSlot){
        const groupGap=apiKey?groups[policy.group].keyed.gap:groups[policy.group].gap;
        const shared=await database.prepare(`INSERT INTO provider_pacing(provider,next_at) VALUES(?,?)
          ON CONFLICT(provider) DO UPDATE SET next_at=excluded.next_at WHERE provider_pacing.next_at<=? RETURNING next_at`).bind(groupSlot,gateTime+groupGap,gateTime).first();
        if(!shared)throw await busy([groupSlot]);
      }
      // A provider's "slow down" applies to every lane that shares its allowance.
      const backoffSlot=groupSlot??policy.provider;
      await dailyBudget();
      await database.prepare('DELETE FROM provider_responses WHERE expires_at<=? AND lease_until<=?').bind(gateTime,gateTime).run();
      // Workers reject redirect:'error' with a TypeError. 'manual' returns any 3xx
      // unfollowed, and the status check below treats it as unavailable.
      const response=await fetcher(url.href,{method:'GET',redirect:'manual',headers:{Accept:'application/json','User-Agent':'SpoonedOSRS/1.0 (https://spoonedosrs.com; Discord: snooked)',...(apiKey?{'x-api-key':apiKey}:{})},signal:AbortSignal.any([request.signal,AbortSignal.timeout(15_000)])});
      const received=clock();
      const exhausted=response.headers.get('RateLimit-Remaining')==='0';
      const refused=response.status===429 || response.status===503;
      if(refused || exhausted){
        let fallback=60_000;
        if(refused){
          // Count consecutive refusals; with no Retry-After, each one waits longer.
          const row=await database.prepare(`INSERT INTO provider_pacing(provider,next_at,strikes) VALUES(?,0,1)
            ON CONFLICT(provider) DO UPDATE SET strikes=provider_pacing.strikes+1 RETURNING strikes`).bind(backoffSlot).first<{strikes:number}>();
          fallback=backoffDelay(row?.strikes??1,options.random);
        }
        const wait=retryDelay(response.headers,received,fallback);
        for(const slot of new Set([backoffSlot,policy.provider]))await database.prepare(`INSERT INTO provider_pacing(provider,next_at) VALUES(?,?) ON CONFLICT(provider) DO UPDATE SET next_at=MAX(provider_pacing.next_at,excluded.next_at)`).bind(slot,received+wait).run();
        if(refused){await response.body?.cancel();throw new RequestError(429,`${policy.label} has asked us to wait before refreshing. Your saved progress is unchanged.`,Math.ceil(wait/1000));}
      }
      // A good answer ends any backoff run (a no-op write when there was none).
      if(response.status===200 || response.status===404)await database.prepare('UPDATE provider_pacing SET strikes=0 WHERE provider=? AND strikes>0').bind(backoffSlot).run();
      if(response.status!==200 && response.status!==404){await response.body?.cancel();return new Response(null,{status:response.status,headers:{'Cache-Control':'no-store'}});}
      const body=response.status===404?new ArrayBuffer(0):await boundedBody(response);
      if(response.status===404)await response.body?.cancel();
      const type='application/json';
      if(response.status===200){
        try{JSON.parse(new TextDecoder().decode(body));}catch{throw new RequestError(502,'Provider returned invalid data.');}
      }
      // Do not persist private/no-store responses or upstream cookies.
      const noStore=/\b(no-store|private)\b/i.test(response.headers.get('Cache-Control')??'') || response.headers.has('Set-Cookie');
      const ttl=response.status===404?60_000:policy.ttl;
      if(!noStore)await database.prepare(`UPDATE provider_responses SET status=?,content_type=?,body=?,fetched_at=?,expires_at=? WHERE id=? AND token=?`).bind(response.status,type,body,received,received+ttl,id,token).run();
      return new Response(response.status===404?null:body,{status:response.status,headers:{'Content-Type':type,'Cache-Control':'no-store','X-Spooned-Cache':'miss','X-Source-Fetched-At':new Date(received).toISOString()}});
    }finally{await database.prepare('UPDATE provider_responses SET lease_until=0 WHERE id=? AND token=?').bind(id,token).run();}
  };
}
