import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {authorGuideThumbs,findGuide,isGuideVisibility,listGuides,setGuideThumb,GUIDE_PUBLIC,type GuideDatabase} from './guide-access';
import {CREDIT_GUIDES_SQL} from './credits';
import {reputationSummary} from './reputation';

const dir=new URL('../drizzle/',import.meta.url);
/** The real schema (every migration in order) behind a D1-shaped wrapper. Discord IDs are made up. */
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 for(const file of readdirSync(dir).filter(f=>/^\d{4}_.+\.sql$/.test(f)).sort())sql.exec(readFileSync(new URL(file,dir),'utf8'));
 const database:GuideDatabase={prepare(query:string){
  let values:unknown[]=[];
  const statement={bind(...v:unknown[]){values=v;return statement;},
   async first<T>(){return (sql.prepare(query).get(...values as never[])??null) as T|null;},
   async all<T>(){return {results:sql.prepare(query).all(...values as never[]) as T[]};},
   async run(){return sql.prepare(query).run(...values as never[]);}};
  return statement;
 }};
 const OWNER='200000000000000001',HELPER='200000000000000002',PLAYER='200000000000000003',OTHER='200000000000000004';
 for(const id of [OWNER,HELPER,PLAYER,OTHER])sql.prepare('INSERT INTO users(discord_id,username,updated_at) VALUES(?,?,0)').run(id,'user-'+id);
 sql.prepare("INSERT INTO staff_members(discord_id,role,revision) VALUES(?,'owner','r'),(?,'helper','r')").run(OWNER,HELPER);
 sql.prepare("INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES('quill fake','Quill Fake',?,1)").run(OWNER);
 const guide=(id:string,visibility:'public'|'staff',published=true)=>sql.prepare("INSERT INTO community_guides(id,author_id,title,draft,published,updated_at,published_at,visibility) VALUES(?,?,?,?,?,'2026-01-01',?,?)")
  .run(id,OWNER,id,JSON.stringify({title:id,activity:'Kraken'}),published?JSON.stringify({title:id,activity:'Kraken'}):null,published?'2026-01-0'+(id.length%9+1):null,visibility);
 guide('open','public');guide('howto','staff');guide('draft','public',false);
 return {sql,database,OWNER,HELPER,PLAYER,OTHER};
}

test('visibility is public or staff, and the column refuses anything else',()=>{
 assert.equal(isGuideVisibility('public'),true);assert.equal(isGuideVisibility('staff'),true);assert.equal(isGuideVisibility('Staff'),false);assert.equal(isGuideVisibility(null),false);
 const x=setup();try{
  assert.equal(x.sql.prepare("SELECT visibility FROM community_guides WHERE id='open'").get()?.visibility,'public');
  assert.throws(()=>x.sql.prepare("UPDATE community_guides SET visibility='hidden' WHERE id='open'").run());
 }finally{x.sql.close();}
});

test('staff-only guides are listed and found for staff of any rank only; drafts for nobody',async()=>{
 const x=setup();try{
  const ids=async(viewer:string|null)=>(await listGuides(x.database,viewer)).map(g=>g.id).sort();
  assert.deepEqual(await ids(null),['open']);
  assert.deepEqual(await ids(x.PLAYER),['open']);
  assert.deepEqual(await ids(x.HELPER),['howto','open']);
  assert.deepEqual(await ids(x.OWNER),['howto','open']);
  // A viewer ID of '' never matches a staff row, even a malformed one.
  x.sql.prepare("INSERT INTO users(discord_id,username,updated_at) VALUES('','blank',0)").run();x.sql.prepare("INSERT INTO staff_members(discord_id,role,revision) VALUES('','helper','r')").run();
  assert.deepEqual(await ids(null),['open']);
  assert.equal(await findGuide(x.database,null,'howto'),null);
  assert.equal(await findGuide(x.database,x.PLAYER,'howto'),null);
  assert.equal((await findGuide(x.database,x.HELPER,'howto'))?.visibility,'staff');
  assert.equal(await findGuide(x.database,x.OWNER,'draft'),null);
  assert.equal(await findGuide(x.database,x.OWNER,'missing'),null);
  // A staff member who loses their rank stops seeing it at once.
  x.sql.prepare('DELETE FROM staff_members WHERE discord_id=?').run(x.HELPER);
  assert.equal(await findGuide(x.database,x.HELPER,'howto'),null);
  // Places that never know the viewer (Credits, Squire) only ever see public guides.
  assert.deepEqual(x.sql.prepare(`SELECT id FROM community_guides g WHERE ${GUIDE_PUBLIC}`).all().map(r=>r.id),['open']);
  assert.deepEqual(x.sql.prepare(CREDIT_GUIDES_SQL).all().map(r=>r.id),['open']);
 }finally{x.sql.close();}
});

