import assert from 'node:assert/strict';
import test from 'node:test';
import {rankHistory} from './staff-rank-history';
import {mayReviewProposal,proposerRankGuard} from './staff-policy';

const grant=(id:number,target:string,from:string|null,to:string|null,at:string)=>({id,target_id:target,action:to?'grant':'revoke',detail:JSON.stringify({from,to}),created_at:at});
const events=[
 grant(1,'bramble',null,'helper','2026-01-01T00:00:00Z'),
 grant(2,'bramble','helper','moderator','2026-02-01T00:00:00Z'),
 grant(3,'corvid',null,'helper','2026-03-01T00:00:00Z'),
 grant(4,'bramble','moderator',null,'2026-04-01T00:00:00Z'),
];
const current=new Map([['corvid','helper' as const],['mira','admin' as const]]);
test('ranks are replayed from the access history: just before a change, and at a moment in time',()=>{
 const roleAt=rankHistory(events,current);
 assert.equal(roleAt('bramble',{beforeId:1}),null,'not staff before the first grant');
 assert.equal(roleAt('bramble',{beforeId:2}),'helper','a helper when promoted to moderator');
 assert.equal(roleAt('bramble',{beforeId:4}),'moderator','a moderator when removed');
 assert.equal(roleAt('bramble',{at:'2026-01-15T00:00:00Z'}),'helper');
 assert.equal(roleAt('bramble',{at:'2026-05-01T00:00:00Z'}),null,'no rank after removal');
 assert.equal(roleAt('corvid',{at:'2025-12-01T00:00:00Z'}),null,'before the first change: the rank it started from');
 assert.equal(roleAt('mira',{beforeId:1}),'admin','no recorded change: the current rank');
 assert.equal(roleAt(null,{beforeId:1}),null);
});
test('the rank rule: a proposal is decided by the proposer\'s rank or higher, in code and in SQL',()=>{
 assert.equal(mayReviewProposal('moderator','admin'),false);
 assert.equal(mayReviewProposal('moderator','moderator'),true);
 assert.equal(mayReviewProposal('admin','helper'),true);
 assert.equal(mayReviewProposal('helper',null),true);
 assert.match(proposerRankGuard('c.actor_id','s.role'),/<=CASE s\.role/);
});
