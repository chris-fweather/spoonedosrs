import test from 'node:test';
import assert from 'node:assert/strict';
import {COMBINED,SOURCE_ORDER,inOrder,type DataType} from './provider-fallback.ts';

// Every data type: the first source answers, the first fails, and none answers.
const cases:{type:DataType;answering:string[];used:string[];skipped:string[]}[]=[
 {type:'skills',answering:['hiscores','wom'],used:['hiscores'],skipped:['wom']},
 {type:'skills',answering:['wom'],used:['wom'],skipped:[]},
 {type:'skills',answering:[],used:[],skipped:[]},
 {type:'collectionLog',answering:['runeprofile','temple'],used:['runeprofile','temple'],skipped:[]},
 {type:'collectionLog',answering:['temple'],used:['temple'],skipped:[]},
 {type:'collectionLog',answering:[],used:[],skipped:[]},
 {type:'milestones',answering:['wom'],used:['wom'],skipped:[]},
 {type:'milestones',answering:[],used:[],skipped:[]},
 {type:'profile',answering:['runeprofile'],used:['runeprofile'],skipped:[]},
 {type:'profile',answering:[],used:[],skipped:[]},
];
for(const c of cases)test(`${c.type}: ${c.answering.join(' + ')||'nothing'} answers`,async()=>{
 const asked:string[]=[];
 const result=await inOrder(SOURCE_ORDER[c.type],async source=>{asked.push(source);return c.answering.includes(source);},COMBINED.has(c.type));
 assert.deepEqual(result.used,c.used);assert.deepEqual(result.skipped,c.skipped);
 assert.deepEqual(asked,SOURCE_ORDER[c.type].filter(s=>!c.skipped.includes(s)),'a skipped source is never asked');
 assert.deepEqual(result.unavailable,asked.filter(s=>!c.answering.includes(s)));
});
test('skills try the official Hiscores before Wise Old Man; the collection log combines',()=>{
 assert.deepEqual(SOURCE_ORDER.skills,['hiscores','wom']);assert.ok(COMBINED.has('collectionLog'));assert.ok(!COMBINED.has('skills'));
});
