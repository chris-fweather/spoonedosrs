// Staff-only guides and guide thumbs up, against the production build. Local, disposable fixtures; never run against production.
import assert from 'node:assert/strict';
import {seal,SESSION_COOKIE} from '../lib/session.ts';
import {initial} from '../lib/model.ts';
import {emptyGuide} from '../lib/guides.ts';
import {startWorker} from './worker-harness.mjs';
const {origin:base,secret,fetch,sql,dispose}=await startWorker();
const suffix=Date.now(),moderator='981'+suffix,helper='982'+suffix,player='983'+suffix,other='984'+suffix;
const name='GV '+String(suffix).slice(-8),rsn=name.toLowerCase();
async function cookie(id){return SESSION_COOKIE+'='+await seal(secret,{id,username:'Guide QA',globalName:null,avatar:null,exp:Math.floor(Date.now()/1000)+300});}
async function headers(id,origin=base){const h={'Content-Type':'application/json',Origin:origin,'CF-Connecting-IP':'2001:db8::'+String(suffix).slice(-4)};if(id)h.Cookie=await cookie(id);return h;}
async function call(path,{method='GET',as=null,body,origin}={}){const r=await fetch(base+path,{method,headers:await headers(as,origin),body:body&&JSON.stringify(body)});const text=await r.text();let json;try{json=JSON.parse(text);}catch{json={error:text};}return {status:r.status,body:json,cache:r.headers.get('cache-control')};}
async function staffPost(body,as,status=200){const r=await call('/api/staff/guides',{method:'POST',as,body});assert.equal(r.status,status,JSON.stringify(r.body));return r.body;}
const listed=async as=>(await call('/api/guides',{as})).body.guides.map(g=>g.id);
const thumb=(id,as,method='PUT',origin)=>call('/api/guides/thumbs?guide='+encodeURIComponent(id),{method,as,origin});
const respect=async()=>(await call('/api/reputation?username='+encodeURIComponent(name))).body;
let id,publicId;
try{
 for(const [user,role] of [[moderator,'moderator'],[helper,'helper'],[player,null],[other,null]]){
  await sql('INSERT INTO users(discord_id,username,updated_at) VALUES(?,?,0)',[user,'Guide QA']);
  if(role)await sql('INSERT INTO staff_members(discord_id,role,revision) VALUES(?,?,?)',[user,role,'test']);
 }
 // The moderator writes both guides and has a linked profile, where guide thumbs up add to their respect.
 const journal=structuredClone(initial);journal.username=name;
 await sql('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,0)',[rsn,name,moderator]);
 await sql('INSERT INTO journals(id,data,revision) VALUES(?,?,0)',[rsn,JSON.stringify(journal)]);
 const guide=title=>({...emptyGuide(),title,activity:'Kraken',summary:'Disposable guide fixture for visibility checks.',strategy:'This is a local-only fixture for the visibility checks.'});
 id=(await staffPost({action:'save',guide:guide('How to write a guide '+suffix)},moderator)).id;
 publicId=(await staffPost({action:'save',guide:guide('Public guide '+suffix)},moderator)).id;
 const row=async(gid,as=moderator)=>(await call('/api/staff/guides',{as})).body.guides.find(g=>g.id===gid);
 assert.equal((await row(id)).visibility,'public');
 // Only staff who may publish choose who can read it; helpers (no publish) and players cannot.
 await staffPost({action:'visibility',id,revision:(await row(id)).revision,visibility:'staff'},helper,403);
 await staffPost({action:'visibility',id,revision:(await row(id)).revision,visibility:'staff'},player,403);
 await staffPost({action:'visibility',id,revision:(await row(id)).revision,visibility:'secret'},moderator,400);
 await staffPost({action:'visibility',id,revision:(await row(id)).revision-1,visibility:'staff'},moderator,409);
 await staffPost({action:'visibility',id,revision:(await row(id)).revision,visibility:'staff'},moderator);
 assert.equal((await row(id)).visibility,'staff');
 for(const gid of [id,publicId])await staffPost({action:'publish',id:gid,revision:(await row(gid)).revision},moderator);
 // Hidden from signed-out visitors and players: not listed, not counted, and 404 (not 403) when asked for by ID.
 for(const as of [null,player]){
  const list=await listed(as);assert.ok(list.includes(publicId));assert.ok(!list.includes(id));
  assert.equal((await call('/api/guides?guide='+encodeURIComponent(id),{as})).status,404);
  assert.equal((await call('/api/guides?guide=no-such-guide',{as})).status,404);
  assert.equal((await thumb(id,as)).status,as?404:401);
 }
 const anonymous=await call('/api/guides');assert.equal(anonymous.cache,'public, max-age=30');
 // Staff of any rank see it, tagged; their list is never stored by a shared cache.
 for(const as of [helper,moderator]){
  const r=await call('/api/guides',{as});assert.equal(r.cache,'private, no-store');assert.equal(r.body.viewer.staff,true);
  assert.equal(r.body.guides.find(g=>g.id===id)?.visibility,'staff');assert.equal(r.body.guides.find(g=>g.id===publicId)?.visibility,'public');
  assert.equal((await call('/api/guides?guide='+encodeURIComponent(id),{as})).body.guide.id,id);
 }
 // Losing staff access hides it again at once.
 await sql('DELETE FROM staff_members WHERE discord_id=?',[helper]);
 assert.ok(!(await listed(helper)).includes(id));
 await sql('INSERT INTO staff_members(discord_id,role,revision) VALUES(?,?,?)',[helper,'helper','test']);
 // Credits never list a staff-only guide.
 const credits=(await call('/api/credits')).body;assert.ok(!JSON.stringify(credits).includes('How to write a guide'));

 // Thumbs up: signed in only, from the guide's own site, one per person, and they can be taken back.
 assert.equal((await thumb(publicId,null)).status,401);
 assert.equal((await thumb(publicId,player,'PUT','https://example.invalid')).status,403);
 assert.equal((await respect()).count,0);
 assert.deepEqual((await thumb(publicId,player)).body,{thumbs:1,thumbed:true});
 assert.deepEqual((await thumb(publicId,player)).body,{thumbs:1,thumbed:true});
 const together=await Promise.all([thumb(publicId,other),thumb(publicId,other)]);assert.ok(together.every(r=>r.status===200&&r.body.thumbs===2));
 assert.deepEqual((await thumb(publicId,moderator)).body,{thumbs:3,thumbed:true},'authors may thumb their own guide');
 assert.deepEqual((await thumb(publicId,player,'DELETE')).body,{thumbs:2,thumbed:false});
 const mine=(await call('/api/guides',{as:other})).body.guides.find(g=>g.id===publicId);assert.equal(mine.thumbs,2);assert.equal(mine.thumbed,true);
 assert.equal((await call('/api/guides')).body.guides.find(g=>g.id===publicId).thumbed,false);
 // A staff-only guide takes thumbs from staff; only staff see its count, but it still adds to the author's respect.
 assert.deepEqual((await thumb(id,helper)).body,{thumbs:1,thumbed:true});
 let rep=await respect();assert.equal(rep.guideCount,3);assert.equal(rep.count,3);
 // Profile respect from a visitor adds to the same total, shown with the part from guides.
 const voted=await call('/api/reputation?username='+encodeURIComponent(name),{method:'PUT'});assert.equal(voted.status,200,JSON.stringify(voted.body));
 rep=await respect();assert.equal(rep.count,4);assert.equal(rep.guideCount,3);
 await thumb(id,helper,'DELETE');rep=await respect();assert.equal(rep.count,3);assert.equal(rep.guideCount,2);
 // Thumbs changes are rate limited like commendations.
 let limited;for(let i=0;i<25;i++){limited=await thumb(publicId,player,i%2?'DELETE':'PUT');if(limited.status===429)break;}
 assert.equal(limited.status,429);assert.equal(limited.cache,'no-store');
 // Back to public: everyone can read it again.
 await staffPost({action:'visibility',id,revision:(await row(id)).revision,visibility:'public'},moderator);
 assert.ok((await listed(null)).includes(id));
 assert.equal((await call('/api/guides?guide='+encodeURIComponent(id))).status,200);
 const audit=await sql("SELECT detail FROM staff_audit WHERE target_id=? AND action='guide-visibility' ORDER BY id",[id]);
 assert.deepEqual(audit.map(r=>r[0].endsWith('Staff only')?'staff':'public'),['staff','public']);
 console.log('PASS: staff-only guides 404 and stay unlisted for anonymous visitors and players, appear tagged for staff of any rank, leave Credits, and need publish access to change; thumbs up need sign-in and the same site, are one per person (authors included), toggle off, are rate limited, and add to the author\'s profile respect, staff-only guides included.');
}finally{
 for(const gid of [id,publicId].filter(Boolean)){await sql('DELETE FROM guide_thumbs WHERE guide_id=?',[gid]);await sql('DELETE FROM community_guides WHERE id=?',[gid]);await sql('DELETE FROM staff_audit WHERE target_id=?',[gid]);}
 await sql('DELETE FROM profile_commendations WHERE rsn=?',[rsn]);await sql('DELETE FROM claimed_names WHERE rsn=?',[rsn]);await sql('DELETE FROM journals WHERE id=?',[rsn]);
 for(const user of [moderator,helper,player,other]){await sql('DELETE FROM staff_members WHERE discord_id=?',[user]);await sql('DELETE FROM users WHERE discord_id=?',[user]);}
}
await dispose();
