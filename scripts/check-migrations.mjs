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
  assert.equal(database.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(),[]);
  console.log(`${files.length} ordered migrations passed; pre-upgrade journal preserved.`);
}finally{database.close();}
