import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildGuideTravel} from '../scripts/build-guide-travel.mjs';
import {GUIDE_TRAVEL,guideTravel,travelMapHref,travelSnippetTiles,travelTitle,travelWhat} from './guide-travel';

test('the travel catalogue is built from the world map data as it stands',()=>{
 const read=(f:string)=>JSON.parse(readFileSync('public/world-map/'+f,'utf8'));
 assert.deepEqual(JSON.parse(readFileSync('lib/guide-travel.json','utf8')),buildGuideTravel(read('travel.json'),read('places.json')),'Run node scripts/build-guide-travel.mjs');
 // Every fairy ring code the map has, and every spirit tree.
 assert.equal(GUIDE_TRAVEL.filter(t=>t.kind==='fairy').length,53);
 assert.ok(GUIDE_TRAVEL.filter(t=>t.kind==='spirit').length>=13);
});
test('destinations resolve by name: spells, fairy ring codes and transport stops',()=>{
 const fally=guideTravel('Falador Teleport')!;
 assert.deepEqual([fally.kind,fally.area,fally.x,fally.y,fally.plane],['spell','Falador',2964,3378,0]);
 assert.equal(travelWhat(fally),'Standard spellbook · 37 Magic');
 assert.equal(travelMapHref(fally),'/map?at=2964,3378,0&zoom=10');
 const blp=guideTravel('blp')!;
 assert.equal(blp.kind,'fairy');assert.equal(travelTitle(blp),'TzHaar area');assert.equal(travelWhat(blp),'Fairy ring · BLP');
 assert.equal(guideTravel('Fairy ring CIP')?.name,'CIP');assert.equal(guideTravel('CIP fairy ring')?.name,'CIP');
 assert.deepEqual(guideTravel('CIP')?.req,{q:['The Fremennik Trials']});
 for(const n of ['Grand Exchange spirit tree','Spirit tree: Grand Exchange','Spirit tree (Grand Exchange)'])assert.equal(guideTravel(n)?.kind,'spirit',n);
 // A place on its own is not its transport stop, and invalid codes (AKG) are nothing.
 assert.equal(guideTravel('Grand Exchange'),null);assert.equal(guideTravel('AKG'),null);
 assert.equal(travelTitle(guideTravel('Amulet of glory: Edgeville')!),'Edgeville');
});
test('the map snippet asks for the squares around the landing spot, as the world map lays them out',()=>{
 const tiles=travelSnippetTiles({x:2964,y:3378,plane:0},296,160);
 // At tile zoom 2 a square is 64 game tiles: Falador's landing spot is in square 46, 52 (x 2944–3007, y 3328–3391).
 const home=tiles.find(t=>t.src==='/api/map-tile?z=2&p=0&x=46&y=52');
 assert.ok(home);assert.ok(home.left<=148&&148<home.left+256&&home.top<=80&&80<home.top+256);
 // The view is covered: every pixel falls in one square.
 for(const [px,py] of [[0,0],[295,0],[0,159],[295,159]])assert.equal(tiles.filter(t=>t.left<=px&&px<t.left+256&&t.top<=py&&py<t.top+256).length,1);
});
