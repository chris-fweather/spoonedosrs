// Local, disposable fixtures; never run against production.
import assert from 'node:assert/strict';
import {seal,SESSION_COOKIE} from '../lib/session.ts';
import {startWorker} from './worker-harness.mjs';
const w=await startWorker();
const cookie=async id=>({Origin:w.origin,Cookie:`${SESSION_COOKIE}=${await seal(w.secret,{id,username:'Supporter QA',globalName:null,avatar:null,exp:Math.floor(Date.now()/1000)+300})}`});
const board=async()=>(await (await w.fetch(w.origin+'/api/leaderboard?metric=supporters&page=0')).json()).rows.map(r=>r.name);
const post=async(id,path,body,status=200)=>{const r=await w.fetch(w.origin+path,{method:'POST',headers:{...await cookie(id),'Content-Type':'application/json'},body:JSON.stringify(body)});const text=await r.text();assert.equal(r.status,status,text);return JSON.parse(text);};
const mine=async id=>(await (await w.fetch(w.origin+'/api/account-settings/donations',{headers:await cookie(id)})).json()).donations;
const profile=async name=>(await (await w.fetch(w.origin+'/api/profile?username='+encodeURIComponent(name))).json());
try{
 const alice='90000000000000001',bob='90000000000000002',owner='90000000000000009';
 for(const [id,name] of [[alice,'Alice QA'],[bob,'Bob QA'],[owner,'Owner QA']])await w.sql('INSERT INTO users(discord_id,username,updated_at) VALUES(?,?,0)',[id,name]);
 await w.sql("INSERT INTO staff_members(discord_id,role,revision) VALUES(?,'owner','t'),(?,'helper','t')",[owner,bob]);
 for(const [rsn,id,at] of [['alice main',alice,1],['alice alt',alice,2],['bob main',bob,3]])await w.sql('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,?)',[rsn,rsn.replace(/\b\w/g,c=>c.toUpperCase()),id,at]);

 // Only the owner records donations; helpers and anonymous visitors cannot.
 const record=(body,status)=>post(owner,'/api/staff/donations',{action:'record',currency:'USD',...body},status);
 await post(bob,'/api/staff/donations',{action:'record',amountMinor:500,currency:'USD',target:'Bob Main',donor:'Bob Main'},403);
 // A signed-in donor's donation supports the one profile chosen for it, not every linked name.
 await record({amountMinor:5000,target:'Alice Alt',donor:'Alice Main'});
 assert.deepEqual(await board(),['Alice Alt']);
 const settings=await (await w.fetch(w.origin+'/api/account-settings',{headers:await cookie(alice)})).json();
 assert.deepEqual(settings.accounts.map(a=>[a.name,a.supported]),[['Alice Alt',true],['Alice Main',false]]);

 // A gift to someone else's profile: Bob is a supporter, and Alice cannot move the gift away from him.
 await record({amountMinor:1000,target:'Bob Main',donor:'Alice Main'});
 assert.deepEqual(await board(),['Alice Alt','Bob Main']);
 const gifts=await mine(alice);
 const gift=gifts.find(d=>d.target==='Bob Main'),own=gifts.find(d=>d.target==='Alice Alt');
 assert.equal(gift.movable,false);assert.equal(own.movable,true);
 await post(alice,'/api/account-settings/donations',{action:'move',id:gift.id,to:'Alice Main'},403);
 await post(bob,'/api/account-settings/donations',{action:'move',id:own.id,to:'Bob Main'},403);
 // The donor moves their own donation to another of their names.
 await post(alice,'/api/account-settings/donations',{action:'move',id:own.id,to:'Alice Main'});
 assert.deepEqual(await board(),['Alice Main','Bob Main']);
 // The recipient can hide a gift: no supporter status, no board place, no amount.
 await post(bob,'/api/account-settings',{username:'Bob Main',visibility:'public',details:{},showDonation:true,showSupporter:false});
 assert.deepEqual(await board(),['Alice Main']);
 const hidden=await profile('Bob Main');
 assert.equal(hidden.supporter,false);assert.equal(hidden.donation.amountMinor,null);

 // Anonymous donations get public numbers in order and a claim code shown once.
 const first=(await record({amountMinor:300,target:null,anonymous:true})).recorded;
 const second=(await record({amountMinor:700,target:'Alice Main',anonymous:true})).recorded;
 assert.equal(first.label,'Anonymous #0001');assert.equal(second.label,'Anonymous #0002');
 assert.match(first.claimCode,/^CLM(-[0-9A-Z]{4}){4}$/);
 const ledger=await (await w.fetch(w.origin+'/api/staff/donations',{headers:await cookie(owner)})).json();
 assert.ok(!JSON.stringify(ledger).includes(first.claimCode.slice(4)),'the ledger never shows a claim code');
 const stored=await w.sql('SELECT claim_hash FROM donations WHERE anonymous_number=1');
 assert.ok(!JSON.stringify(stored).includes(first.claimCode.slice(4)),'only the hash is stored');
 // The code alone claims: a malformed code, a well-formed code nobody was given and a spent code all get the same answer.
 const refused=async(id,code)=>(await post(id,'/api/account-settings/donations',{action:'claim',code},403)).error;
 const generic=await refused(bob,'nope');
 assert.equal(await refused(bob,'CLM-0000-0000-0000-0000'),generic);
 const mineNow=await post(bob,'/api/account-settings/donations',{action:'claim',code:first.claimCode.toLowerCase()});
 assert.equal(mineNow.label,'Anonymous #0001');
 // Claimed once: the code is spent, and says so no differently from a wrong one. The public number proves nothing.
 assert.equal(await refused(alice,first.claimCode),generic);
 assert.equal((await post(alice,'/api/account-settings/donations',{action:'claim',number:'2',code:''},403)).error,generic);
 const claimed=(await mine(bob)).find(d=>d.label==='Anonymous #0001');
 assert.equal(claimed.target,null);assert.equal(claimed.movable,true);
 await post(bob,'/api/account-settings/donations',{action:'move',id:claimed.id,to:'Bob Main'});
 // Claiming picks which of your names an unassigned donation supports; one already given to a profile stays there.
 const third=(await record({amountMinor:400,target:null,anonymous:true})).recorded;
 await post(alice,'/api/account-settings/donations',{action:'claim',code:third.claimCode,to:'Bob Main'},403);
 const toAlt=await post(alice,'/api/account-settings/donations',{action:'claim',code:third.claimCode,to:'Alice Alt'});
 assert.equal(toAlt.supports,'Alice Alt');assert.equal(toAlt.label,'Anonymous #0003');
 assert.equal((await mine(alice)).find(d=>d.label==='Anonymous #0003').target,'Alice Alt');
 const kept=await post(bob,'/api/account-settings/donations',{action:'claim',code:second.claimCode,to:'Bob Main'});
 assert.equal(kept.supports,'Alice Main');
 // Checkout: any valid RuneScape name, tracked here yet or not, or none; a malformed name is refused.
 const checkout=async(target,status)=>{const r=await w.fetch(w.origin+'/api/donations/checkout',{method:'POST',headers:{...await cookie(alice),'Content-Type':'application/json'},body:JSON.stringify({target,amountMinor:500})});assert.equal(r.status,status);return r.json();};
 assert.equal((await checkout('Alice Alt',503)).choice.tracked,true);
 const untracked=await checkout('Not Here Yet',503);
 assert.deepEqual([untracked.choice.target,untracked.choice.tracked],['not here yet',false]);
 assert.equal((await checkout(null,503)).choice.target,null);
 await checkout('bad<name>',400);await checkout('thirteen chars',400);await checkout('   ',503);
 // Leaving a supporter choice out of a privacy save keeps it; each profile reports its own total.
 await post(bob,'/api/account-settings',{username:'Bob Main',visibility:'public',details:{}});
 const bobSettings=await (await w.fetch(w.origin+'/api/account-settings',{headers:await cookie(bob)})).json();
 assert.deepEqual(bobSettings.accounts.map(a=>[a.name,a.showSupporter,a.showDonation,a.amountMinor]),[['Bob Main',false,true,1300]]);

 // A refund stops counting: Alice Main keeps the anonymous $7 only.
 const aliceDonation=(await mine(alice)).find(d=>d.target==='Alice Main');
 await post(owner,'/api/staff/donations',{action:'refund',id:aliceDonation.id});
 const total=await w.sql("SELECT amount_minor FROM profile_supporter_totals WHERE rsn='alice main'");
 assert.equal(JSON.stringify(total).includes('700'),true);

 // Cross-origin writes are refused.
 const cross=await w.fetch(w.origin+'/api/account-settings/donations',{method:'POST',headers:{...await cookie(alice),Origin:'https://example.invalid','Content-Type':'application/json'},body:JSON.stringify({action:'move',id:own.id,to:'Alice Alt'})});
 assert.equal(cross.status,403);
 console.log('PASS supporters: per-profile flair, gifts stay put, own moves, hidden gifts, anonymous numbers, one-time claim codes (code alone), any-name checkout, refunds, owner-only ledger');
}finally{await w.dispose();}
