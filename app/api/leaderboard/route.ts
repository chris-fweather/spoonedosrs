import {db} from '@/lib/storage';
import {cachedBoard} from '@/lib/board-response-cache';
import {boardPage,communityTotals,homeBoard} from '@/lib/board-page';
import {RequestError} from '@/lib/request-body';
/** How long a board answer is shared through the Cache API (per Cloudflare location, across Worker instances), so a burst of
 * visitors costs one set of board queries. The key carries the board version, so any change (a sync, a profile made
 * private, a staff hide) is shown at once; between changes every visitor shares the stored answer. Browsers get no-store. */
const EDGE_SECONDS=60;
const edgeKey=(version:number,params:URLSearchParams)=>new Request(`https://spoonedosrs.com/api/leaderboard?edge=${version}&`+params.toString());
async function edgeCache(){try{return await caches.open('spooned-board-v1');}catch{return null;}}
export async function GET(request:Request){
 try{
  const started=performance.now(),params=new URL(request.url).searchParams;
  if(params.toString().length>300)throw new RequestError(400,'Invalid leaderboard filter.');
  params.sort();
  const revision=await db().prepare('SELECT version FROM board_revision WHERE id=1').first<{version:number}>();
  const cache=await edgeCache(),key=edgeKey(revision!.version,params);
  const stored=cache&&await cache.match(key).catch(()=>undefined);
  if(stored)return new Response(stored.body,{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Server-Timing':`board;dur=${(performance.now()-started).toFixed(1)}, boardcache;desc="edge"`}});
  const result=await cachedBoard(revision!.version,params.toString(),async()=>{if(!params.has('metric'))return homeBoard();const [page,totals]=await Promise.all([boardPage(params),communityTotals()]);return {...page,totals};});
  if(cache)await cache.put(key,new Response(result.data,{headers:{'Content-Type':'application/json','Cache-Control':`public, max-age=${EDGE_SECONDS}`}})).catch(()=>{});
  return new Response(result.data,{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Server-Timing':`board;dur=${(performance.now()-started).toFixed(1)}, boardcache;desc="${result.hit?'hit':'miss'}"`}});
 }catch(e){return Response.json({error:e instanceof RequestError?e.message:'The leaderboard could not be loaded.'},{status:e instanceof RequestError?e.status:503,headers:{'Cache-Control':'no-store'}});}
}
