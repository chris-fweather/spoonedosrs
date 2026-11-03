import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {cachedCreditsPeople,loadCreditsPeople,rankSteps,CREDITS_MAX_AGE} from './credits';

const dir=new URL('../drizzle/',import.meta.url);
/** The real schema: every migration in order. Discord IDs here are made up and long, so a leak is easy to spot. */
function setup(){
 const sql=new DatabaseSync(':memory:');
 for(const file of readdirSync(dir).filter(f=>/^\d{4}_.+\.sql$/.test(f)).sort())sql.exec(readFileSync(new URL(file,dir),'utf8'));
 const database={prepare(query:string){return {async all<T>(){return {results:sql.prepare(query).all() as T[]};}};}};
 let at=0;
 const user=(id:string,name:string|null,{privateName=false,listed=1}={})=>{
  sql.prepare('INSERT INTO users(discord_id,username,global_name,updated_at,credits_listed) VALUES(?,?,?,0,?)').run(id,'discord-'+id,'Discord '+id,listed);
  if(name){sql.prepare('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,?)').run(name.toLowerCase(),name,id,++at);if(privateName)sql.prepare("INSERT INTO profile_visibility(rsn,visibility) VALUES(?,'private')").run(name.toLowerCase());}
 };
 const staff=(id:string,role:string)=>sql.prepare("INSERT INTO staff_members(discord_id,role,revision) VALUES(?,?,'r')").run(id,role);
 const change=(id:string,from:string|null,to:string|null,when:string)=>sql.prepare('INSERT INTO staff_audit(actor_id,target_id,action,detail,created_at) VALUES(?,?,?,?,?)').run('900000000000000001',id,to?'grant':'revoke',JSON.stringify({from,to}),when);
 const guide=(id:string,author:string,title:string,published=true)=>sql.prepare('INSERT INTO community_guides(id,author_id,title,draft,published,updated_at,published_at) VALUES(?,?,?,?,?,?,?)').run(id,author,title+' (draft)',JSON.stringify({title}),published?JSON.stringify({title}):null,'2026-01-01',published?'2026-01-0'+(++at%9+1):null);
 return {sql,database,user,staff,change,guide};
}

/** Guides without a known topic show the guides book. */
const BOOK='/icons/navigation/collection-log-icon.png';
test('guide writers are listed by guide count with their published guides; drafts do not count',async()=>{
 const x=setup();try{
  x.user('100000000000000001','Quill Fake');x.user('100000000000000002','Ink Fake');x.user('100000000000000003','Draft Only');
  x.guide('g1','100000000000000002','Vorkath');x.guide('g2','100000000000000001','Zulrah');x.guide('g3','100000000000000001','Muspah');
  x.guide('g4','100000000000000003','Unfinished',false);
  const {writers}=await loadCreditsPeople(x.database);
  assert.deepEqual(writers,[
   {name:'Quill Fake',role:null,guides:[{id:'g2',title:'Zulrah',icon:BOOK},{id:'g3',title:'Muspah',icon:BOOK}]},
   {name:'Ink Fake',role:null,guides:[{id:'g1',title:'Vorkath',icon:BOOK}]},
  ]);
 }finally{x.sql.close();}
});

test('current staff show their rank, retired staff every rank they held, in order',async()=>{
 const x=setup();try{
  x.user('200000000000000001','Boss Fake');x.staff('200000000000000001','owner');
  x.user('200000000000000002','Mod Fake');x.staff('200000000000000002','moderator');x.change('200000000000000002',null,'helper','2025-03-01T00:00:00Z');x.change('200000000000000002','helper','moderator','2025-09-01T00:00:00Z');
  x.user('200000000000000003','Old Guard');x.change('200000000000000003',null,'helper','2024-01-01T00:00:00Z');x.change('200000000000000003','helper','moderator','2024-06-01T00:00:00Z');x.change('200000000000000003','moderator','admin','2025-01-01T00:00:00Z');x.change('200000000000000003','admin',null,'2026-02-01T00:00:00Z');
  // Removed, then back: current staff, not retired.
  x.user('200000000000000004','Comeback');x.staff('200000000000000004','helper');x.change('200000000000000004',null,'helper','2024-01-01T00:00:00Z');x.change('200000000000000004','helper',null,'2024-05-01T00:00:00Z');x.change('200000000000000004',null,'helper','2025-05-01T00:00:00Z');
  const {staff,retired}=await loadCreditsPeople(x.database);
  assert.deepEqual(staff,[{name:'Boss Fake',role:'owner',since:null},{name:'Mod Fake',role:'moderator',since:'2025-09-01T00:00:00Z'},{name:'Comeback',role:'helper',since:'2025-05-01T00:00:00Z'}]);
  assert.deepEqual(retired,[{name:'Old Guard',until:'2026-02-01T00:00:00Z',ranks:[{role:'helper',since:'2024-01-01T00:00:00Z'},{role:'moderator',since:'2024-06-01T00:00:00Z'},{role:'admin',since:'2025-01-01T00:00:00Z'}]}]);
 }finally{x.sql.close();}
});

