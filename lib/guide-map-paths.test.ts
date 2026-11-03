import {test} from 'node:test';
import assert from 'node:assert/strict';
import {midpointOnLine,pathKey,walkLinks,walkingPath,type WalkLinks} from './guide-map-paths';
import type {Collision,TravelData,TravelEdge} from './world-map-routing';

// A tiny world from text: '#' is blocked, '.' is open; the top row is the highest y. Origin at (1000,1000), plane 0.
const X0=1000,Y0=1000;
function world(rows:string[]):Collision{
 const open=(x:number,y:number)=>{const r=rows[rows.length-1-(y-Y0)],ch=r?.[x-X0];return ch==='.'||ch==='S'||ch==='T';};
 return {flag:(x,y,p,f)=>p===0&&open(x,y)&&(f===0?open(x,y+1):open(x+1,y))};
}
const at=(rows:string[],ch:string)=>{for(let i=0;i<rows.length;i++){const x=rows[i].indexOf(ch);if(x>=0)return {x:X0+x,y:Y0+rows.length-1-i,plane:0};}throw Error(ch);};
const none:WalkLinks=new Map();
const blocked=(rows:string[],[x,y]:[number,number])=>rows[rows.length-1-(y-Y0)]?.[x-X0]==='#';
/** Every tile the drawn line passes through, by stepping along each straight piece. */
function tilesOf(points:[number,number][]){const out:[number,number][]=[];for(let i=1;i<points.length;i++){const [ax,ay]=points[i-1],[bx,by]=points[i],n=Math.max(Math.abs(bx-ax),Math.abs(by-ay));for(let k=0;k<=n;k++)out.push([ax+Math.round((bx-ax)*k/n),ay+Math.round((by-ay)*k/n)]);}return out;}

test('an open walk is one straight line from stop to stop',()=>{
 const rows=['..........','.S......T.','..........'];
 assert.deepEqual(walkingPath(world(rows),none,at(rows,'S'),at(rows,'T')),[[1001,1001],[1008,1001]]);
});
test('a walk goes round a wall through the gap, never through it',()=>{
 const rows=[
  '...........',
  '.....#.....',
  '.S...#...T.',
  '.....#.....',
  '.....#.....',
  '...........'];
 const path=walkingPath(world(rows),none,at(rows,'S'),at(rows,'T'))!;
 assert.ok(path);
 assert.ok(path.length>2,'it turns');
 for(const t of tilesOf(path))assert.ok(!blocked(rows,t),`crosses the wall at ${t}`);
 assert.deepEqual(path[0],[1001,1003]);assert.deepEqual(path.at(-1),[1009,1003]);
});
test('water with no way round keeps the straight line',()=>{
 const rows=['....#####....','.S..#####..T.','....#####....'];
 assert.equal(walkingPath(world(rows),none,at(rows,'S'),at(rows,'T')),null);
});
test('a door or shortcut crosses a wall on the same floor',()=>{
 const rows=['....#......','.S..#....T.','....#......'];
 const data={kinds:['passage','boat'],edges:[
  [1003,1001,0,1005,1001,0,1,0,0,0,0],// the door
  [1001,1000,0,1007,1000,0,1,1,0,0,0],// a boat is not a walk
  [1003,1000,0,1005,1000,1,1,0,0,0,0],// stairs change floor
  [1003,1002,0,1003,7400,0,1,0,0,0,0],// a trapdoor to a dungeon is too far to be a walk
 ] as TravelEdge[]} as Pick<TravelData,'kinds'|'edges'>;
 const links=walkLinks(data);
 assert.equal(links.size,1);
 assert.equal(walkingPath(world(rows),none,at(rows,'S'),at(rows,'T')),null,'no way through without the door');
 assert.deepEqual(walkingPath(world(rows),links,at(rows,'S'),at(rows,'T')),[[1001,1001],[1009,1001]]);
});
test('a long way round (a lake the guide crosses by boat) keeps the straight line',()=>{
 // S and T are 2 tiles apart, but the way round is about 60 tiles: more than 5× the distance plus 40.
 const rows=['S'+'.'.repeat(99),'#'.repeat(30)+'.'+'#'.repeat(69),'T'+'.'.repeat(99)];
 assert.equal(walkingPath(world(rows),none,at(rows,'S'),at(rows,'T')),null);
 const near=['S'+'.'.repeat(99),'#'.repeat(10)+'.'+'#'.repeat(89),'T'+'.'.repeat(99)];
 assert.ok(walkingPath(world(near),none,at(near,'S'),at(near,'T')),'a short way round is walked');
});
test('stops on different floors or far apart have no walking path',()=>{
 const rows=['.S..T.'],c=world(rows),s=at(rows,'S'),t=at(rows,'T');
 assert.equal(walkingPath(c,none,s,{...t,plane:1}),null);
 assert.equal(walkingPath(c,none,s,{...t,x:t.x+400}),null);
});
test('a stop on a blocked tile (a patch, an NPC behind a counter) starts from its side facing the next stop',()=>{
 const rows=['.....','.#...','.##.T','.##..'];
 const stop={x:1002,y:1001,plane:0};
 const path=walkingPath(world(rows),none,stop,at(rows,'T'))!;
 assert.deepEqual(path[0],[1002,1001]);
 assert.deepEqual(path[1],[1003,1001]);
 assert.deepEqual(path.at(-1),[1004,1001]);
});
test('a stop behind a locked door or bars is reached from the nearest tile the walk gets to',()=>{
 const door=['#####','#.S.#','##.##','#.T.#','#####'];
 // T is fenced off from the corridor tile beside it; the walk ends next to it and the line reaches it.
 const c=world(door),fenced:Collision={flag:(x,y,p,f)=>!(x===1002&&y===1001&&f===0)&&c.flag(x,y,p,f)};
 assert.deepEqual(walkingPath(fenced,none,at(door,'S'),at(door,'T')),[[1002,1003],[1002,1002],[1002,1001]]);
 const cell=['.S.......','#########','#########','#.T.#####','#########'];
 assert.deepEqual(walkingPath(world(cell),none,at(cell,'S'),at(cell,'T')),[[1001,1004],[1002,1004],[1002,1001]],'a cell three tiles in');
 const far=['.S.......',...Array(4).fill('#########'),'#.T.#####','#########'];
 assert.equal(walkingPath(world(far),none,at(far,'S'),at(far,'T')),null,'too far from anywhere walkable');
});
test('legs are cached by their two tiles',()=>{
 assert.equal(pathKey({x:1,y:2,plane:0},{x:3,y:4,plane:1}),'1,2,0>3,4,1');
});
test('the direction arrow sits halfway along the drawn line',()=>{
 assert.equal(midpointOnLine([{x:0,y:0}]),null);
 assert.deepEqual(midpointOnLine([{x:0,y:0},{x:10,y:0},{x:10,y:30}]),{x:10,y:10,degrees:90,length:40});
 assert.deepEqual(midpointOnLine([{x:0,y:0},{x:-8,y:0}]),{x:-4,y:0,degrees:180,length:8});
});
