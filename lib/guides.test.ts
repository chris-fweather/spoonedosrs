import assert from 'node:assert/strict';
import test from 'node:test';
import {emptyGuide,parseGuide,mayEditGuide,guideItems,guideSetups,newGuideSetup,guideQuests,guideDiaryAreas,guideTextBlocks,guideLeafBlocks,guideHeadings,guideSectionSetups,guideInline,guideLeadingQuantity,guideMentionQuantities,guideSlotStack,guideInventoryItems,GUIDE_MAX_STACK} from './guides.ts';
import {wearables} from './flair.ts';
import {planningCatalogue,parsePlanning,applyPlanning} from './planning-catalogue.ts';
import {initial} from './model.ts';
const valid=()=>({...emptyGuide(),title:'Kraken setup',activity:'Kraken',summary:'A sample inventory and equipment setup.',strategy:'Use this strategy with your preferred combat setup.'});
test('guide authors edit their own drafts; admins maintain others',()=>{assert.equal(mayEditGuide('helper','a','a'),true);assert.equal(mayEditGuide('moderator','b','a'),false);assert.equal(mayEditGuide('admin','b','a'),true);});
test('guide payloads validate gear slots and inventory IDs, retain text as text',()=>{const g=valid();g.strategy='<script>alert(1)</script> is rendered as plain text.';g.inventory[0]=Object.keys(guideItems)[0];assert.equal(parseGuide(g).strategy,g.strategy);assert.throws(()=>parseGuide({...g,inventory:Array(29).fill(null)}));assert.throws(()=>parseGuide({...g,inventory:['javascript:bad',...Array(27).fill(null)]}));const item=Object.entries(wearables.items).find(([,i])=>i.slot!=='head')!;assert.throws(()=>parseGuide({...g,equipment:{...g.equipment,head:item[0]}}));});
test('planning edits never turn observed XP into odds or overwrite custom pace',()=>{const target=planningCatalogue().find(t=>t.pace!==null)!;assert.throws(()=>parsePlanning(target.key,NaN,null));assert.throws(()=>parsePlanning('unknown',20,null));const p=parsePlanning(target.key,37,2000000);const j=structuredClone(initial),pet=j.pets.find(x=>x.name===target.pet)!,m=pet.methods.find(x=>x.name===target.method)!,rate=m.rate;applyPlanning(j,target.key,p,'https://example.com',1);assert.equal(m.kph,37);assert.equal(m.rate,rate);m.kph=38;m.source='Personal pace';applyPlanning(j,target.key,p,'https://example.com',2);assert.equal(m.kph,38);});

test('legacy guide upgrades to one setup while named loadouts remain independent',()=>{
 const g=valid(),id=Object.keys(guideItems)[0];g.inventory[0]=id;
 const legacy=parseGuide(g);assert.equal(guideSetups(legacy).length,1);assert.equal(guideSetups(legacy)[0].inventory[0],id);
 const budget=newGuideSetup('Budget','budget'),endgame=newGuideSetup('Endgame','endgame');budget.inventory[1]=id;
 const current=parseGuide({...g,setups:[budget,endgame],requiredQuests:[guideQuests[0]],requiredDiaries:[{area:guideDiaryAreas[0],tier:'Hard'}]});
 assert.equal(current.setups?.length,2);assert.equal(current.setups?.[1].inventory[1],null);assert.equal(current.inventory[1],id);assert.equal(current.requiredQuests?.[0],guideQuests[0]);assert.equal(current.requiredDiaries?.[0].tier,'Hard');
 assert.throws(()=>parseGuide({...g,setups:[budget,{...endgame,id:'budget'}]}));assert.throws(()=>parseGuide({...g,setups:[budget,{...endgame,name:'BUDGET'}]}));assert.throws(()=>parseGuide({...g,setups:Array(9).fill(budget)}));
});
test('quest and diary attachments are catalogue validated, not arbitrary payloads',()=>{
 const g=valid();assert.throws(()=>parseGuide({...g,requiredQuests:['Invented quest']}));assert.throws(()=>parseGuide({...g,requiredQuests:[guideQuests[0],guideQuests[0]]}));assert.throws(()=>parseGuide({...g,requiredDiaries:[{area:guideDiaryAreas[0],tier:'Impossible'}]}));assert.throws(()=>parseGuide({...g,requiredDiaries:[null]}));
});
test('rich guide formatting is limited to safe text blocks',()=>{
 const blocks=guideTextBlocks('## Positioning\n- First step\n- **Protect** from attacks\n<script>alert(1)</script>');assert.deepEqual(blocks.map(b=>b.kind),['heading','list','paragraph']);assert.deepEqual(blocks[1].items,['First step','**Protect** from attacks']);assert.equal(blocks[2].text,'<script>alert(1)</script>');
});


