import assert from 'node:assert/strict';
import test from 'node:test';
import {cardGp,cardValue,eachLine,stackValue} from './item-price.ts';
test('a stack is worth the unit price times the amount',()=>{
 assert.equal(stackValue(30,90),2700);assert.equal(stackValue(null,90),null);assert.equal(stackValue(5,0),5);
 assert.equal(eachLine(136,3),'136 each');assert.equal(eachLine(1_250_000,3),'1.25M each');assert.equal(eachLine(30,1),null);assert.equal(eachLine(null,90),null);
});
test('with a quantity the card shows the total big and the unit price small',()=>{
 assert.deepEqual(cardValue(136,3),{big:'408',each:'136 each'});
 assert.deepEqual(cardValue(30,90),{big:'2,700',each:'30 each'});
 assert.deepEqual(cardValue(1_250_000,3),{big:'3.75M',each:'1.25M each'});
 assert.deepEqual(cardValue(136,1),{big:'136',each:null});
 assert.deepEqual(cardValue(null,3),{big:'—',each:null});
});
test('card values stay one short line',()=>{assert.equal(cardGp(999_999),'999,999');assert.equal(cardGp(12_450_000),'12.45M');assert.equal(cardGp(1_200_000_000),'1.2B');assert.equal(cardGp(null),'—');});
