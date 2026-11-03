import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {profileVerified,verifiedSql} from './verified-profile';

test('a profile is verified only when the Discord account it is linked to bound it through the plugin under this name',()=>{
 assert.equal(profileVerified('alice',['alice']),true);
 assert.equal(profileVerified('alice',['alice','alice']),true);       // two game accounts seen under the name, both hers
 assert.equal(profileVerified('alice',[]),false);                     // linked on the site only
 assert.equal(profileVerified('alice',['bob']),false);                // bound to someone else
 assert.equal(profileVerified('alice',['alice','bob']),false);        // someone else also proved a character under the name
 assert.equal(profileVerified(null,['alice']),false);                 // bound but not linked (unlinked or never added)
});

function setup(){
 const sql=new DatabaseSync(':memory:');
 sql.exec('CREATE TABLE claimed_names(rsn TEXT PRIMARY KEY NOT NULL,display_name TEXT NOT NULL,discord_id TEXT NOT NULL,claimed_at INTEGER NOT NULL)');
 sql.exec(readFileSync(new URL('../drizzle/0036_plugin_account_owners.sql',import.meta.url),'utf8'));
 const claim=(rsn:string,discord:string)=>sql.prepare('INSERT INTO claimed_names(rsn,display_name,discord_id,claimed_at) VALUES(?,?,?,0)').run(rsn,rsn,discord);
 const bind=(key:string,discord:string,rsn:string,first=rsn)=>sql.prepare('INSERT INTO plugin_account_owners(account_key,discord_id,rsn,rsn_at_binding,bound_at,updated_at) VALUES(?,?,?,?,0,0)').run(key,discord,rsn,first);
 const verified=(rsn:string,shown=true)=>!!(sql.prepare(`SELECT ${verifiedSql('c',shown)} AS v FROM claimed_names c WHERE c.rsn=?`).get(rsn) as {v:number}).v;
 return {sql,claim,bind,verified};
}

test('the SQL rule matches: linked and bound by the same Discord account under the current name',()=>{
 const x=setup();try{
  x.claim('zezima','alice');x.bind('k1','alice','zezima');
  assert.equal(x.verified('zezima'),true);
  x.claim('site only','alice');
  assert.equal(x.verified('site only'),false);                        // linked, never synced through the plugin
  x.claim('taken','alice');x.bind('k2','bob','taken');
  assert.equal(x.verified('taken'),false);                            // bound to someone else
  x.claim('shared','alice');x.bind('k3','alice','shared');x.bind('k4','bob','shared');
  assert.equal(x.verified('shared'),false);                           // another person's binding under the name
  x.claim('new name','alice');x.bind('k5','alice','old name');
  assert.equal(x.verified('new name'),false);                         // renamed, not synced under the new name yet
  x.sql.prepare("UPDATE plugin_account_owners SET rsn='new name' WHERE account_key='k5'").run();
  assert.equal(x.verified('new name'),true);                          // the next sync moves the binding to the new name
  x.bind('k6','carol','unlinked');
  assert.equal(x.sql.prepare(`SELECT ${verifiedSql('c')} AS v FROM claimed_names c WHERE c.rsn='unlinked'`).get(),undefined); // no link, no profile row
 }finally{x.sql.close();}
});

test('while the plugin page is off the rule is a constant 0, so the live site shows and queries nothing new',()=>{
 assert.equal(verifiedSql('c',false),'0');
 const x=setup();try{
  x.claim('zezima','alice');x.bind('k1','alice','zezima');
  assert.equal(x.verified('zezima',false),false);
 }finally{x.sql.close();}
});

test('profile and account settings responses carry the flag, and the badge shows only with the plugin page',()=>{
 assert.match(readFileSync('lib/profile-store.ts','utf8'),/\$\{verifiedSql\('c'\)\} AS verified/);
 assert.match(readFileSync('app/api/account-settings/route.ts','utf8'),/\$\{verifiedSql\("c"\)\} AS verified/);
 assert.match(readFileSync('app/ProfileIdentity.tsx','utf8'),/\{verified&&PLUGIN_FEATURES&&<VerifiedBadge\/>\}/);
 assert.match(readFileSync('app/AccountSettings.tsx','utf8'),/\{PLUGIN_FEATURES && account\.verified && <VerifiedBadge/);
});
