import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {alternativesLabel,diaryRequirementGroups,itemName,noteLines,questItemQuantity,requirementCompletion,type DiaryItemTile} from './adventure-requirements.ts';
const quests=["The Knight's Sword","Doric's Quest"];
const skills=['Agility','Strength','Ranged'];
test('diary requirements use the same skill, quest and item groups without losing item conditions',()=>{
 const itemLine='Mith grapple and any crossbow';
 const items:Record<string,DiaryItemTile[]>={[itemLine]:[{items:[{id:9419,name:'Mith grapple'}]},{text:'Any crossbow'}]};
 const groups=diaryRequirementGroups(['*Agility 11, Strength 37, and Ranged 19',"*Quest Completion of The Knight's Sword",'*'+itemLine,'None'],quests,skills,items);
 assert.deepEqual(groups.skills.map(r=>[r.skill,r.level]),[['Agility',11],['Strength',37],['Ranged',19]]);
 assert.deepEqual(groups.quests,[{label:"The Knight's Sword",quest:"The Knight's Sword"}]);
 assert.deepEqual(groups.items,[{label:'Mith grapple',items:[{id:9419,name:'Mith grapple'}]}]);assert.deepEqual(groups.notes,['Any crossbow']);
});
test('a diary line naming several items becomes one tile per item, with amounts and capitalised names',()=>{
 const line='Teasing stick, logs, and a knife',coins='Rusty sword and 100 coins';
 const items:Record<string,DiaryItemTile[]>={[line]:[{items:[{id:10029,name:'Teasing stick'}]},{items:[{id:1511,name:'logs'}]},{items:[{id:946,name:'Knife'}]}],[coins]:[{items:[{id:686,name:'Rusty sword'}]},{items:[{id:995,name:'coins'}],quantity:100}]};
 const groups=diaryRequirementGroups(['*'+line,'*'+coins],quests,skills,items);
 assert.deepEqual(groups.items.map(r=>[r.label,r.quantity??1]),[['Teasing stick',1],['Logs',1],['Knife',1],['Rusty sword',1],['Coins',100]]);
 assert.equal(alternativesLabel([{id:772,name:'Dramen staff'},{id:9084,name:'Lunar staff'}]),'Dramen staff or Lunar staff');
 assert.equal(alternativesLabel([{id:1,name:'a'},{id:2,name:'b'},{id:3,name:'c'}]),'A, B or C');
});
// The shipped diary item data: no tile may be several items run together into one name.
const DIARY_ITEMS=JSON.parse(readFileSync(new URL('./diary-requirement-items.json',import.meta.url),'utf8')) as Record<string,DiaryItemTile[]>;
type DiaryAreas={areas:Record<string,{tiers:{tasks:{requirements:string}[]}[]}>};
const DIARY_AREAS=(JSON.parse(readFileSync(new URL('./diary-tasks.json',import.meta.url),'utf8')) as DiaryAreas).areas;
const DIARY_LINES=new Set<string>();
for(const area of Object.values(DIARY_AREAS))for(const tier of area.tiers)for(const task of tier.tasks)for(const l of task.requirements.split('\n'))DIARY_LINES.add(l.replace(/[ \t]{2,}/g,' ').replace(/^\*+\s*/,'').trim().replace(/^Quest\s+(?!point\b)/,''));
test('diary requirement items are split: short single names, no list separators, an icon each',()=>{
 let tiles=0;
 for(const [line,row] of Object.entries(DIARY_ITEMS)){
  assert.ok(DIARY_LINES.has(line),'Unmatched requirement line: '+line);
  if(!row.length){assert.match(line,/^(?:See |Various other skill)/,'Only Wiki guide links and headings are dropped: '+line);continue;}
  for(const tile of row){
   if('text' in tile){assert.ok(tile.text.trim().length>0,line);continue;}
   if(!('items' in tile))continue;
   tiles++;assert.ok(tile.items.length>=1,line);
   assert.equal(new Set(tile.items.map(i=>i.id)).size,tile.items.length,'Duplicate item in '+line);
   if(tile.quantity!==undefined)assert.ok(Number.isInteger(tile.quantity)&&tile.quantity>1,'Quantity in '+line);
   for(const item of tile.items){
    assert.ok(Number.isInteger(item.id)&&item.id>0,line);
    assert.ok(existsSync(new URL(`../public/items/${item.id}.png`,import.meta.url)),`No icon for ${item.id} in ${line}`);
    assert.ok(item.name.length<=32,`Item name too long (merged?): "${item.name}" in ${line}`);
    assert.doesNotMatch(item.name,/,|;|\band\b|\bor\b|^\d/,`Item name looks merged: "${item.name}" in ${line}`);
    assert.equal(item.name,itemName(item.name),`Item name not capitalised: "${item.name}"`);
   }
  }
 }
 assert.ok(tiles>300,'Expected the diary item tiles to be present');
 const kyatt=DIARY_ITEMS['Teasing stick, logs, and a knife'].map(t=>'items' in t?t.items.map(i=>i.name).join('/'):t.text);
 assert.deepEqual(kyatt,['Teasing stick','Logs','Knife']);
 const balloon=DIARY_ITEMS['If the route has not been unlocked yet, 11 total yew logs are required to unlock it before flying again to Castle Wars to complete this task. Upon unlocking the route, you may use 1 normal log to depart to Taverley before returning to Castle Wars for the task completion.'];
 assert.deepEqual(balloon,[{text:'First time: 11 yew logs to unlock the route'},{text:'Then fly to Taverley (1 log) and back'}]);
});
test('one-time and conditional extras read as short notes, never as item tiles with "to …" notes',()=>{
 for(const [line,row] of Object.entries(DIARY_ITEMS))for(const tile of row){
  if('items' in tile&&!tile.label?.startsWith('Any '))assert.doesNotMatch(tile.note??'',/\b(?:if|unless|until|only|first)\b/i,`Conditional item tile in: ${line}`);
 }
 const groups=diaryRequirementGroups(['*Yew log','*'+Object.keys(DIARY_ITEMS).find(l=>l.startsWith('If the route has not been unlocked'))!],quests,skills,DIARY_ITEMS);
 assert.deepEqual(groups.items.map(r=>[r.label,r.quantity??1]),[['Yew logs',1]]);
 assert.deepEqual(groups.notes,['First time: 11 yew logs to unlock the route','Then fly to Taverley (1 log) and back']);
 const pets=DIARY_ITEMS["30,000 coins, 4 oak planks, saw, and hammer to construct a menagerie with a pet house, if you haven't already"];
 assert.equal(pets.length,1);assert.ok('text' in pets[0]&&/^Menagerie not built yet:/.test(pets[0].text));
});
test('quest item amounts come from the Wiki item list',()=>{
 const text='* Hammer\n* 90 steel nails (Members can buy these)\n* 3 planks (only normal planks work)\n* 2,000 coins';
 assert.equal(questItemQuantity(text,'Steel nails'),90);assert.equal(questItemQuantity(text,'Plank'),3);
 assert.equal(questItemQuantity(text,'Coins'),2000);assert.equal(questItemQuantity(text,'Hammer'),1);assert.equal(questItemQuantity(undefined,'Hammer'),1);
});
test('OR conditions stay notes; partial and started quests are quest tiles that only claim what the quest list proves',()=>{
 const lines=["Quest Completion of The Knight's Sword or Doric's Quest","Quest Partial completion of The Knight's Sword",'Started the Doric\'s Quest.'];
 const groups=diaryRequirementGroups(lines,quests,skills,{});
 assert.deepEqual(groups.notes,["Completion of The Knight's Sword or Doric's Quest"]);
 assert.deepEqual(groups.quests,[{label:"The Knight's Sword",quest:"The Knight's Sword",stage:'partial',note:'Partial'},{label:"Doric's Quest",quest:"Doric's Quest",stage:'started',note:'Started'}]);
 const [partial,started]=groups.quests,state=(s:string)=>[{name:"The Knight's Sword",state:s,points:1},{name:"Doric's Quest",state:s,points:1}];
 assert.equal(requirementCompletion(partial,[],state('finished')),true);
 assert.equal(requirementCompletion(partial,[],state('started')),null);
 assert.equal(requirementCompletion(partial,[],state('not_started')),false);
 assert.equal(requirementCompletion(started,[],state('started')),true);
 assert.equal(requirementCompletion(started,[],undefined),null);
 assert.equal(requirementCompletion({label:'60 Agility',skill:'Agility',level:60,noCheck:true},[{name:'Agility',level:1}],undefined),null);
});
test('diary lines name quests as written, with or without "the", "quest" or a final full stop',()=>{
 const names=['The Golem','Troll Stronghold','Waterfall Quest','Another Slice of H.A.M.'];
 const groups=diaryRequirementGroups(['Quest Completion of The Golem','Partial completion of the Troll Stronghold','Started Waterfall Quest','Completion of Another Slice of H.A.M.','Combat 40','Agility 40 recommended'],names,skills,{});
 assert.deepEqual(groups.quests.map(q=>q.quest),names);
 assert.deepEqual(groups.skills,[{label:'40 Combat',skill:'Combat',level:40},{label:'40 Agility',skill:'Agility',level:40,note:'Recommended'}]);
 assert.deepEqual(groups.notes,[]);
});
test('notes read one sentence a line, without "Note:", empty brackets, full stops or Deadman Mode variants',()=>{
 assert.deepEqual(noteLines('Note: Talk to him in W. Ardougne. It takes a while!\n\nIn Deadman Mode, the task differs.'),['Talk to him in W. Ardougne','It takes a while!']);
 assert.deepEqual(noteLines('Means to cast Telegrab ( )'),['Means to cast Telegrab']);
 assert.deepEqual(noteLines('This task is automatically completed during Between a Rock....'),['This task is automatically completed during Between a Rock...']);
});
test('every diary task shows tiles and short notes: known quests and skills, no Wiki links, no long requirement prose',()=>{
 const questNames=Object.keys((JSON.parse(readFileSync(new URL('./quest-reference.json',import.meta.url),'utf8')) as {quests:Record<string,unknown>}).quests);
 const skillNames=['Attack','Strength','Defence','Ranged','Prayer','Magic','Runecraft','Construction','Hitpoints','Agility','Herblore','Thieving','Crafting','Fletching','Slayer','Hunter','Mining','Smithing','Fishing','Cooking','Firemaking','Woodcutting','Farming','Sailing'];
 for(const area of Object.values(DIARY_AREAS))for(const tier of area.tiers)for(const task of tier.tasks){
  const groups=diaryRequirementGroups(task.requirements.split('\n'),questNames,skillNames,DIARY_ITEMS);
  for(const s of groups.skills)assert.ok(s.skill&&s.level,'Skill tile without a skill: '+s.label);
  for(const q of groups.quests)assert.ok(q.quest&&questNames.includes(q.quest)||q.points!=null,'Quest tile without a quest: '+q.label);
  for(const note of groups.notes){
   assert.ok(note.length<=52,`Requirement note too long (${note.length}): ${note}`);
   assert.doesNotMatch(note,/^See |\(\s*\)|^Note:/,'Leftover Wiki text: '+note);
   assert.doesNotMatch(note,/^(?:Any (?:axe|pickaxe|crossbow|light source)|Light source)$/i,'Item left as a note: '+note);
  }
  for(const row of [...groups.skills,...groups.quests,...groups.items])assert.ok((row.note??'').length<=48,`Tile note too long: ${row.note}`);
 }
});
test('known quest and skill completion is green; missing or private data remains unknown',()=>{
 const skill={label:'11 Agility',skill:'Agility',level:11};
 assert.equal(requirementCompletion(skill,[{name:'Agility',level:15}],undefined),true);
 assert.equal(requirementCompletion(skill,[{name:'Agility',level:5}],undefined),false);
 assert.equal(requirementCompletion(skill,[],undefined),null);
 const quest={label:"The Knight's Sword",quest:"The Knight’s Sword"};
 assert.equal(requirementCompletion(quest,[],[{name:"The Knight's Sword",state:'finished',points:1}]),true);
 assert.equal(requirementCompletion(quest,[],undefined),null);
 const qp=diaryRequirementGroups(['Quest 32'],quests,skills,{}).quests[0];
 assert.equal(qp.points,32);assert.equal(requirementCompletion(qp,[],undefined),null);
 assert.equal(requirementCompletion(qp,[],[{name:'Known',state:'finished',points:33}]),true);
});
