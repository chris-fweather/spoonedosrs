import {HttpError} from '@/lib/auth';
import {publicGuide,publicGuides} from '@/lib/guide-store';
/** Signed-out visitors all get the same list (public guides only), so it may be cached briefly. A signed-in reader's list
 * holds their own thumbs up and, for staff, staff-only guides: no shared cache ever stores it. */
const cacheFor=(signedIn:boolean)=>({'Cache-Control':signedIn?'private, no-store':'public, max-age=30',Vary:'Cookie'});
/** The guides this visitor may read, or one of them with ?guide=<id> (404 when it is missing or hidden from them). */
export async function GET(req:Request){
 const id=new URL(req.url).searchParams.get('guide');
 try{const body=id!==null?await publicGuide(req,id):await publicGuides(req);return Response.json(body,{headers:cacheFor(body.viewer.signedIn)});}
 catch(e){return Response.json({error:e instanceof HttpError?e.message:'Guides are temporarily unavailable.'},{status:e instanceof HttpError?e.status:503,headers:{'Cache-Control':'no-store',Vary:'Cookie'}});}
}