test('document sections are allowlisted, bounded and reference validated loadouts',()=>{
 const input={...emptyGuide(),title:'Document guide',activity:'Kraken',summary:'A document test with safe structured sections.',strategy:'This document explains a safe and repeatable strategy.'};
 const blocks=[{id:'intro',kind:'text',text:'A paragraph',style:'heading',tone:'gold',html:'<script>bad()</script>'},{id:'gear',kind:'gear',setupId:'recommended'},{id:'chart',kind:'odds',name:'Pet odds',rate:3000,count:775,unit:'kills'}];
 const parsed=parseGuide({...input,blocks});assert.equal(parsed.blocks?.length,3);assert.equal('html' in parsed.blocks![0],false);
 for(const bad of [{...blocks[0],tone:'javascript:red'},{...blocks[0],style:'script'},{...blocks[1],setupId:'missing'},{...blocks[2],rate:0},{...blocks[2],count:1.5},{...blocks[2],unit:'HTML'},{...blocks[0],text:'x'.repeat(16001)}])assert.throws(()=>parseGuide({...input,blocks:[bad]}));
 assert.throws(()=>parseGuide({...input,blocks:[blocks[0],blocks[0]]}));
 assert.throws(()=>parseGuide({...input,blocks:Array.from({length:101},(_,i)=>({id:'section'+i,kind:'divider'}))}));
});
test('drop tables show on their own, tiers can carry an inventory card, and custom requirements take a plain icon',()=>{
 const input={...emptyGuide(),title:'Document guide',activity:'Kraken',summary:'A document test with safe structured sections.',strategy:'This document explains a safe and repeatable strategy.'};
 const drops=parseGuide({...input,blocks:[{id:'d',kind:'drops',page:' Kraken ',highlight:['pet kraken']}]}).blocks![0];
 assert.deepEqual(drops,{id:'d',kind:'drops',page:'Kraken'});
 const tiers=parseGuide({...input,blocks:[{id:'t',kind:'loadouts',setupIds:['recommended'],inventoryId:'recommended'}]}).blocks![0];
 assert.deepEqual(tiers,{id:'t',kind:'loadouts',setupIds:['recommended'],inventoryId:'recommended'});
 assert.throws(()=>parseGuide({...input,blocks:[{id:'t',kind:'loadouts',setupIds:['recommended'],inventoryId:'missing'}]}));
 const other=parseGuide({...input,requiredOther:[{label:'Slayer task',itemId:null,icon:'slayer'},{label:'Anything else',itemId:null,icon:'task'}]}).requiredOther;
 assert.deepEqual(other,[{label:'Slayer task',itemId:null,icon:'slayer'},{label:'Anything else',itemId:null}]);
 assert.throws(()=>parseGuide({...input,requiredOther:[{label:'Bad icon',itemId:null,icon:'javascript:'}]}));
});
test('two columns hold one section on each side, or nothing yet, and never nest',()=>{
 const input={...emptyGuide(),title:'Columns guide',activity:'Giant Mole',summary:'A document test with sections side by side.',strategy:'This document explains a safe and repeatable strategy.'};
 const drops={id:'d',kind:'drops',page:'Giant Mole'},odds={id:'o',kind:'odds',name:'Baby mole',rate:3000,count:3000,unit:'kills'};
 const pair={id:'c',kind:'columns',split:'2:1',columns:[drops,odds]};
 const parsed=parseGuide({...input,blocks:[{id:'t',kind:'text',text:'Intro',style:'body',tone:'default'},pair]});
 assert.deepEqual(parsed.blocks?.[1],pair);
 assert.deepEqual(parseGuide({...input,blocks:[{...pair,columns:[null,null]}]}).blocks?.[0],{...pair,columns:[null,null]});
 assert.equal(guideLeafBlocks(parsed.blocks!).map(b=>b.id).join(),'t,d,o');
 // Text inside a column counts towards the guide's text, and lands in the strategy the editor saves.
 const text={id:'x',kind:'text',text:'y'.repeat(9000),style:'body',tone:'default'};
 assert.throws(()=>parseGuide({...input,blocks:[{...text,id:'a'},{...pair,columns:[text,null]}]}));
 for(const bad of [
  {...pair,split:'3:1'},{...pair,columns:[drops]},{...pair,columns:[drops,odds,null]},{...pair,columns:'drops'},
  {...pair,columns:[{...pair,id:'inner'},null]},{...pair,columns:[{id:'hr',kind:'divider'},null]},
  {...pair,columns:[{...drops,kind:'html'},null]},{...pair,columns:[drops,{...drops}]},{...pair,columns:[{...odds,id:'c'},null]},
  {...pair,columns:[{id:'g',kind:'gear',setupId:'missing'},null]},
 ])assert.throws(()=>parseGuide({...input,blocks:[bad]}),JSON.stringify(bad));
 // Section IDs are unique across the whole document, columns included.
 assert.throws(()=>parseGuide({...input,blocks:[drops,{...pair,id:'c2',columns:[{...drops},null]}]}));
});
test('recommended skills and items sit apart from requirements and older guides have none',()=>{
 const g=valid(),id=Object.keys(guideItems)[0];
 assert.equal('recommendedSkills' in parseGuide(g),false);
 const rec=parseGuide({...g,requiredSkills:[{skill:'Prayer',level:43}],recommendedSkills:[{skill:'Attack',level:70},{skill:'Prayer',level:70}],recommendedItems:[{id,quantity:2}]});
 assert.deepEqual(rec.recommendedSkills,[{skill:'Attack',level:70},{skill:'Prayer',level:70}]);assert.deepEqual(rec.recommendedItems,[{id,quantity:2}]);assert.equal(rec.requiredSkills?.[0].level,43);
 for(const bad of [{recommendedSkills:[{skill:'Cooking',level:100}]},{recommendedSkills:[{skill:'Invented',level:5}]},{recommendedSkills:[{skill:'Attack',level:70},{skill:'Attack',level:60}]},{recommendedSkills:'70 Attack'},{recommendedItems:[{id:'not-an-item',quantity:1}]},{recommendedItems:[{id,quantity:0}]}])assert.throws(()=>parseGuide({...g,...bad}));
});
test('guide headings give readable, unique anchors for the contents list',()=>{
 const t=(id:string,text:string,style='heading')=>({id,kind:'text' as const,text,style:style as 'heading',tone:'default' as const});
 const blocks=[t('a','Why **Giant Mole**?'),t('b','Body text','body'),t('c','The fight'),t('d',"Thalzar's piece",'subheading'),{id:'e',kind:'columns' as const,split:'1:1' as const,columns:[t('f','The fight'),null] as [ReturnType<typeof t>,null]},t('g','  ')];
 assert.deepEqual(guideHeadings(blocks),[{blockId:'a',anchor:'why-giant-mole',text:'Why Giant Mole?',level:2},{blockId:'c',anchor:'the-fight',text:'The fight',level:2},{blockId:'d',anchor:'thalzars-piece',text:"Thalzar's piece",level:3},{blockId:'f',anchor:'the-fight-2',text:'The fight',level:2}]);
});
test('item names read with their in-game capital letter',()=>{const lower=Object.entries(guideItems).filter(([,name])=>/^[a-z]/.test(name));assert.deepEqual(lower,[]);assert.equal(guideItems['995'],'Coins');});

