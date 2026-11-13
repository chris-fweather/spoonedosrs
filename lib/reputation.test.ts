import assert from 'node:assert/strict';
import test from 'node:test';
import {canGiveRespect,reputationHint,type Reputation} from './reputation.ts';

const base:Reputation={count:0,given:false,signedIn:true,ownProfile:false,available:true,canVote:true,networkUsed:false};

test('a player may commend their own linked name once', () => {
 const own={...base,ownProfile:true};
 assert.equal(canGiveRespect(own),true);
 assert.equal(reputationHint(own),'Give yourself respect: one +1 on each of your linked names.');
 // Once given, the usual one-per-giver rule applies: the only action left is undo.
 const given={...own,given:true,count:1};
 assert.equal(canGiveRespect(given),false);
 assert.equal(reputationHint(given),'You gave yourself respect. Click to undo.');
});

test('self-commendation keeps every other limit', () => {
 for(const rep of [{...base,ownProfile:true,available:false},{...base,ownProfile:true,canVote:false},{...base,ownProfile:true,networkUsed:true}])assert.equal(canGiveRespect(rep),false);
 assert.equal(reputationHint({...base,ownProfile:true,networkUsed:true}),'This connection has already commended this profile.');
 assert.equal(reputationHint({...base,ownProfile:true,available:false}),'This player needs a saved journal before receiving respect.');
});

test('visitors and guests are unchanged', () => {
 assert.equal(canGiveRespect(base),true);
 assert.equal(canGiveRespect({...base,signedIn:false}),true);
 assert.equal(reputationHint({...base,given:true}),'You gave respect. Click to undo.');
 assert.equal(reputationHint(base),'Give respect. One +1 per connection on this profile; no sign-in needed.');
});