test('the owner shows the scimitar they display on their profile',async()=>{
 const x=setup();try{
  x.user('300000000000000001','Quiet Boss');x.staff('300000000000000001','owner');
  x.sql.prepare("INSERT INTO profile_presentation(rsn,staff_badge) VALUES('quiet boss','helper')").run();
  assert.deepEqual((await loadCreditsPeople(x.database)).staff,[{name:'Quiet Boss',role:'helper',since:null}]);
 }finally{x.sql.close();}
});

test('people who opted out, have no public name, or were never staff or writers are left out, and no Discord detail leaves',async()=>{
 const x=setup();try{
  x.user('400000000000000001','Hidden Writer',{listed:0});x.guide('h1','400000000000000001','Secret');
  x.user('400000000000000002','Hidden Mod',{listed:0});x.staff('400000000000000002','moderator');
  x.user('400000000000000003','Private Name',{privateName:true});x.staff('400000000000000003','helper');
  x.user('400000000000000004',null);x.guide('h2','400000000000000004','No name');
  x.user('400000000000000005','Hidden Retiree',{listed:0});x.change('400000000000000005',null,'helper','2024-01-01');x.change('400000000000000005','helper',null,'2024-02-01');
  x.user('400000000000000006','Just A Player');
  x.user('400000000000000007','Shown Fake');x.staff('400000000000000007','admin');x.guide('h3','400000000000000007','Kept');
  const people=await loadCreditsPeople(x.database);
  assert.deepEqual(people,{writers:[{name:'Shown Fake',role:'admin',guides:[{id:'h3',title:'Kept',icon:BOOK}]}],staff:[{name:'Shown Fake',role:'admin',since:null}],retired:[]});
  const json=JSON.stringify(people);
  assert.doesNotMatch(json,/\d{15,}|discord/i);
 }finally{x.sql.close();}
});

test('a private first name falls back to the next public one',async()=>{
 const x=setup();try{
  x.user('500000000000000001','Main Private',{privateName:true});
  x.sql.prepare('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,?)').run('public alt','Public Alt','500000000000000001',999);
  x.staff('500000000000000001','helper');
  assert.deepEqual((await loadCreditsPeople(x.database)).staff,[{name:'Public Alt',role:'helper',since:null}]);
 }finally{x.sql.close();}
});

test('rank steps skip unreadable rows and count a rank held before the first recorded change',()=>{
 const row=(id:number,action:string,detail:string,at:string)=>({id,target_id:'p',action,detail,created_at:at});
 assert.deepEqual(rankSteps([row(1,'grant','{bad',''),row(2,'grant',JSON.stringify({from:'helper',to:'admin'}),'2025-01-01'),row(3,'grant',JSON.stringify({from:'admin',to:'admin'}),'2025-02-01')]),
  {ranks:[{role:'helper',since:null},{role:'admin',since:'2025-01-01'}],until:null});
});

test('the list is served from the shared cache until it expires, and a failing cache never blocks it',async()=>{
 const store=new Map<string,Response>();let loads=0;
 const cache={async match(k:string){return store.get(k)?.clone();},async put(k:string,r:Response){store.set(k,r);}};
 const value={writers:[],staff:[{name:'A',role:'helper' as const,since:null}],retired:[]};
 const load=async()=>{loads++;return value;};
 assert.deepEqual(await cachedCreditsPeople(load,cache,'k'),value);
 assert.deepEqual(await cachedCreditsPeople(load,cache,'k'),value);
 assert.equal(loads,1);
 assert.equal(store.get('k')?.headers.get('Cache-Control'),`public, max-age=${CREDITS_MAX_AGE}`);
 const broken={async match():Promise<Response|undefined>{throw Error('down');},async put(){throw Error('down');}};
 assert.deepEqual(await cachedCreditsPeople(load,broken,'k'),value);
 assert.equal(loads,2);
});

test('the public endpoint is cached and the opt-out clears it',()=>{
 const route=readFileSync(new URL('../app/api/credits/route.ts',import.meta.url),'utf8');
 assert.match(route,/caches\.open\('spooned-credits-v1'\)/);
 assert.match(route,/public, max-age=\$\{CREDITS_MAX_AGE\}/);
 const optOut=readFileSync(new URL('../app/api/account-settings/credits/route.ts',import.meta.url),'utf8');
 assert.match(optOut,/sameOrigin\(req\)/);
 assert.match(optOut,/caches\.open\('spooned-credits-v1'\)\)\.delete/);
});
