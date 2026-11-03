import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanNamePrefix,earnedPrefix,shownPrefix,squireReason} from './name-prefix.ts';

test('Squire goes to helpers and guide writers; moderators, admins and the owner earn Sir, which always wins', () => {
 assert.equal(earnedPrefix('helper',false,true),'Squire');
 assert.equal(earnedPrefix(null,true,true),'Squire');
 assert.equal(earnedPrefix('helper',true,true),'Squire');
 for(const role of ['moderator','admin','owner'] as const){
  assert.equal(earnedPrefix(role,false,true),'Sir');
  assert.equal(earnedPrefix(role,true,true),'Sir');
 }
 assert.equal(earnedPrefix(null,false,true),null);
 assert.equal(earnedPrefix(undefined,false,true),null);
});
test('with Squire off, every staff rank earns Sir as before and guide writers earn nothing', () => {
 for(const role of ['helper','moderator','admin','owner'] as const)assert.equal(earnedPrefix(role,true,false),'Sir');
 assert.equal(earnedPrefix(null,true,false),null);
 // Production build (tests run as production): no Squire anywhere.
 assert.equal(earnedPrefix('helper',true),'Sir');
 assert.equal(earnedPrefix(null,true),null);
 assert.equal(shownPrefix('Squire','helper',true),'Sir');
 assert.equal(shownPrefix('Squire',null,true),null);
});
test('the stored choice is opt-in and shows the prefix earned today', () => {
 assert.equal(shownPrefix(null,'helper',true,true),null);
 assert.equal(shownPrefix('Sir','helper',false,true),'Squire');
 assert.equal(shownPrefix('Squire','moderator',false,true),'Sir');
 assert.equal(shownPrefix('Squire',null,false,true),null);
 assert.equal(shownPrefix('Lord','owner',false,true),null);
 assert.equal(cleanNamePrefix('Squire'),'Squire');
 assert.equal(cleanNamePrefix('squire'),null);
});
test('the Squire card says why', () => {
 assert.equal(squireReason('helper'),'Helper on the Spooned OSRS team.');
 assert.equal(squireReason(null),'Wrote a published Spooned OSRS guide.');
});
