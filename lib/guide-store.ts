import {env} from 'cloudflare:workers';
import {HttpError,readSession} from './auth';
import {db,sameOrigin} from './storage';
import {areaGuard,requireStaffArea} from './staff-store';
import {publicMessage} from './request-body';
import {parseGuide,mayEditGuide,type Guide} from './guides';
import {publicStaff} from './staff-data';
import {findGuide,isGuideVisibility,listGuides,setGuideThumb,type GuideVisibility} from './guide-access';
/** Rechecked inside each write, so access removed mid-request cannot still save. */
const guides=areaGuard('guides');
type Row={id:string;author_id:string;title:string;draft:string;published:string|null;revision:number;updated_at:string;published_at:string|null;visibility:GuideVisibility};
/** Who is reading: signed in or not, and whether they are staff (who also see staff-only guides). */
async function reader(req:Request){const user=await readSession(req);return {id:user?.id??null,signedIn:!!user,staff:!!user&&!!await publicStaff(user.id)};}
/** The guides this visitor may read (staff-only guides only for signed-in staff), with their thumbs up. */
export async function publicGuides(req:Request){
 const viewer=await reader(req);
 return {guides:await listGuides<Guide>(db(),viewer.id),viewer:{signedIn:viewer.signedIn,staff:viewer.staff}};
}
/** One guide for this visitor. Missing, unpublished and hidden are the same 404, so a staff-only guide's existence never shows. */
export async function publicGuide(req:Request,id:string){
 const viewer=await reader(req),guide=await findGuide<Guide>(db(),viewer.id,id);
 if(!guide)throw new HttpError(404,'Guide not found.');
 return {guide,viewer:{signedIn:viewer.signedIn,staff:viewer.staff}};
}
/** Gives or takes back the signed-in visitor's thumbs up on a guide they can read. Limited like commendations: 20 changes
 * per person per ten minutes, counted in commendation_limits under a keyed hash of the window and the account. */