test('gear and inventory sections show their setups as tabs; older sections parse unchanged',()=>{
 const input={...emptyGuide(),title:'Tabs guide',activity:'Vorkath',summary:'A document test with setups shown as tabs.',strategy:'This document explains a safe and repeatable strategy.'};
 const setups=[newGuideSetup('Budget','budget'),newGuideSetup('Mid','mid'),newGuideSetup('Max','max')];
 // Saved before tabs: a loadouts section with a shared inventory, and gear and inventory sections with one setup each, in columns.
 const old=parseGuide({...input,setups,blocks:[{id:'tiers',kind:'loadouts',setupIds:['budget','mid','max'],inventoryId:'mid'},{id:'cols',kind:'columns',split:'1:1',columns:[{id:'g',kind:'gear',setupId:'max'},{id:'i',kind:'inventory',setupId:'max'}]}]});
 const [tiers,cols]=old.blocks!;
 assert.deepEqual(tiers,{id:'tiers',kind:'loadouts',setupIds:['budget','mid','max'],inventoryId:'mid'});
 assert.deepEqual(guideLeafBlocks(old.blocks!).map(b=>guideSectionSetups(b)),[['budget','mid','max'],['max'],['max']]);
 assert.equal(cols.kind,'columns');
 // Tabs on a gear or inventory section: the first tab is its setupId; one tab is stored as setupId alone.
 const gear=parseGuide({...input,setups,blocks:[{id:'g',kind:'gear',setupId:'budget',setupIds:['mid','max']}]}).blocks![0];
 assert.deepEqual(gear,{id:'g',kind:'gear',setupId:'mid',setupIds:['mid','max']});
 assert.deepEqual(guideSectionSetups(gear as never),['mid','max']);
 assert.deepEqual(parseGuide({...input,setups,blocks:[{id:'i',kind:'inventory',setupId:'max',setupIds:['max']}]}).blocks![0],{id:'i',kind:'inventory',setupId:'max'});
 for(const setupIds of [[],['mid','mid'],['mid','missing'],'mid',Array(9).fill('mid'),[1]])assert.throws(()=>parseGuide({...input,setups,blocks:[{id:'g',kind:'gear',setupId:'mid',setupIds}]}),String(setupIds));
 assert.throws(()=>parseGuide({...input,setups,blocks:[{id:'t',kind:'loadouts',setupIds:[]}]}));
 assert.deepEqual(guideSectionSetups({id:'x',kind:'divider'}),[]);
});

