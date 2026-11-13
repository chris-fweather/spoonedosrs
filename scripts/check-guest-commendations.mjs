import assert from 'node:assert/strict';
import {seal,SESSION_COOKIE} from '../lib/session.ts';
import {startWorker} from './worker-harness.mjs';
const {origin:base,secret,fetch,sql,dispose}=await startWorker();
const stamp=Date.now().toString(),name='GC '+stamp.slice(-8),rsn=name.toLowerCase(),name2='GD '+stamp.slice(-8),rsn2=name2.toLowerCase(),user='967'+stamp,other='968'+stamp;
const net='2001:db8:'+stamp.slice(-4)+'::',ip=net+'1',ip2=net+'2',ip3=net+'3',ip4=net+'4';
async function call(method,identity=null,address=ip,origin=base,player=name){const h={Origin:origin,'CF-Connecting-IP':address};if(identity)h.Cookie=SESSION_COOKIE+'='+await seal(secret,{id:identity,username:'QA',globalName:null,avatar:null,exp:Math.floor(Date.now()/1000)+300});const r=await fetch(base+'/api/reputation?username='+encodeURIComponent(player),{method,headers:h});const text=await r.text();let body;try{body=JSON.parse(text);}catch{body={error:text};}return {status:r.status,body,retry:r.headers.get('retry-after')};}
try{
 for(const id of [user,other])await sql('INSERT INTO users(discord_id,username,updated_at) VALUES(?,?,0)',[id,'Guest commend QA']);
 for(const [id,display] of [[rsn,name],[rsn2,name2]])await sql('INSERT INTO journals(id,data,revision) VALUES(?,?,0)',[id,JSON.stringify({username:display})]);
 assert.equal((await call('PUT',null,ip,'https://example.invalid')).status,403);
 const first=await call('PUT');assert.equal(first.status,200);assert.equal(first.body.count,1);assert.equal(first.body.given,true);assert.equal(first.body.signedIn,false);
 const attempts=await Promise.all(Array.from({length:4},()=>call('PUT')));assert.ok(attempts.every(r=>r.body.count===1));
 const attached=await call('PUT',user);assert.equal(attached.body.count,1);
 const shared=await call('PUT',other);assert.equal(shared.body.count,1);assert.equal(shared.body.networkUsed,true);assert.equal(shared.body.given,false);
 assert.equal((await call('DELETE',other)).body.count,1);
 assert.equal((await call('PUT',user,ip2)).body.count,1);
 assert.equal((await call('PUT',null,ip2)).body.count,2);
 assert.equal((await call('DELETE',null,ip2)).body.count,1);
 assert.equal((await call('DELETE',user)).body.count,0);
 // Self-commendation: once on each of your own linked names, under the usual limits.
 for(const [id,display] of [[rsn,name],[rsn2,name2]])await sql('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,0)',[id,display,user]);
 const self=await call('PUT',user,ip3);assert.equal(self.status,200);assert.equal(self.body.ownProfile,true);assert.equal(self.body.given,true);assert.equal(self.body.count,1);
 const repeats=await Promise.all(Array.from({length:3},()=>call('PUT',user,ip3)));assert.ok(repeats.every(r=>r.status===200&&r.body.count===1));
 const elsewhere=await call('PUT',user,ip4);assert.equal(elsewhere.body.count,1);assert.equal(elsewhere.body.given,true);
 const sameNetwork=await call('PUT',null,ip3);assert.equal(sameNetwork.body.count,1);assert.equal(sameNetwork.body.networkUsed,true);assert.equal(sameNetwork.body.ownProfile,false);
 assert.equal((await call('GET',other,ip2)).body.ownProfile,false);
 const second=await call('PUT',user,ip4,base,name2);assert.equal(second.status,200);assert.equal(second.body.count,1);assert.equal(second.body.ownProfile,true);
 assert.equal((await call('PUT',user,ip3,base,name2)).body.count,1);
 assert.equal((await call('DELETE',user,ip4)).body.count,0);
 assert.equal((await call('PUT',user,ip4)).body.count,1);
 let limited;for(let i=0;i<22;i++){limited=await call('PUT');if(limited.status===429)break;}
 assert.equal(limited.status,429);assert.equal(limited.retry,'600');
 const stored=await sql('SELECT ip_key FROM profile_commendations WHERE rsn IN (?,?)',[rsn,rsn2]);assert.ok(stored.every(r=>/^[0-9a-f]{64}$/.test(r[0])));
 console.log('PASS guest vote, concurrent deduplication, login continuity, same-network limit, account limit, safe undo, one self-commendation per own linked name, cross-origin denial, hashed IP and rate limiting.');
}finally{for(const id of [rsn,rsn2]){await sql('DELETE FROM profile_commendations WHERE rsn=?',[id]);await sql('DELETE FROM claimed_names WHERE rsn=?',[id]);await sql('DELETE FROM journals WHERE id=?',[id]);}for(const id of [user,other])await sql('DELETE FROM users WHERE discord_id=?',[id]);}
await dispose();
