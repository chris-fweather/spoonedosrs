import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {seal,SESSION_COOKIE} from '../lib/session.ts';
import {startWorker} from './worker-harness.mjs';
const {origin:base,secret,fetch,sql,dispose}=await startWorker();
const name='QA '+Date.now().toString().slice(-8),rsn=name.toLowerCase(),id='98000'+Date.now();
async function png(path,headers){const r=await fetch(base+path,{headers});assert.equal(r.status,200,path);assert.match(r.headers.get('content-type'),/image\/png/);const b=Buffer.from(await r.arrayBuffer());assert.equal(b.readUInt32BE(0),0x89504e47);assert.equal(b.readUInt32BE(16),1200);assert.equal(b.readUInt32BE(20),630);assert.ok(b.length>10000);return {b,cache:r.headers.get('cache-control')};}
// The site's own preview is a static image (cheap however many crawlers arrive); player pages keep a drawn card.
for(const path of ['/','/player/Obifloat']){const r=await fetch(base+path,{headers:{'User-Agent':'Discordbot/2.0'}});assert.equal(r.status,200);const html=await r.text();assert.match(html,path==='/'?/property="og:image" content="https:\/\/spoonedosrs.com\/brand\/og-share.jpg"/:/property="og:image" content="https:\/\/spoonedosrs.com\/api\/share/);assert.match(html,/name="twitter:card" content="summary_large_image"/);if(path.includes('player'))assert.match(html,/username=Obifloat/);}
{const r=await fetch(base+'/brand/og-share.jpg');assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/jpeg/);const b=Buffer.from(await r.arrayBuffer());assert.ok(b.length>10000&&b.length<300000,'site share image size');}
await png('/api/share');await png('/api/share?username=Obifloat');
assert.equal((await fetch(base+'/api/share?username=%3Cbad%3E')).status,400);
const journal=JSON.parse(readFileSync('lib/seed.json','utf8'));journal.username=name;
await sql('INSERT INTO users(discord_id,username,updated_at) VALUES(?,?,0)',[id,name]);
try{
 await sql('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,0)',[rsn,name,id]);
 await sql('INSERT INTO journals(id,data,revision) VALUES(?,?,0)',[rsn,JSON.stringify(journal)]);
 const path='/api/share?username='+encodeURIComponent(name);
 const staticImage=readFileSync('public/brand/og-share.jpg');
 const token=await seal(secret,{id,username:'QA',globalName:null,avatar:null,exp:Math.floor(Date.now()/1000)+300});
 const owner={Cookie:`${SESSION_COOKIE}=${token}`};
 // A public profile gets a drawn card; asking twice fills the shared cache.
 const publicCard=await png(path);await png(path);
 assert.equal(publicCard.cache,'no-store');
 // Going private takes effect on the very next request: the static site image, no player data, never a cached card.
 await sql("INSERT INTO profile_visibility(rsn,visibility) VALUES(?,'private')",[rsn]);
 async function fallback(headers){const r=await fetch(base+path,{headers});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/image\/jpeg/);assert.equal(r.headers.get('cache-control'),'no-store');return Buffer.from(await r.arrayBuffer());}
 const anonymous=await fallback(),asOwner=await fallback(owner);
 assert.ok(anonymous.equals(staticImage),'a private profile gets the static site image');
 assert.ok(asOwner.equals(anonymous),'Owner cookies must not disclose extra information in share images');
 assert.ok(!anonymous.equals(publicCard.b),'the cached public card is not served after going private');
 // A staff hide is the same private flag, so it behaves the same. Going public again brings the drawn card back.
 await sql("UPDATE profile_visibility SET visibility='public' WHERE rsn=?",[rsn]);
 const again=await png(path);assert.ok(!again.b.equals(staticImage),'a public profile gets its drawn card again');
 console.log('PASS: Discord metadata, valid 1200x630 PNGs, invalid-name validation, private profiles get the static image on the very next request, owner-cookie isolation.');
}finally{for(const table of ['profile_visibility','claimed_names'])await sql(`DELETE FROM ${table} WHERE rsn=?`,[rsn]);await sql('DELETE FROM journals WHERE id=?',[rsn]);await sql('DELETE FROM users WHERE discord_id=?',[id]);}
await dispose();
