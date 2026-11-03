import test from 'node:test';
import assert from 'node:assert/strict';
import {IS_DEV_ENVIRONMENT} from './environment.ts';
import {SQUIRE_LIVE,SQUIRE_PREFIX,WORLD_MAP_LIVE,WORLD_MAP_PAGE,navLinks,squireShown,worldMapDirections,worldMapShown} from './features.ts';

test('the world map page is off on the production build while its visuals are finished', () => {
 // Tests build like production: no SPOONED_ENV=dev.
 assert.equal(IS_DEV_ENVIRONMENT,false);
 assert.equal(WORLD_MAP_LIVE,false);
 assert.equal(WORLD_MAP_PAGE,false);
 assert.deepEqual(navLinks().map(l=>l.key),['home','leaderboard','guides','support']);
 assert.equal(worldMapDirections({x:3222,y:3218,plane:0},'Lumbridge'),null);
});
test('the switch controls the world map: off on production hides it, dev always shows it', () => {
 assert.equal(worldMapShown(false,false),false);
 assert.equal(worldMapShown(true,false),true);
 assert.equal(worldMapShown(false,true),true);
});
test('with the world map off, the header has no Map button and guide stops no directions link', () => {
 assert.deepEqual(navLinks(false).map(l=>l.key),['home','leaderboard','guides','support']);
 assert.equal(worldMapDirections({x:3222,y:3218,plane:0},'Lumbridge',false),null);
});
test('with the world map on, the Map button and directions show', () => {
 assert.deepEqual(navLinks(true).map(l=>l.key),['home','leaderboard','guides','map','support']);
 assert.equal(worldMapDirections({x:3222,y:3218,plane:1},'Duke Horacio',true),'/map?to=3222,3218,1&name=Duke%20Horacio');
});
test('the Squire prefix is off on the production build and always on in dev', () => {
 assert.equal(SQUIRE_LIVE,false);
 assert.equal(SQUIRE_PREFIX,false);
 assert.equal(squireShown(false,false),false);
 assert.equal(squireShown(true,false),true);
 assert.equal(squireShown(false,true),true);
});
