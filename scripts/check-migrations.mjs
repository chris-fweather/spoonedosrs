import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';

const files=readdirSync('drizzle').filter(name=>/^\d{4}_.+\.sql$/.test(name)).sort();
const database=new DatabaseSync(':memory:');
try{
  database.exec('PRAGMA foreign_keys=ON');
  for(const [index,file] of files.entries()){
    assert.equal(Number(file.slice(0,4)),index,`Migration order has a gap: ${file}`);
    database.exec('BEGIN');
    try{database.exec(readFileSync('drizzle/'+file,'utf8'));database.exec('COMMIT');}
    catch(error){database.exec('ROLLBACK');throw new Error(`Migration failed: ${file}`,{cause:error});}
    if(file.startsWith('0018_')){
      // Synthetic existing user/journal must survive the pending upgrade set.
      database.prepare('INSERT INTO journals(id,data,revision) VALUES(?,?,?)').run('release test',JSON.stringify({username:'Release Test',pets:[],log:null}),7);
      // A helper whose own row lists more than guides keeps guide-only access once rank defaults exist.
      database.prepare('INSERT INTO users(discord_id,username,updated_at) VALUES(?,?,0)').run('release-helper','Release helper');
      database.prepare("INSERT INTO staff_members(discord_id,role,revision) VALUES(?,'helper','test')").run('release-helper');
      database.prepare('INSERT INTO staff_permissions(discord_id,guides,corrections,planning) VALUES(?,1,1,1)').run('release-helper');
    }
    if(file.startsWith('0026_')){
      // An approved hold from before 0027 must survive the staff_cases rebuild.
      database.prepare("INSERT INTO staff_cases(id,rsn,action,source_id,protected,reason,creator_id,creator_name,created_at,state) VALUES('release-case','release test','unlink','release-helper',0,'Held for the release check.','release-helper','Release helper','2026-01-01T00:00:00Z','approved')").run();
    }
    if(file.startsWith('0037_')){
      // Before 0038: the site has an owner, who will own the tree runs guide draft.
      database.prepare('INSERT INTO users(discord_id,username,updated_at) VALUES(?,?,0)').run('release-owner','Release owner');
      database.prepare("INSERT INTO staff_members(discord_id,role,revision) VALUES(?,'owner','test')").run('release-owner');
    }
    if(file.startsWith('0046_')){
      // Before 0047: a guide whose blocks were stored as text holding the list (what 0044 once did on newer SQLite).
      const g=JSON.parse(database.prepare("SELECT draft FROM community_guides WHERE id='tree-runs-new'").get().draft);
      const broken=JSON.stringify({...g,blocks:JSON.stringify(g.blocks)});
      database.prepare("INSERT INTO community_guides(id,author_id,title,draft,published,updated_at,published_at) VALUES('blocks-as-text','release-owner','Blocks as text',?,?,'2026-01-01','2026-01-01')").run(broken,broken);
    }
    if(file.startsWith('0045_')){
      // Before 0046: the guide people read is saved under another id (as on the dev site), with the paragraph in both copies.
      const g=JSON.parse(database.prepare("SELECT draft FROM community_guides WHERE id='tree-runs-new'").get().draft);
      g.blocks.splice(6,0,{id:'b7',kind:'text',text:'Between brackets, plant the best of each you can: at 68 Farming, palms with yews.',style:'body',tone:'default'});
      database.prepare("INSERT INTO community_guides(id,author_id,title,draft,published,updated_at,published_at) VALUES('dev-original','release-owner','Tree runs',?,?,'2026-01-01','2026-01-01')").run(JSON.stringify(g),JSON.stringify(g));
    }
    if(file.startsWith('0044_')){
      // Before 0045: the same paragraph still sits inside a two-column block of the published copy (as on the dev site).
      const pub=JSON.parse(database.prepare("SELECT published FROM community_guides WHERE id='tree-runs'").get().published);
      pub.blocks.find(b=>b.kind==='columns').columns.push({id:'between-nested',kind:'text',text:'Between brackets, plant the best of each you can: at 68 Farming, palms with yews.',style:'body',tone:'default'});
      database.prepare("UPDATE community_guides SET published=? WHERE id='tree-runs'").run(JSON.stringify(pub));
    }
    if(file.startsWith('0043_')){
      // Before 0044: a site that already had the tree runs guide with the old paragraph, published (the dev site).
      const old=JSON.parse(database.prepare("SELECT draft FROM community_guides WHERE id='tree-runs'").get().draft);
      old.blocks.splice(6,0,{id:'between',kind:'text',text:'Between brackets, plant the best of each you can: at 68 Farming, palms with yews.',style:'body',tone:'default'});
      database.prepare("INSERT INTO community_guides(id,author_id,title,draft,published,updated_at,published_at) VALUES('tree-runs-old','release-owner','Old tree runs',?,?,'2026-01-01','2026-01-01')").run(JSON.stringify(old),JSON.stringify(old));
      database.prepare("UPDATE community_guides SET id='tree-runs-new' WHERE id='tree-runs'").run();
      database.prepare("UPDATE community_guides SET id='tree-runs' WHERE id='tree-runs-old'").run();
    }
    if(file.startsWith('0042_')){
      // Before 0043: emblems pinned under the 1,717-item collection log ids, live and saved with a removed link.
      for(const [rsn,mark] of [['clog pin',"clog-429"],['clog full','clog-1717'],['clog low','clog-17'],['pet pin','pets-10']])database.prepare('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at,pinned_mark) VALUES(?,?,?,?,?)').run(rsn,rsn,'release-helper',3,mark);
      database.prepare("INSERT INTO profile_link_owners(rsn,discord_id,linked_at,saved_flair) VALUES('clog saved','release-helper',3,?)").run(JSON.stringify({companion_pet:null,pinned_mark:'clog-1545'}));
    }
    if(file.startsWith('0041_')){
      // Before 0042: a guide published before visibility existed.
      database.prepare("INSERT INTO community_guides(id,author_id,title,draft,published,updated_at,published_at) VALUES('release-guide','release-owner','Release guide','{}','{}','2026-01-01','2026-01-01')").run();
    }
    if(file.startsWith('0038_')){
      // Before 0039: a provider already has a pacing slot.
      database.prepare("INSERT INTO provider_pacing(provider,next_at) VALUES('wom',5)").run();
    }
    if(file.startsWith('0030_')){
      // Before 0031: one person's donations recorded per name, plus a total on a name nobody has linked.
      database.prepare('INSERT INTO users(discord_id,username,updated_at) VALUES(?,?,0)').run('release-donor','Release donor');
      for(const [rsn,at] of [['donor main',1],['donor alt',2]])database.prepare('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,?)').run(rsn,rsn,'release-donor',at);
      for(const [rsn,amount] of [['donor main',1000],['donor alt',2500],['unlinked donor',300]])database.prepare("INSERT INTO profile_supporter_totals(rsn,amount_minor,currency) VALUES(?,?,'USD')").run(rsn,amount);
    }
    if(file.startsWith('0031_')){
    // 0031: a person's per-name totals become one total; the largest name is featured; unlinked names keep theirs.
    assert.deepEqual({...database.prepare('SELECT amount_minor,currency,featured_rsn FROM supporter_totals WHERE discord_id=?').get('release-donor')},{amount_minor:3500,currency:'USD',featured_rsn:'donor alt'});
    assert.deepEqual(database.prepare('SELECT rsn FROM profile_supporter_totals ORDER BY rsn').all().map(r=>r.rsn),['unlinked donor']);
    }
    if(file.startsWith('0033_')){
      // Before 0034: an account-wide "the Generous" flag on a person with two linked names, and no donation.
      database.prepare('INSERT INTO users(discord_id,username,updated_at,title) VALUES(?,?,0,?)').run('release-generous','Release generous','the Generous');
      for(const [rsn,at] of [['generous b',2],['generous a',1]])database.prepare('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,?)').run(rsn,rsn,'release-generous',at);
    }
    if(file.startsWith('0023_')){
      // A Group Ironman synced before 0024: the old summary trigger dropped the account type.
      database.prepare('INSERT INTO journals(id,data,revision) VALUES(?,?,?)').run('board gim',JSON.stringify({username:'Board GIM',accountMode:'group_ironman',pets:[],log:null}),1);
    }
  }
  assert.equal(database.prepare('SELECT revision FROM journals WHERE id=?').get('release test')?.revision,7);
  for(const table of ['journal_summaries','staff_cases','account_actions','provider_pacing','provider_responses','staff_role_permissions'])assert.ok(database.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table),`Missing ${table}`);
  // 0025/0026: approving, publishing and ownership approval are their own permissions; shipped helper defaults can now propose corrections and kill rates.
  assert.deepEqual(database.prepare('SELECT role,guides,publish,corrections,planning,review,ownership FROM staff_role_permissions ORDER BY role').all().map(r=>({...r})),[{role:'admin',guides:1,publish:1,corrections:1,planning:1,review:1,ownership:1},{role:'helper',guides:1,publish:0,corrections:1,planning:1,review:0,ownership:0},{role:'moderator',guides:1,publish:1,corrections:1,planning:1,review:1,ownership:1}]);
  assert.deepEqual({...database.prepare('SELECT guides,corrections,planning,review FROM staff_permissions WHERE discord_id=?').get('release-helper')},{guides:1,corrections:0,planning:0,review:0});
  // 0027: staff_cases keeps its rows and indexes and accepts release-hold requests.
  assert.equal(database.prepare('SELECT state FROM staff_cases WHERE id=?').get('release-case')?.state,'approved');
  assert.deepEqual(database.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='staff_cases' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name),['staff_cases_queue','staff_cases_rsn']);
  database.prepare("INSERT INTO staff_cases(id,rsn,action,source_id,protected,reason,creator_id,creator_name,created_at) VALUES('release-case-2','release test','release','moderation-hold:release-case',0,'Release the hold.','release-helper','Release helper','2026-01-02T00:00:00Z')").run();
  assert.throws(()=>database.prepare("INSERT INTO staff_cases(id,rsn,action,protected,reason,creator_id,creator_name,created_at) VALUES('bad','release test','delete',0,'x','a','a','x')").run());
  // 0029: holding names right away is its own permission; helpers start without it.
  assert.deepEqual(database.prepare('SELECT role,holds FROM staff_role_permissions ORDER BY role').all().map(r=>({...r})),[{role:'admin',holds:1},{role:'helper',holds:0},{role:'moderator',holds:1}]);
  // 0030: guide uploads record their size and accept only image types.
  database.prepare("INSERT INTO guide_uploads(key,uploader_id,bytes,type,created_at) VALUES('guides/a.png','release-helper',10,'image/png','2026-01-01T00:00:00Z')").run();
  assert.throws(()=>database.prepare("INSERT INTO guide_uploads(key,uploader_id,bytes,type,created_at) VALUES('guides/b.svg','release-helper',10,'image/svg+xml','2026-01-01T00:00:00Z')").run());
  // 0028: every existing account starts on session version 0, so current sessions stay signed in.
  assert.equal(database.prepare('SELECT session_version FROM users WHERE discord_id=?').get('release-helper')?.session_version,0);
  // 0024 backfills the account type into board summaries, and later syncs keep it.
  const summaryMode=rsn=>database.prepare("SELECT json_extract(data,'$.accountMode') AS mode FROM journal_summaries WHERE rsn=?").get(rsn)?.mode??null;
  assert.equal(summaryMode('board gim'),'group_ironman');
  database.prepare('UPDATE journals SET data=?,revision=2 WHERE id=?').run(JSON.stringify({username:'Board GIM',accountMode:'hardcore_group_ironman',pets:[],log:null}),'board gim');
  assert.equal(summaryMode('board gim'),'hardcore_group_ironman');
  assert.equal(summaryMode('release test'),null);
  // 0032: plugin tokens are stored by hash only and each hash is unique; a received event is recorded once.
  database.prepare("INSERT INTO plugin_tokens(id,discord_id,token_hash,label,created_at) VALUES('t1','release-helper','hash-1','PC',0)").run();
  assert.throws(()=>database.prepare("INSERT INTO plugin_tokens(id,discord_id,token_hash,label,created_at) VALUES('t2','release-helper','hash-1','PC',0)").run());
  database.prepare("INSERT INTO plugin_events(discord_id,event_id,rsn,type,received_at) VALUES('release-helper','e1','release test','PET',0)").run();
  assert.throws(()=>database.prepare("INSERT INTO plugin_events(discord_id,event_id,rsn,type,received_at) VALUES('release-helper','e1','release test','PET',0)").run());
  assert.throws(()=>database.prepare("INSERT INTO plugin_events(discord_id,event_id,rsn,type,received_at) VALUES('release-helper','e2','release test','OTHER',0)").run());
  // A game account can be seen by two Discord accounts (one of them disputing the link), once each.
  database.prepare("INSERT INTO plugin_accounts(account_key,discord_id,rsn,display_name,first_seen,last_seen) VALUES('k','a','release test','Release Test',0,0),('k','b','release test','Release Test',0,0)").run();
  assert.throws(()=>database.prepare("INSERT INTO plugin_accounts(account_key,discord_id,rsn,display_name,first_seen,last_seen) VALUES('k','a','release test','Release Test',0,0)").run());
  database.prepare("INSERT INTO notifications(id,discord_id,kind,rsn,created_at) VALUES('n1','a','link_review_requested','release test',0)").run();
  assert.throws(()=>database.prepare("INSERT INTO notifications(id,discord_id,kind,rsn,created_at) VALUES('n2','a','spam','release test',0)").run());
  // 0033: everyone starts listed on the Credits page and can only hide (0) or show (1) themselves.
  assert.equal(database.prepare('SELECT credits_listed FROM users WHERE discord_id=?').get('release-helper')?.credits_listed,1);
  database.prepare('UPDATE users SET credits_listed=0 WHERE discord_id=?').run('release-helper');
  assert.throws(()=>database.prepare('UPDATE users SET credits_listed=2 WHERE discord_id=?').run('release-helper'));
  // 0034: totals become a per-profile ledger. The person's total lands on their featured name only, not on every name;
  // the unlinked name keeps its own; the old account-wide flag becomes a grant on the first linked name only.
  assert.deepEqual(database.prepare('SELECT rsn,amount_minor,currency,granted FROM profile_supporter_totals ORDER BY rsn').all().map(r=>({...r})),[
    {rsn:'donor alt',amount_minor:3500,currency:'USD',granted:0},{rsn:'generous a',amount_minor:0,currency:'USD',granted:1},{rsn:'unlinked donor',amount_minor:300,currency:'USD',granted:0}]);
  assert.deepEqual({...database.prepare("SELECT donor_id,target_rsn,source FROM donations WHERE id='legacy-person:release-donor'").get()},{donor_id:'release-donor',target_rsn:'donor alt',source:'legacy'});
  assert.deepEqual(database.prepare('SELECT rsn,supporter FROM profile_support ORDER BY rsn').all().map(r=>[r.rsn,r.supporter]),[['donor alt',1],['generous a',1],['unlinked donor',1]]);
  // The recipient can hide it: the view then shows neither the amount nor supporter status.
  database.prepare("INSERT INTO profile_presentation(rsn,show_supporter) VALUES('donor alt',0)").run();
  assert.deepEqual({...database.prepare("SELECT amount_minor,supporter FROM profile_support WHERE rsn='donor alt'").get()},{amount_minor:null,supporter:0});
  assert.throws(()=>database.prepare("UPDATE profile_presentation SET show_supporter=2 WHERE rsn='donor alt'").run());
  // Anonymous numbers are unique; statuses and kinds are fixed lists.
  const donation=(id,n)=>database.prepare("INSERT INTO donations(id,amount_minor,currency,anonymous_number,claim_hash,source,created_at,updated_at) VALUES(?,100,'USD',?,'h','staff',0,0)").run(id,n);
  donation('anon-1',1);assert.throws(()=>donation('anon-2',1));
  assert.throws(()=>database.prepare("UPDATE donations SET status='pending' WHERE id='anon-1'").run());
  assert.throws(()=>database.prepare("INSERT INTO donations(id,amount_minor,currency,source,created_at,updated_at) VALUES('neg',-1,'USD','staff',0,0)").run());
  // 0035: a claim looks the donation up by its code's hash, so a live hash is unique; claimed rows (NULL) never collide.
  assert.throws(()=>donation('anon-3',3));
  database.prepare("UPDATE donations SET claim_hash=NULL WHERE id='anon-1'").run();
  donation('anon-4',4);
  database.prepare("INSERT INTO donations(id,amount_minor,currency,source,created_at,updated_at) VALUES('signed-1',100,'USD','staff',0,0),('signed-2',100,'USD','staff',0,0)").run();
  database.prepare("UPDATE donations SET claim_hash=NULL WHERE id='anon-4'").run();
  assert.equal(database.prepare("SELECT count(*) AS n FROM donations WHERE claim_hash IS NULL AND id IN ('anon-1','anon-4','signed-1','signed-2')").get().n,4);
  assert.ok(database.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='donations_claim_hash'").get());
  // Plugin tokens record their last sync.
  database.prepare("UPDATE plugin_tokens SET last_sync_at=1,last_sync_rsn='release test',plugin_version='0.1.0' WHERE id='t1'").run();
  // 0036: a game account proven through the plugin is bound to one Discord account at a time, under any name.
  const bind=(discord,rsn)=>database.prepare("INSERT INTO plugin_account_owners(account_key,discord_id,rsn,rsn_at_binding,bound_at,updated_at) VALUES('k',?,?,?,0,0)").run(discord,rsn,rsn);
  bind('a','release test');assert.throws(()=>bind('b','renamed test'),'a second binding for the same account');
  // 0037: a staff member's hover title is optional and 2-32 characters; existing staff keep the default (NULL).
  assert.equal(database.prepare('SELECT title FROM staff_members WHERE discord_id=?').get('release-helper').title,null);
  database.prepare("UPDATE staff_members SET title='Guide Lead' WHERE discord_id='release-helper'").run();
  assert.throws(()=>database.prepare("UPDATE staff_members SET title='x' WHERE discord_id='release-helper'").run(),'a one-character title');
  assert.throws(()=>database.prepare('UPDATE staff_members SET title=? WHERE discord_id=?').run('x'.repeat(33),'release-helper'),'a 33-character title');
  database.prepare("UPDATE staff_members SET title=NULL WHERE discord_id='release-helper'").run();
  // 0047: blocks stored as text become the list again, in both copies.
  {const fresh=JSON.parse(database.prepare("SELECT draft FROM community_guides WHERE id='tree-runs-new'").get().draft),row=database.prepare("SELECT draft,published FROM community_guides WHERE id='blocks-as-text'").get();
   assert.deepEqual(JSON.parse(row.draft),fresh);assert.deepEqual(JSON.parse(row.published),fresh);
   database.prepare("DELETE FROM community_guides WHERE id='blocks-as-text'").run();}
  // Every guide left in the database has its blocks as a list.
  for(const r of database.prepare('SELECT id,draft,published FROM community_guides').all())for(const copy of [r.draft,r.published])if(copy&&copy!=='{}')assert.ok(Array.isArray(JSON.parse(copy).blocks),`${r.id}: blocks are a list`);
  // 0046: a guide under any id loses the paragraph in both copies and nothing else.
  {const fresh=JSON.parse(database.prepare("SELECT draft FROM community_guides WHERE id='tree-runs-new'").get().draft),row=database.prepare("SELECT draft,published FROM community_guides WHERE id='dev-original'").get();
   assert.deepEqual(JSON.parse(row.draft),fresh);assert.deepEqual(JSON.parse(row.published),fresh);
   database.prepare("DELETE FROM community_guides WHERE id='dev-original'").run();}
  // 0044 and 0045: the guide that had the old paragraph (as its own block, and nested in a column) loses only that, in its draft and its published copy, in order;
  // the guide as 0038 now writes it is identical. Put the 0038 guide back for the checks above.
  {const fresh=JSON.parse(database.prepare("SELECT draft FROM community_guides WHERE id='tree-runs-new'").get().draft),row=database.prepare("SELECT draft,published FROM community_guides WHERE id='tree-runs'").get();
   assert.deepEqual(JSON.parse(row.draft),fresh);assert.deepEqual(JSON.parse(row.published),fresh);assert.ok(!row.draft.includes('Between brackets'));
   assert.equal(fresh.blocks.length>10,true);
   database.prepare("DELETE FROM community_guides WHERE id='tree-runs'").run();database.prepare("UPDATE community_guides SET id='tree-runs' WHERE id='tree-runs-new'").run();}
  // 0038: the tree runs guide arrives as the owner's unpublished draft, a valid guide document.
  const guide=database.prepare("SELECT author_id,title,draft,published,published_at,revision FROM community_guides WHERE id='tree-runs'").get();
  assert.equal(guide.author_id,'release-owner');assert.equal(guide.published,null);assert.equal(guide.published_at,null);assert.equal(guide.revision,1);
  assert.equal(JSON.parse(guide.draft).title,guide.title);
  // 0039: provider pacing rows keep their next slot and start with no backoff strikes.
  assert.deepEqual({...database.prepare("SELECT next_at,strikes FROM provider_pacing WHERE provider='wom'").get()},{next_at:5,strikes:0});
  // 0040: names keep showing "the Generous" by default; the choice is 0 or 1.
  database.prepare("INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES('title test','Title test','release-helper',9)").run();
  database.prepare("INSERT INTO profile_presentation(rsn) VALUES('title test')").run();
  assert.equal(database.prepare("SELECT show_title FROM profile_presentation WHERE rsn='title test'").get().show_title,1);
  assert.throws(()=>database.prepare("UPDATE profile_presentation SET show_title=2 WHERE rsn='title test'").run(),'show_title is 0 or 1');
  // 0041: one pending row per name and source, for the three queued sources only.
  database.prepare("INSERT INTO sync_pending(rsn,source,queued_at) VALUES('release test','temple',1)").run();
  assert.throws(()=>database.prepare("INSERT INTO sync_pending(rsn,source,queued_at) VALUES('release test','temple',2)").run(),'one row per name and source');
  assert.throws(()=>database.prepare("INSERT INTO sync_pending(rsn,source,queued_at) VALUES('release test','hiscores',1)").run(),'Hiscores is never queued');
  // 0042: existing guides stay public; visibility is public or staff only. One thumbs up per person per guide, removed with the guide.
  assert.equal(database.prepare("SELECT visibility FROM community_guides WHERE id='release-guide'").get().visibility,'public');
  assert.equal(database.prepare("SELECT visibility FROM community_guides WHERE id='tree-runs'").get().visibility,'public');
  database.prepare("UPDATE community_guides SET visibility='staff' WHERE id='release-guide'").run();
  assert.throws(()=>database.prepare("UPDATE community_guides SET visibility='hidden' WHERE id='release-guide'").run(),'visibility is public or staff');
  database.prepare("INSERT INTO guide_thumbs(guide_id,voter_id,created_at) VALUES('release-guide','release-helper','2026-01-02')").run();
  assert.throws(()=>database.prepare("INSERT INTO guide_thumbs(guide_id,voter_id,created_at) VALUES('release-guide','release-helper','2026-01-03')").run(),'one thumbs up per person per guide');
  assert.throws(()=>database.prepare("INSERT INTO guide_thumbs(guide_id,voter_id,created_at) VALUES('no-such-guide','release-helper','2026-01-03')").run(),'a thumbs up needs a guide');
  database.prepare("DELETE FROM community_guides WHERE id='release-guide'").run();
  assert.equal(database.prepare('SELECT COUNT(*) AS n FROM guide_thumbs').get().n,0);
  // 0043: pinned collection log emblems move to the same share of 1,734; other pins stay.
  assert.deepEqual(database.prepare("SELECT rsn,pinned_mark FROM claimed_names WHERE rsn IN ('clog pin','clog full','clog low','pet pin') ORDER BY rsn").all().map(r=>[r.rsn,r.pinned_mark]),[['clog full','clog-1734'],['clog low','clog-17'],['clog pin','clog-434'],['pet pin','pets-10']]);
  assert.equal(JSON.parse(database.prepare("SELECT saved_flair FROM profile_link_owners WHERE rsn='clog saved'").get().saved_flair).pinned_mark,'clog-1561');
  assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(),[]);
  console.log(`${files.length} ordered migrations passed; pre-upgrade journal preserved.`);
}finally{database.close();}
