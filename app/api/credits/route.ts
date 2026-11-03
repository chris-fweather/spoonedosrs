import {db} from '@/lib/storage';
import {cachedCreditsPeople,loadCreditsPeople,CREDITS_MAX_AGE} from '@/lib/credits';

/** Public names only (guide writers, staff, retired staff), cached for ten minutes so a busy page costs three queries. */
export async function GET(req:Request){
 try{
  let cache:Cache|null=null;
  try{cache=await caches.open('spooned-credits-v1');}catch{/* no Cache API: load directly */}
  const people=await cachedCreditsPeople(()=>loadCreditsPeople(db()),cache,new URL('/api/credits',req.url).toString());
  return Response.json(people,{headers:{'Cache-Control':`public, max-age=${CREDITS_MAX_AGE}`}});
 }catch{
  return Response.json({error:'Credits are unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}
