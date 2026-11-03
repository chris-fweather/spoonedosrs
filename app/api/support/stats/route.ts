import {db} from '@/lib/storage';
import {cachedSupportStats,countSupportStats,SUPPORT_STATS_MAX_AGE} from '@/lib/support-stats';

/** Public counter for the Support page (a count only), cached for ten minutes so a busy page costs one query. */
export async function GET(req:Request){
 try{
  let cache:Cache|null=null;
  try{cache=await caches.open('spooned-support-stats-v1');}catch{/* no Cache API: count directly */}
  const stats=await cachedSupportStats(()=>countSupportStats(db()),cache,new URL('/api/support/stats',req.url).toString());
  return Response.json(stats,{headers:{'Cache-Control':`public, max-age=${SUPPORT_STATS_MAX_AGE}`}});
 }catch{
  return Response.json({error:'Support stats are unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