test('one thumbs up per person per guide; taking it back removes only theirs',async()=>{
 const x=setup();try{
  assert.deepEqual(await setGuideThumb(x.database,x.PLAYER,'open',true),{thumbs:1,thumbed:true});
  assert.deepEqual(await setGuideThumb(x.database,x.PLAYER,'open',true),{thumbs:1,thumbed:true});
  assert.deepEqual(await setGuideThumb(x.database,x.OTHER,'open',true),{thumbs:2,thumbed:true});
  // Authors may give their own guide one.
  assert.deepEqual(await setGuideThumb(x.database,x.OWNER,'open',true),{thumbs:3,thumbed:true});
  assert.deepEqual(await setGuideThumb(x.database,x.PLAYER,'open',false),{thumbs:2,thumbed:false});
  assert.deepEqual(await setGuideThumb(x.database,x.PLAYER,'open',false),{thumbs:2,thumbed:false});
  const seen=(await listGuides(x.database,x.OTHER)).find(g=>g.id==='open');assert.equal(seen?.thumbs,2);assert.equal(seen?.thumbed,true);
  const anon=(await listGuides(x.database,null)).find(g=>g.id==='open');assert.equal(anon?.thumbs,2);assert.equal(anon?.thumbed,false);
  // Signed out, hidden, unpublished or missing: no thumbs up, and the same "not found" answer.
  assert.equal(await setGuideThumb(x.database,'','open',true),null);
  assert.equal(await setGuideThumb(x.database,x.PLAYER,'howto',true),null);
  assert.equal(await setGuideThumb(x.database,x.OWNER,'draft',true),null);
  assert.equal(await setGuideThumb(x.database,x.OWNER,'missing',true),null);
  assert.equal(x.sql.prepare("SELECT COUNT(*) AS n FROM guide_thumbs WHERE guide_id IN ('howto','draft')").get()?.n,0);
  assert.throws(()=>x.sql.prepare("INSERT INTO guide_thumbs(guide_id,voter_id,created_at) VALUES('open',?,'x')").run(x.OTHER),'primary key');
  // Staff thumb a staff-only guide; its count only reaches staff, because only staff are sent the guide.
  assert.deepEqual(await setGuideThumb(x.database,x.HELPER,'howto',true),{thumbs:1,thumbed:true});
  assert.equal((await listGuides(x.database,x.PLAYER)).some(g=>g.id==='howto'),false);
 }finally{x.sql.close();}
});

test("an author's profile counts thumbs on their published guides, staff-only ones included",async()=>{
 const x=setup();try{
  assert.equal(await authorGuideThumbs(x.database,'quill fake'),0);
  await setGuideThumb(x.database,x.PLAYER,'open',true);await setGuideThumb(x.database,x.OTHER,'open',true);
  await setGuideThumb(x.database,x.HELPER,'howto',true);
  assert.equal(await authorGuideThumbs(x.database,'quill fake'),3);
  assert.equal(await authorGuideThumbs(x.database,'nobody linked'),0);
  // Unpublishing hides a guide's thumbs from the total until it is published again.
  x.sql.prepare("UPDATE community_guides SET published=NULL WHERE id='howto'").run();
  assert.equal(await authorGuideThumbs(x.database,'quill fake'),2);
  // A guide removed for good takes its thumbs with it.
  x.sql.prepare("DELETE FROM community_guides WHERE id='open'").run();
  assert.equal(x.sql.prepare('SELECT COUNT(*) AS n FROM guide_thumbs').get()?.n,1);
  assert.equal(reputationSummary({count:16,guideCount:4}),'16 respect · 4 from guides');
  assert.equal(reputationSummary({count:12,guideCount:0}),'12 respect');
  assert.equal(reputationSummary({count:1200,guideCount:4},n=>n.toLocaleString('en-GB')),'1,200 respect · 4 from guides');
 }finally{x.sql.close();}
});
