import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync} from 'node:fs';
import {GUIDE_CATEGORIES,guideCategory,guideTopics,ungroupedActivities} from './guide-topics.ts';

test('guide groups follow the collection log tabs and the game lists',()=>{
 const cases:[string,string][]=[['Zulrah','bosses'],['Vorkath','bosses'],['Barrows Chests','bosses'],['Wintertodt','bosses'],['Tempoross','bosses'],['Zalcano','bosses'],
  ['TzTok-Jad','bosses'],['Sol Heredit','bosses'],['Dagannoth Rex','bosses'],['Callisto','bosses'],['The Corrupted Gauntlet','bosses'],
  ['Tombs of Amascut','raids'],['Theatre of Blood: Hard Mode','raids'],['Guardians of the Rift','minigames'],['Soul Wars','minigames'],['PvP Arena','minigames'],
  ['Clue scrolls','clues'],['Clue Scrolls (hard)','clues'],['Mimic','clues'],
  ['Dragon Slayer I','quests'],['the restless ghost','quests'],['Farming','skilling'],['Varrock Diary','diaries'],['Elite combat achievements','combat-achievements'],
  ['Collection log','other'],['Test guide','other'],['','other']];
 for(const [activity,category] of cases)assert.equal(guideCategory(activity),category,activity);
});
test('every Hiscores activity has a collection log group, and every group icon exists',()=>{
 assert.deepEqual(ungroupedActivities(),[]);
 const ids=new Set<string>(GUIDE_CATEGORIES.map(c=>c.id));
 for(const t of guideTopics)assert.ok(ids.has(guideCategory(t.name)),t.name);
 for(const c of GUIDE_CATEGORIES)assert.ok(existsSync(new URL('../public'+c.icon,import.meta.url)),c.icon);
});
