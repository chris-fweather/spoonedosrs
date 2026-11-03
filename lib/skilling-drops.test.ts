import assert from 'node:assert/strict';
import test from 'node:test';
import {skillingDrops} from './skilling-drops.ts';
import {treeRunStats} from './farming-runs.ts';
import {initial,type Journal} from './model.ts';

function journal(skills:Journal['hiscores']['skills']=[]):Journal{const j=structuredClone(initial);j.hiscores.skills=skills;return j;}
const pet=(j:Journal,name:string)=>j.pets.find(p=>p.name===name)!;

test('a skilling pet lists every Wiki method at the player level, best chance first, with item art per row',()=>{
 const j=journal([{name:'Fishing',level:80,xp:2_000_000,rank:1}]),heron=pet(j,'Heron'),d=skillingDrops(heron,j)!;
 assert.equal(d.level,80);assert.equal(d.known,true);assert.equal(d.unit,'actions');
 assert.deepEqual(d.source.tabs.map(t=>t.h),['Per catch','Per game']);assert.deepEqual(d.source.tabs[1].r.map(r=>[r[0],r[2]]),[['Fishing Trawler','1/5,000']]);
 const rows=d.source.tabs[0].r;
 assert.equal(rows.length,39);
 assert.equal(rows.find(r=>r[0]==='Shark')![4],'/items/383.png');assert.equal(rows.find(r=>r[0]==='Sacred eel')![4],`/pets/${heron.id}.png`);
 const shrimps=rows.find(r=>r[0]==='Shrimps')!;assert.equal(shrimps[1],'1');assert.equal(shrimps[2],`1/${(870330-25*80).toLocaleString('en-US')}`);
 assert.ok(Math.abs(shrimps[3]!-1/(870330-2000))<1e-15);
 // Unlocked rows by chance, then rows above level 80 by level.
 const open=rows.filter(r=>Number(r[1])<=80),locked=rows.filter(r=>Number(r[1])>80);
 assert.deepEqual(rows,[...open,...locked]);
 for(let i=1;i<open.length;i++)assert.ok(open[i-1][3]!>=open[i][3]!);
 for(let i=1;i<locked.length;i++)assert.ok(Number(locked[i-1][1])<=Number(locked[i][1]));
 assert.ok(d.bar(1/5000)>99.999);assert.ok(d.bar(Math.min(...rows.map(r=>r[3]!)))<=8.0001);
});

test('without hiscores the table uses level 99 and says so',()=>{
 const j=journal(),d=skillingDrops(pet(j,'Giant Squirrel'),j)!;
 assert.equal(d.level,99);assert.equal(d.known,false);assert.equal(d.source.tabs[0].h,'Per lap');assert.equal(d.unit,'laps');
 assert.ok(d.source.tabs[0].r.some(r=>r[0]==='Ardougne Rooftop'&&r[2]===`1/${(34440-2475).toLocaleString('en-US')}`));
});

test('Tangleroot shows the tree run beside each crop; Rocky splits thefts and pickpockets',()=>{
 const j=journal([{name:'Farming',level:99,xp:13_034_431,rank:1}]),d=skillingDrops(pet(j,'Tangleroot'),j)!;
 assert.deepEqual(d.source.tabs.map(t=>t.h),['Per tree run','Per patch']);assert.equal(d.unit,'actions');
 const run=d.source.tabs[0].r[0];assert.equal(run[2],`1/${Math.round(treeRunStats(99).runsPerPet)}`);
 const r=skillingDrops(pet(j,'Rocky'),j)!;
 assert.deepEqual(r.source.tabs.map(t=>t.h).sort(),['Per action','Per pickpocket','Per theft']);
});

test('non-skilling pets have no skilling table; Soup uses its saved rates',()=>{
 const j=journal();
 assert.equal(skillingDrops(pet(j,'Vorki'),j),null);
 const soup=skillingDrops(pet(j,'Soup'),j)!;
 assert.ok(soup.source.tabs[0].r.some(r=>r[0]==='Sea charting'&&r[2]==='1/30,000'&&r[1]==='—'));
});

test('every row icon is official art that exists; courses use the Mark of grace',async()=>{
 const {existsSync}=await import('node:fs');
 const icons=(await import('./skilling-drop-icons.json',{with:{type:'json'}})).default as Record<string,Record<string,string>>;
 for(const [pet,rows] of Object.entries(icons))for(const [name,path] of Object.entries(rows))assert.ok(existsSync(new URL('../public'+path,import.meta.url)),`${pet} ${name}: ${path}`);
 const j=journal(),sq=skillingDrops(pet(j,'Giant Squirrel'),j)!;
 assert.ok(sq.source.tabs[0].r.every(r=>r[4]==='/items/11849.png'));
 const golem=skillingDrops(pet(j,'Rock golem'),j)!.source.tabs.flatMap(t=>t.r);
 assert.equal(golem.find(r=>r[0]==='Iron')![4],'/items/440.png');
 const tang=skillingDrops(pet(j,'Tangleroot'),j)!.source.tabs.flatMap(t=>t.r);
 assert.equal(tang.find(r=>r[0]==='Palm tree')![4],'/items/5974.png');assert.equal(tang.find(r=>r[0]==='Tree run')![4],'/items/1513.png');
});
