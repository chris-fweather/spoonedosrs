import {db} from '@/lib/storage';
import {cachedPluginStats,countPluginStats,PLUGIN_STATS_MAX_AGE} from '@/lib/plugin-stats';

/** Public counters for the plugin page (counts only), cached for ten minutes so a busy page costs one query. */
export async function GET(req:Request){
 try{
  let cache:Cache|null=null;
  try{cache=await caches.open('spooned-plugin-stats-v1');}catch{/* no Cache API: count directly */}
  const stats=await cachedPluginStats(()=>countPluginStats(db()),cache,new URL('/api/plugin/stats',req.url).toString());
  return Response.json(stats,{headers:{'Cache-Control':`public, max-age=${PLUGIN_STATS_MAX_AGE}`}});
 }catch{
  return Response.json({error:'Plugin stats are unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
