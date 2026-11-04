import test from 'node:test';
import assert from 'node:assert/strict';
import {drawsPlayerCard,shareCardKey} from './share-cache.ts';
const url='https://spoonedosrs.com/api/share?username=Obifloat';
test('a public card key changes when the board version bumps, the journal revision changes, or the player differs',()=>{
 const base=shareCardKey(url,'Obifloat',10,3).url;
 assert.equal(shareCardKey(url,'obifloat',10,3).url,base,'same player, same versions: same key, any letter case');
 assert.notEqual(shareCardKey(url,'Obifloat',11,3).url,base,'going private, a staff hide or a rank change bumps the board version');
 assert.notEqual(shareCardKey(url,'Obifloat',10,4).url,base,'a sync bumps the journal revision');
 assert.notEqual(shareCardKey(url,'Someone',10,3).url,base);
});
test('only public profiles get a drawn card',()=>{
 assert.equal(drawsPlayerCard('public'),true);assert.equal(drawsPlayerCard(null),true);assert.equal(drawsPlayerCard(undefined),true);
 assert.equal(drawsPlayerCard('private'),false);assert.equal(drawsPlayerCard('anything else'),false);
});
