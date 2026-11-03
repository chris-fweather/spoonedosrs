import {HttpError,readSession} from '@/lib/auth';
import {db,sameOrigin} from '@/lib/storage';
import {requestJson,RequestError} from '@/lib/request-body';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie'};
/** Guide writers and current or former staff are the people the Credits page can list. */
const ELIGIBLE=`(EXISTS(SELECT 1 FROM community_guides WHERE author_id=?1 AND published IS NOT NULL) OR EXISTS(SELECT 1 FROM staff_members WHERE discord_id=?1) OR EXISTS(SELECT 1 FROM staff_audit WHERE target_id=?1 AND action IN ('grant','revoke')))`;
function failure(e:unknown){
 const known=e instanceof HttpError||e instanceof RequestError;
 return Response.json({error:known?e.message:'Account settings are unavailable.'},{status:known?(e as HttpError).status:503,headers});
}
/** Whether the signed-in person can be on the Credits page, and whether they are. */
export async function GET(req:Request){
 try{
  const user=await readSession(req);if(!user)throw new HttpError(401,'Sign in to manage your accounts.');
  const row=await db().prepare(`SELECT credits_listed AS listed,${ELIGIBLE} AS eligible FROM users WHERE discord_id=?1`).bind(user.id).first<{listed:number;eligible:number}>();
  return Response.json({eligible:!!row?.eligible,listed:row?.listed!==0},{headers});
 }catch(e){return failure(e);}
}
/** Shows or hides the signed-in person on the Credits page (the public list refreshes within ten minutes). */
export async function POST(req:Request){
 try{
  try{sameOrigin(req);}catch{throw new HttpError(403,'Use account settings to make changes.');}
  const user=await readSession(req);if(!user)throw new HttpError(401,'Sign in to manage your accounts.');
  const body=await requestJson(req,200);
  if(typeof body.listed!=='boolean')throw new HttpError(400,'Choose whether to show you on the Credits page.');
  await db().prepare('UPDATE users SET credits_listed=?2 WHERE discord_id=?1').bind(user.id,body.listed?1:0).run();
  try{await (await caches.open('spooned-credits-v1')).delete(new URL('/api/credits',req.url).toString());}catch{/* the cached list expires on its own */}
  return Response.json({ok:true,listed:body.listed},{headers});
 }catch(e){return failure(e);}
}
