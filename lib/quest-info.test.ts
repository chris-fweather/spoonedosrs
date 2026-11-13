import {test} from 'node:test';
import assert from 'node:assert/strict';
import {questInfo} from './quest-info.ts';

test('a quest card has its difficulty orb, length, start and requirements',()=>{
 const q=questInfo('regicide');
 assert.ok(q);
 assert.equal(q.name,'Regicide');
 assert.equal(q.difficulty,'Experienced');
 assert.equal(q.icon,'/icons/tiers/experienced.png');
 assert.equal(q.length,'Long');
 assert.match(q.start??'',/King Lathas/);
 assert.deepEqual(q.skills,[{skill:'Agility',level:56},{skill:'Crafting',level:10}]);
 assert.deepEqual(q.quests,['Underground Pass']);
 assert.equal(questInfo('Not a quest'),null);
});
