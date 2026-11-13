import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_PAGE_SIZES,boardPageSize} from './community.ts';

test('leaderboards show 10, 15, 20 or 25 players per page, and nothing else',()=>{
 assert.deepEqual([...BOARD_PAGE_SIZES],[10,15,20,25,35,40]);
 for(const n of BOARD_PAGE_SIZES){assert.equal(boardPageSize(n),n);assert.equal(boardPageSize(String(n)),n);}
 for(const bad of ['12','100','0','-10','abc',null,undefined,''])assert.equal(boardPageSize(bad),null,String(bad));
});
