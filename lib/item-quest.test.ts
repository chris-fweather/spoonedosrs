import {test} from 'node:test';
import assert from 'node:assert/strict';
import {infoboxQuests} from './item-quest.ts';

const page = (fields: string) => `{{Infobox Item\n|name = Thing\n${fields}\n|examine = A thing.\n}}\nThe thing is...`;

test('an untradeable item names the quest its infobox links',()=>{
 assert.deepEqual(infoboxQuests(page('|members = No\n|quest = [[Dragon Slayer I]]\n|tradeable = No')),['Dragon Slayer I']);
 // Piped links, several quests and numbered versions.
 assert.deepEqual(infoboxQuests(page('|quest = [[Dragon Slayer I|DS1]] and [[The Restless Ghost]]\n|tradeable = No')),['Dragon Slayer I','The Restless Ghost']);
 assert.deepEqual(infoboxQuests(page('|quest1 = [[Dragon Slayer I]]\n|tradeable1 = No')),['Dragon Slayer I']);
});

test('tradeable items, items without a quest and unknown pages name none',()=>{
 assert.deepEqual(infoboxQuests(page('|quest = [[Dragon Slayer I]]\n|tradeable = Yes')),[]);
 assert.deepEqual(infoboxQuests(page('|quest = No\n|tradeable = No')),[]);
 // A link that is not one of our quests, such as a place.
 assert.deepEqual(infoboxQuests(page('|quest = [[Crandor]]\n|tradeable = No')),[]);
 assert.deepEqual(infoboxQuests('Not an item page'),[]);
});
