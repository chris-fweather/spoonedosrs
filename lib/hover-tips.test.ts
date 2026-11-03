import {test} from 'node:test';
import assert from 'node:assert/strict';
import {claimTip,openTip,releaseTip,tipTakesPointer} from './hover-tips';

test('one hover card at a time: opening one closes the other at once',()=>{
 const closed:string[]=[];
 const attack={close:()=>closed.push('attack')},strength={close:()=>closed.push('strength')};
 claimTip(attack);assert.equal(openTip(),attack);assert.deepEqual(closed,[]);
 claimTip(strength);assert.deepEqual(closed,['attack']);assert.equal(openTip(),strength);
 // Opening the same card again closes nothing; releasing another card leaves the open one alone.
 claimTip(strength);releaseTip(attack);assert.deepEqual(closed,['attack']);assert.equal(openTip(),strength);
 releaseTip(strength);assert.equal(openTip(),null);
});
test('a card takes the pointer only when it comes from its own trigger, not over a neighbour',()=>{
 const card={left:100,top:100,right:420,bottom:320};
 assert.equal(tipTakesPointer({x:200,y:150},card,{fromTrigger:true,overOtherTrigger:false}),true);
 // The next requirement row under the card wins.
 assert.equal(tipTakesPointer({x:200,y:150},card,{fromTrigger:true,overOtherTrigger:true}),false);
 assert.equal(tipTakesPointer({x:200,y:150},card,{fromTrigger:false,overOtherTrigger:false}),false);
 assert.equal(tipTakesPointer({x:90,y:150},card,{fromTrigger:true,overOtherTrigger:false}),false);
});
