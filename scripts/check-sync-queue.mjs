// The sync queue against the production build, with a real local queue the Worker consumes (lib/sync-queue.ts):
// "Refresh all" answers at once with the Hiscores and `sync_queued` (never a queue position), the paced sources land
// through the consumer, a source with nothing for the name is finished without saving, and the same source is never
// queued twice.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seal,SESSION_COOKIE} from '../lib/session.ts';
import {startWorker} from './worker-harness.mjs';

const hiscores={skills:[{name:'Overall',level:500,xp:50000000,rank:1},{name:'Attack',level:99,xp:13034431,rank:1}],activities:[]};
const log={obtained:1,total:2,tabs:[{name:'Bosses',pages:[{name:'Vorkath',obtained:1,total:2,items:[{id:21992,name:'Vorki',quantity:1},{id:22006,name:'Skeletal visage',quantity:0}]}]}]};
const profile={accountType:'NORMAL',collectionLog:log,quests:[{id:1,name:'Cook\'s Assistant',points:1,type:'free',state:'finished'}],achievementDiaries:[],combatAchievements:[]};
let releaseRuneProfile;const runeProfileGate=new Promise(resolve=>{releaseRuneProfile=resolve;});
async function outbound(request){
 const url=new URL(request.url);
 if(url.hostname==='secure.runescape.com')return Response.json(hiscores);
 // RuneProfile answers only once the test has seen the sync queued, so the response cannot have waited for it.
 if(url.hostname==='api.runeprofile.com'){await runeProfileGate;return Response.json(profile);}
 if(url.hostname==='templeosrs.com')return new Response(null,{status:404});
 return new Response(null,{status:503});
}
const {origin,secret,fetch,sql,rows,upstream,dispose}=await startWorker({outbound,queue:true});
const name='Queue Tester',rsn=name.toLowerCase(),id='97000'+Date.now();
try{
 await sql('INSERT INTO users(discord_id,username,updated_at) VALUES(?,?,0)',[id,'queue']);
 await sql('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,0)',[rsn,name,id]);
 const journal=JSON.parse(readFileSync('lib/seed.json','utf8'));journal.username=name;journal.log=null;
 await sql('INSERT INTO journals(id,data,revision) VALUES(?,?,1)',[rsn,JSON.stringify(journal)]);
 const token=await seal(secret,{id,username:'queue',globalName:null,avatar:null,exp:Math.floor(Date.now()/1000)+600});
 const owner={Cookie:`${SESSION_COOKIE}=${token}`,Origin:origin,'Content-Type':'application/json'};

 const response=await fetch(origin+'/api/sync',{method:'POST',headers:owner,body:JSON.stringify({source:'all',username:name})});
 const body=await response.json();
 assert.equal(response.status,200,JSON.stringify(body));assert.equal(body.status,'sync_queued');
 assert.deepEqual(Object.fromEntries(body.syncReport.map(r=>[r.source,r.status])),{hiscores:'updated',runeprofile:'queued',temple:'queued',wom:'skipped'});
 assert.equal(body.hiscores.skills.find(s=>s.name==='Attack').xp,13034431,'stats are in the first answer');
 assert.ok(!/position|ahead|in line|place in/i.test(JSON.stringify(body)),'no queue position anywhere');
 const status=async(headers={})=>(await (await fetch(origin+'/api/sync/status?username='+encodeURIComponent(name),{headers})).json()).pending;
 assert.deepEqual(await status(),[],'a claimed name shows its queue only to its owner');

 // Asking again while RuneProfile is still waiting queues nothing twice.
 await sql('UPDATE sync_locks SET next_allowed=0,expires=0 WHERE rsn=?',[rsn]);
 const again=await (await fetch(origin+'/api/sync',{method:'POST',headers:owner,body:JSON.stringify({source:'runeprofile',username:name})})).json();
 assert.equal(again.status,'sync_queued');
 assert.equal((await rows('SELECT COUNT(*) AS n FROM sync_pending WHERE rsn=? AND source=?',[rsn,'runeprofile']))[0].n,1);

 releaseRuneProfile();
 let pending=await status(owner);
 for(let i=0;i<60&&pending.length;i++){await new Promise(r=>setTimeout(r,500));pending=await status(owner);}
 assert.deepEqual(pending,[],'every queued source finished');
 const saved=JSON.parse((await rows('SELECT data FROM journals WHERE id=?',[rsn]))[0].data);
 assert.equal(saved.log?.obtained,1,'RuneProfile landed through the consumer');assert.equal(saved.profile?.quests?.[0]?.state,'finished');
 assert.equal(saved.hiscores.skills.find(s=>s.name==='Attack').xp,13034431,'the Hiscores from the first answer are kept');
 assert.ok(upstream.some(u=>u.includes('templeosrs.com')),'Temple was asked, had nothing, and was finished without saving');
 assert.ok(!('syncReport' in saved),'no sync report stored');
 console.log('PASS: Refresh all answers with Hiscores and sync_queued (no position), RuneProfile lands through the queue consumer, Temple with nothing is finished without saving, and a source is never queued twice.');
}finally{
 for(const table of ['sync_pending','sync_locks','claimed_names'])await sql(`DELETE FROM ${table} WHERE rsn=?`,[rsn]).catch(()=>{});
 await sql('DELETE FROM journals WHERE id=?',[rsn]);await sql('DELETE FROM users WHERE discord_id=?',[id]);
 await dispose();
}
