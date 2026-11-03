// RuneLite plugin tokens, characters, sync and link reviews, against a throwaway Worker (scripts/worker-harness.mjs). Never run this against production.
import assert from 'node:assert/strict';
import {seal,SESSION_COOKIE} from '../lib/session.ts';
import {startWorker} from './worker-harness.mjs';
const {origin:base,secret,fetch,sql,rows,dispose}=await startWorker();
const stamp=String(Date.now()),owner='968'+stamp,other='969'+stamp,admin='967'+stamp,rsn='pl'+stamp.slice(-8);
const cookie=async id=>`${SESSION_COOKIE}=${await seal(secret,{id,username:'Plugin QA '+id.slice(0,3),globalName:null,avatar:null,exp:Math.floor(Date.now()/1000)+300,v:0})}`;
const site=(path,c,init={})=>fetch(base+path,{...init,headers:{Cookie:c,Origin:base,'Content-Type':'application/json',...init.headers}});
const json=async(r,status=200)=>{const text=await r.text();assert.equal(r.status,status,text);return JSON.parse(text);};
const sync=(token,body)=>fetch(base+'/api/plugin/sync',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
const body=(events=[])=>({plugin:{version:'0.1.0',manifest:1},character:{name:rsn,account:'b'.repeat(64),accountType:1},sections:['skills','log','pets'],
 skills:{Attack:13034431},collectionLog:{uniqueObtained:1,uniqueTotal:1717,complete:false,items:{'12922':1}},varbits:{'4768':312},events});
const bodyAs=name=>({...body(),character:{name,account:'b'.repeat(64),accountType:1}});
const rsn2='pm'+stamp.slice(-8),rsn3='pn'+stamp.slice(-8);
const bindings=async()=>(await rows('SELECT discord_id,rsn,rsn_at_binding FROM plugin_account_owners WHERE discord_id IN (?,?)',[owner,other])).map(r=>({...r}));
const pet={id:'evt-'+stamp,type:'PET',occurredAt:Date.now(),localDate:new Date().toISOString().slice(0,10),name:'Pet snakeling',detail:'FOLLOWING',skills:{},killCounts:{zulrah:500}};
const characters=async c=>(await json(await site('/api/plugin/characters',c))).characters;
const notices=async c=>(await json(await site('/api/notifications',c))).notifications;
try{
 for(const [id,name] of [[owner,'Plugin owner'],[other,'Plugin other'],[admin,'Plugin admin']])await sql('INSERT INTO users(discord_id,username,updated_at) VALUES(?,?,0)',[id,name]);
 await sql("INSERT INTO staff_members(discord_id,role,prefix,revision) VALUES(?,'admin',NULL,?)",[admin,'test-'+admin]);
 const a=await cookie(owner),b=await cookie(other),staff=await cookie(admin);

 // Tokens: only from the Account page, shown once, stored as a hash, short and forgiving to paste.
 assert.equal((await fetch(base+'/api/plugin/tokens',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'})).status,401,'anonymous create');
 assert.equal((await fetch(base+'/api/plugin/tokens',{method:'POST',headers:{Cookie:a,'Content-Type':'application/json'},body:'{}'})).status,403,'origin-less create');
 assert.equal((await site('/api/plugin/tokens',a,{method:'POST',headers:{Origin:'https://invalid.example'},body:'{}'})).status,403,'cross-origin create');
 const created=await json(await site('/api/plugin/tokens',a,{method:'POST',body:JSON.stringify({label:'Gaming PC'})}));
 assert.match(created.token,/^SPN(-[0-9A-HJKMNP-TV-Z]{4}){4}$/);
 const loose=created.token.toLowerCase().replaceAll('-',' ');
 const listed=await json(await site('/api/plugin/tokens',a));
 assert.deepEqual(listed.tokens.map(t=>t.label),['Gaming PC']);
 assert.ok(!JSON.stringify(listed).includes(created.token),'the token is never listed again');
 assert.ok((await json(await fetch(base+'/api/plugin/manifest'))).pets.some(p=>p.name==='Abyssal protector'));
 const otherToken=(await json(await site('/api/plugin/tokens',b,{method:'POST',body:'{}'}))).token;

 assert.equal((await json(await fetch(base+'/api/plugin/manifest'))).collectionEntryScript,4100);
 assert.equal((await sync(null,body())).status,401,'no token');
 assert.equal((await sync('SPN-0000-0000-0000-0000',body())).status,401,'unknown token');
 assert.equal((await sync('not a token',body())).status,401,'malformed token');

 // Nothing is linked automatically: the character is remembered and the player adds it.
 const first=await json(await sync(loose,body([pet])),409);
 assert.equal(first.code,'add_character');
 assert.equal((await rows('SELECT COUNT(*) AS n FROM claimed_names WHERE rsn=?',[rsn])).at(0).n,0,'not linked by a sync');
 assert.deepEqual((await characters(a)).map(c=>[c.name,c.status]),[[rsn,'can_add']]);
 assert.equal((await site('/api/plugin/characters',b,{method:'POST',body:JSON.stringify({name:rsn,action:'add'})})).status,403,'cannot add a character your plugin never saw');
 assert.equal((await json(await site('/api/plugin/characters',a,{method:'POST',body:JSON.stringify({name:rsn,action:'add'})}))).status,'linked');
 assert.equal((await rows('SELECT discord_id FROM claimed_names WHERE rsn=?',[rsn])).at(0)?.discord_id,owner);
 assert.deepEqual(await bindings(),[{discord_id:owner,rsn,rsn_at_binding:rsn}],'adding through the plugin binds the game account to its owner');

 // Once added, the sync saves the queued pet, unconfirmed, with KC, skills and account type.
 const saved=await json(await sync(loose,body([pet])));
 assert.deepEqual(saved.acceptedEvents,[pet.id]);
 const journal=JSON.parse((await rows('SELECT data FROM journals WHERE id=?',[rsn])).at(0).data);
 const snakeling=journal.pets.find(p=>p.id==='12921');
 assert.equal(snakeling.obtained,true);assert.equal(snakeling.obtainedCount,500);assert.equal(snakeling.unconfirmed,true);
 assert.equal(journal.hiscores.skills.find(s=>s.name==='Attack').level,99);
 assert.equal(journal.accountMode,'ironman');
 assert.equal((await rows('SELECT COUNT(*) AS n FROM plugin_accounts WHERE account_key=?',['b'.repeat(64)])).at(0).n,0,'the raw account key is never stored');
 const card=await json(await fetch(base+'/api/plugin/profile?username='+encodeURIComponent(rsn)));
 assert.equal(card.pets.find(p=>p.id===12921).obtained,true,'the plugin profile shows the synced pet');
 assert.equal(card.pets.find(p=>p.name==='Pet Penance Queen').currentLine,'Current: 312 gambles','the gamble count reaches the Penance Queen hover');
 assert.equal(card.accountMode,'ironman');
 assert.ok(!JSON.stringify(card).includes(owner),'no Discord IDs in the plugin profile');
 const again=await sync(created.token,body());
 assert.equal(again.status,429);assert.ok(Number(again.headers.get('retry-after'))>0);

 // Another player who logs in to the same character is refused and can ask for a review; nothing opens by itself.
 assert.equal((await json(await sync(otherToken,body()),409)).code,'claimed_elsewhere');
 assert.equal((await rows('SELECT COUNT(*) AS n FROM staff_cases WHERE rsn=?',[rsn])).at(0).n,0,'no case without a request');
 assert.deepEqual((await characters(b)).map(c=>c.status),['claimed_elsewhere']);
 assert.equal((await site('/api/plugin/characters',b,{method:'POST',body:JSON.stringify({name:rsn,action:'add'})})).status,409,'cannot add a name someone else holds');
 for(let i=0;i<2;i++)assert.equal((await json(await site('/api/plugin/characters',b,{method:'POST',body:JSON.stringify({name:rsn,action:'review'})}))).status,'review_pending');
 const cases=await rows("SELECT id,target_id,state,creator_id FROM staff_cases WHERE rsn=? AND action='relink'",[rsn]);
 assert.deepEqual(cases.map(({target_id,state,creator_id})=>({target_id,state,creator_id})),[{target_id:other,state:'pending',creator_id:'runelite-plugin'}],'exactly one pending case');
 assert.equal((await json(await sync(otherToken,body()),409)).code,'review_pending');
 assert.equal((await rows('SELECT discord_id FROM claimed_names WHERE rsn=?',[rsn])).at(0).discord_id,owner,'the first owner keeps the name');

 // Both people are told, without seeing each other's Discord account; notices can be dismissed.
 const ownerNotice=(await notices(a)).find(n=>n.kind==='link_review_requested');
 assert.ok(ownerNotice,'the current owner is told');
 assert.deepEqual((await notices(b)).map(n=>n.kind),['link_review_opened'],'the requester is told');
 assert.ok(!JSON.stringify(await notices(a)).includes(other)&&!JSON.stringify(await notices(b)).includes(owner),'no Discord IDs in notices');
 assert.equal((await site('/api/notifications',b,{method:'DELETE',body:JSON.stringify({id:ownerNotice.id})})).status,200);
 assert.ok((await notices(a)).some(n=>n.id===ownerNotice.id),'one player cannot dismiss another\'s notice');
 await json(await site('/api/notifications',a,{method:'DELETE',body:JSON.stringify({id:ownerNotice.id})}));
 assert.ok(!(await notices(a)).some(n=>n.id===ownerNotice.id));

 // A staff decision tells both people.
 await json(await site('/api/staff/cases',staff,{method:'POST',body:JSON.stringify({action:'review',id:cases[0].id,decision:'rejected',confirmed:true,reason:'Kept with the owner in this isolated test.'})}));
 assert.ok((await notices(a)).some(n=>n.kind==='link_review_rejected'));
 assert.ok((await notices(b)).some(n=>n.kind==='link_review_rejected'));
 assert.deepEqual((await characters(b)).map(c=>c.status),['claimed_elsewhere'],'a rejected request can be made again later');

 // A friend's computer after a name change: the owner's character is refused under its new, unlinked name too, with no Add.
 assert.equal((await json(await sync(otherToken,bodyAs(rsn2)),409)).code,'claimed_elsewhere','a bound character is refused under a new name');
 assert.equal((await characters(b)).find(c=>c.name===rsn2)?.status,'claimed_elsewhere','and is not offered Add');
 assert.equal((await site('/api/plugin/characters',b,{method:'POST',body:JSON.stringify({name:rsn2,action:'add'})})).status,409,'cannot add a character bound to someone else');
 assert.equal((await rows('SELECT COUNT(*) AS n FROM claimed_names WHERE rsn=?',[rsn2])).at(0).n,0);

 // The owner's own rename: the new name shows with Add; adding it links and syncs it, and the binding follows the name.
 const renamed=await json(await sync(loose,bodyAs(rsn2)),409);
 assert.equal(renamed.code,'add_character');assert.match(renamed.error,/new name for a character you verified/);
 assert.deepEqual((await characters(a)).filter(c=>c.name===rsn2).map(c=>[c.status,c.verified]),[['can_add',true]]);
 assert.equal((await json(await site('/api/plugin/characters',a,{method:'POST',body:JSON.stringify({name:rsn2,action:'add'})}))).status,'linked');
 assert.equal((await json(await sync(loose,bodyAs(rsn2)))).profile,rsn2);
 assert.deepEqual(await bindings(),[{discord_id:owner,rsn:rsn2,rsn_at_binding:rsn}]);
 assert.equal((await site('/api/plugin/characters',a,{method:'POST',body:JSON.stringify({name:rsn2,action:'release'})})).status,409,'a linked character cannot be released');

 // A dispute about a bound character under a name nobody links goes to staff; approving moves the binding with the name.
 assert.equal((await json(await sync(otherToken,bodyAs(rsn3)),409)).code,'claimed_elsewhere');
 assert.equal((await json(await site('/api/plugin/characters',b,{method:'POST',body:JSON.stringify({name:rsn3,action:'review'})}))).status,'review_pending');
 const dispute=await rows("SELECT id,source_id,target_id FROM staff_cases WHERE rsn=? AND action='relink' AND state='pending'",[rsn3]);
 assert.deepEqual(dispute.map(({source_id,target_id})=>({source_id,target_id})),[{source_id:owner,target_id:other}],'the verified owner is the other side');
 assert.ok((await notices(a)).some(n=>n.kind==='link_review_requested'),'the verified owner is told');
 await json(await site('/api/staff/cases',staff,{method:'POST',body:JSON.stringify({action:'review',id:dispute[0].id,decision:'approved',confirmed:true,reason:'Requester proved the game account in this isolated test.'})}));
 assert.equal((await rows('SELECT discord_id FROM claimed_names WHERE rsn=?',[rsn3])).at(0)?.discord_id,other);
 assert.deepEqual(await bindings(),[{discord_id:other,rsn:rsn3,rsn_at_binding:rsn3}],'the binding moves to the approved owner');
 assert.equal((await json(await sync(loose,bodyAs(rsn2)),409)).code,'claimed_elsewhere','the former owner is refused now, even under their linked name');
 assert.equal((await json(await sync(otherToken,bodyAs(rsn3)))).profile,rsn3);

 // Removing a token, or logging out everywhere, disconnects the plugin.
 assert.equal((await site('/api/plugin/tokens',a,{method:'DELETE',body:JSON.stringify({id:created.id})})).status,200);
 assert.equal((await sync(created.token,body())).status,401,'revoked token');
 assert.equal((await fetch(base+'/api/auth/logout-everywhere',{method:'POST',headers:{Cookie:b,Origin:base}})).status,200);
 assert.equal((await sync(otherToken,body())).status,401,'log out everywhere revokes plugin tokens');
 console.log('PASS: plugin-verified characters stay with their owner under a new name and on a friend\'s computer, the owner\'s rename is offered with Add, a dispute moves the binding through staff; short tokens created only from the site, shown once, hashed and forgiving to paste; a sync never links by itself; Add needs the plugin to have seen the character; the pet syncs once added and shows in the plugin profile; one-minute gap; another player is refused, asks for review once, both are notified without Discord IDs and see the staff decision; revoke and log out everywhere disconnect the plugin.');
}finally{
 for(const name of [rsn,rsn2,rsn3]){
  await sql('DELETE FROM notifications WHERE rsn=?',[name]);await sql('DELETE FROM account_actions WHERE rsn=?',[name]);await sql('DELETE FROM staff_cases WHERE rsn=?',[name]);
  await sql('DELETE FROM plugin_events WHERE rsn=?',[name]);await sql('DELETE FROM plugin_accounts WHERE rsn=?',[name]);
  await sql('DELETE FROM journals WHERE id=?',[name]);await sql('DELETE FROM claimed_names WHERE rsn=?',[name]);await sql('DELETE FROM profile_link_owners WHERE rsn=?',[name]);
  await sql('DELETE FROM profile_visibility WHERE rsn=?',[name]);
 }
 await sql('DELETE FROM plugin_account_owners WHERE discord_id IN (?,?)',[owner,other]);
 await sql('DELETE FROM plugin_tokens WHERE discord_id IN (?,?)',[owner,other]);await sql('DELETE FROM staff_members WHERE discord_id=?',[admin]);
 await sql('DELETE FROM journals WHERE id=?',[rsn]);await sql('DELETE FROM claimed_names WHERE rsn=?',[rsn]);await sql('DELETE FROM profile_link_owners WHERE rsn=?',[rsn]);
 await sql('DELETE FROM users WHERE discord_id IN (?,?,?)',[owner,other,admin]);
}
await dispose();