export async function thumbGuide(req:Request,id:string,on:boolean){
 try{sameOrigin(req);}catch{throw new HttpError(403,'Give a thumbs up from the guide.');}
 const user=await readSession(req);if(!user)throw new HttpError(401,'Sign in with Discord to give a thumbs up.');
 if(!env.SESSION_SECRET)throw new HttpError(503,'Thumbs up are temporarily unavailable.');
 const window=Math.floor(Date.now()/600000),key=await crypto.subtle.importKey('raw',new TextEncoder().encode(env.SESSION_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const budgetKey=Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('guide-thumbs:budget:'+window+':'+user.id))),v=>v.toString(16).padStart(2,'0')).join('');
 const budget=await db().prepare('INSERT INTO commendation_limits(id,window,count) VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count<20 RETURNING count').bind(budgetKey,window).first();
 if(!budget)throw new HttpError(429,'Too many thumbs up changes. Try again in ten minutes.');
 await db().prepare('DELETE FROM commendation_limits WHERE window<?').bind(window-1).run();
 const result=await setGuideThumb(db(),user.id,id,on);
 if(!result)throw new HttpError(404,'Guide not found.');
 return result;
}
export async function guideDashboard(req:Request){const viewer=await requireStaffArea(req,'guides');const rows=await db().prepare('SELECT * FROM community_guides ORDER BY updated_at DESC LIMIT 200').all<Row>();return {viewer:{id:viewer.id,role:viewer.role,canPublish:viewer.permissions.publish,canUpload:!!env.UPLOADS},guides:rows.results.map(r=>({id:r.id,authorId:r.author_id,guide:JSON.parse(r.draft),revision:r.revision,publishedAt:r.published_at,changesPending:r.published!==null&&r.published!==r.draft,visibility:r.visibility??'public',updatedAt:r.updated_at,canEdit:mayEditGuide(viewer.role,viewer.id,r.author_id)}))};}
export async function writeGuide(req:Request,body:Record<string,unknown>){
 try{sameOrigin(req);}catch{throw new HttpError(403,'Use the guide editor to save.');}
 const actor=await requireStaffArea(req,'guides'),database=db(),now=new Date().toISOString();
 const id=typeof body.id==='string'?body.id:'';
 const prior=id?await database.prepare('SELECT * FROM community_guides WHERE id=?').bind(id).first<Row>():null;
 if(id&&!prior)throw new HttpError(404,'Guide not found.');
 if(prior&&body.revision!==prior.revision)throw new HttpError(409,'This guide changed. Reload before saving.');
 if(body.action==='save'){
  if(prior&&!mayEditGuide(actor.role,actor.id,prior.author_id))throw new HttpError(403,'You can edit your own drafts. Admins may maintain other guides.');
  let guide;try{guide=parseGuide(body.guide);}catch(e){throw new HttpError(400,publicMessage(e,'Check the guide fields and try again.'));}
  if(!prior){const key=crypto.randomUUID();const result=await database.prepare(`INSERT INTO community_guides(id,author_id,title,draft,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM staff_members s WHERE ${guides} AND s.discord_id=?)`).bind(key,actor.id,guide.title,JSON.stringify(guide),now,actor.id).run();if(!result.meta.changes)throw new HttpError(409,'Staff access changed. Reload.');return {id:key};}
  const result=await database.prepare(`UPDATE community_guides SET title=?,draft=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM staff_members s WHERE ${guides} AND s.discord_id=? AND s.role=?)`).bind(guide.title,JSON.stringify(guide),now,id,prior.revision,actor.id,actor.role).run();if(!result.meta.changes)throw new HttpError(409,'Guide or staff access changed. Reload.');return {id};
 }
 if(body.action==='publish'||body.action==='unpublish'){
  if(!prior)throw new HttpError(400,'Save the guide before publishing.');
  if(!actor.permissions.publish)throw new HttpError(403,'Your staff access does not include publishing guides.');
  const publish=body.action==='publish';
  const result=await database.batch([
   database.prepare(`UPDATE community_guides SET published=?,published_at=?,publisher_id=?,revision=revision+1 WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM staff_members s WHERE ${guides} AND ${areaGuard('publish')} AND s.discord_id=? AND s.role=?)`).bind(publish?prior.draft:null,publish?now:null,actor.id,id,prior.revision,actor.id,actor.role),
   database.prepare("INSERT INTO staff_audit(actor_id,target_id,action,detail,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM community_guides WHERE id=? AND revision=? AND publisher_id=?)").bind(actor.id,id,publish?'guide-publish':'guide-unpublish',prior.title,now,id,prior.revision+1,actor.id)
  ]);if(!result[0].meta.changes)throw new HttpError(409,'Guide or staff access changed. Reload.');return {id};
 }
 if(body.action==='visibility'){
  // Who may read it: everyone, or signed-in staff only. A publishing choice, so only staff who may publish change it.
  if(!prior)throw new HttpError(400,'Save the guide before choosing who can read it.');
  if(!actor.permissions.publish)throw new HttpError(403,'Your staff access does not include publishing guides.');
  if(!isGuideVisibility(body.visibility))throw new HttpError(400,'Choose Public or Staff only.');
  if(body.visibility===prior.visibility)return {id};
  const result=await database.batch([
   database.prepare(`UPDATE community_guides SET visibility=?,revision=revision+1 WHERE id=? AND revision=? AND EXISTS(SELECT 1 FROM staff_members s WHERE ${guides} AND ${areaGuard('publish')} AND s.discord_id=? AND s.role=?)`).bind(body.visibility,id,prior.revision,actor.id,actor.role),
   database.prepare("INSERT INTO staff_audit(actor_id,target_id,action,detail,created_at) SELECT ?,?,'guide-visibility',?,? WHERE EXISTS(SELECT 1 FROM community_guides WHERE id=? AND revision=? AND visibility=?)").bind(actor.id,id,`${prior.title}: ${body.visibility==='staff'?'Staff only':'Public'}`,now,id,prior.revision+1,body.visibility)
  ]);if(!result[0].meta.changes)throw new HttpError(409,'Guide or staff access changed. Reload.');
  // The Credits page lists public guides from a ten-minute cache; drop it here so a guide made staff-only leaves at once.
  try{await (await caches.open('spooned-credits-v1')).delete(new URL('/api/credits',req.url).toString());}catch{/* no Cache API */}
  return {id};
 }
 throw new HttpError(400,'Unknown guide action.');
}