test('a standalone number just before an item mention is its quantity',()=>{
 const q=(s:string)=>guideLeadingQuantity(s);
 assert.deepEqual(q('3 '),{text:'',quantity:3});
 assert.deepEqual(q('Bring 90 '),{text:'Bring ',quantity:90});
 assert.deepEqual(q('2,000 '),{text:'',quantity:2000});
 assert.deepEqual(q('and 1,250,000 '),{text:'and ',quantity:1250000});
 assert.deepEqual(q('10x '),{text:'',quantity:10});
 assert.deepEqual(q('10 x '),{text:'',quantity:10});
 assert.deepEqual(q('10× '),{text:'',quantity:10});
 assert.deepEqual(q('take x3 '),{text:'take ',quantity:3});
 for(const s of ['a ','an ','3','3  x ','level 8 ','Level 8 ','lvl 70 ','(8 ','1/3 ','8% ','1.5 ','-3 ','#3 ','0 ','12,34 ','v2 ','3rd '])assert.equal(q(s),null,s);
});
test('item mentions take the number before them; skills and other references keep it as text',()=>{
 const items=new Set(['Plank','Steel nails','Hammer','Shark']),isItem=(n:string)=>items.has(n);
 assert.deepEqual(guideMentionQuantities(guideInline('3 [[Plank]]s, 90 [[Steel nails]] and a [[Hammer]] to repair the ship.'),isItem),[
  {kind:'ref',name:'Plank',suffix:'s',quantity:3},', ',{kind:'ref',name:'Steel nails',quantity:90},' and a ',{kind:'ref',name:'Hammer'},' to repair the ship.']);
 assert.deepEqual(guideMentionQuantities(guideInline('a potter\'s wheel (8 [[Crafting]]) or 18,650 [[Strength]] XP'),isItem),guideInline('a potter\'s wheel (8 [[Crafting]]) or 18,650 [[Strength]] XP'));
 assert.deepEqual(guideMentionQuantities(guideInline('**Food**: 2,000 [[Shark]]'),isItem),[{kind:'bold',children:['Food']},': ',{kind:'ref',name:'Shark',quantity:2000}]);
 assert.deepEqual(guideMentionQuantities(guideInline('**10 [[Shark]]**'),isItem),[{kind:'bold',children:[{kind:'ref',name:'Shark',quantity:10}]}]);
 assert.deepEqual(guideMentionQuantities(guideInline('Use 1 [[Plank]] per patch, level 8 [[Shark]]'),isItem),['Use ',{kind:'ref',name:'Plank',quantity:1},' per patch, level 8 ',{kind:'ref',name:'Shark'}]);
});
test('inventory slots can hold stacks and noted items; quantities count in the inventory value',()=>{
 const input={...emptyGuide(),title:'Tree run',activity:'Farming',summary:'A farming run with noted payments in the inventory.',strategy:'Plant every tree and pay the gardener with the noted fruit.'};
 const setup=newGuideSetup('High','high');setup.inventory[0]='995';setup.inventory[1]='5974';setup.inventory[2]='5374';
 const parse=(stacks:unknown)=>parseGuide({...input,setups:[{...setup,stacks}]}).setups![0];
 const high=parse({0:{quantity:300},1:{quantity:125,noted:true},2:{quantity:1,noted:false}});
 // A single, unnoted item stores nothing; noted:false is dropped.
 assert.deepEqual(high.stacks,{0:{quantity:300},1:{quantity:125,noted:true}});
 assert.deepEqual(guideSlotStack(high,1),{quantity:125,noted:true});assert.deepEqual(guideSlotStack(high,2),{quantity:1,noted:false});
 assert.deepEqual(guideInventoryItems(high),[{id:'995',quantity:300},{id:'5974',quantity:125},{id:'5374',quantity:1}]);
 // A noted single item is kept (the game shows a "1" on the note); nothing left means no stacks at all.
 assert.deepEqual(parse({2:{quantity:1,noted:true}}).stacks,{2:{quantity:1,noted:true}});
 assert.equal('stacks' in parse({2:{quantity:1}}),false);assert.equal('stacks' in parse(undefined),false);
 assert.deepEqual(parse({0:{quantity:GUIDE_MAX_STACK}}).stacks,{0:{quantity:2147483647}});
 // Older guides without stacks parse unchanged.
 assert.equal('stacks' in parseGuide({...input,setups:[setup]}).setups![0],false);
 for(const bad of [[],'x',{3:{quantity:5}},{28:{quantity:5}},{'-1':{quantity:5}},{'01':{quantity:5}},{0:{quantity:0}},{0:{quantity:GUIDE_MAX_STACK+1}},{0:{quantity:1.5}},{0:{quantity:'5'}},{0:{quantity:5,noted:'yes'}},{0:null},{0:5}])
  assert.throws(()=>parse(bad),JSON.stringify(bad));
});
