import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {parseAppearance,equipmentModel,appearanceModels,featuredEmblem,headModel,HAIR_COLORS} from './appearance.ts';
import {initial} from './model.ts';
import {wearables,badgeCatalogue,coerceFlair} from './flair.ts';

test('appearance accepts only explicit body and hair choices',()=>{
 assert.deepEqual(parseAppearance({body:'female',hair:'blonde',admin:true}),{body:'female',hair:'blonde'});
 for(const value of [null,[],{}, {body:'female',hair:'unknown'},{body:'../female',hair:'brown'}])assert.throws(()=>parseAppearance(value));
});
test('female outfits choose their own models, never silently substitute a male mesh',()=>{
 const a={body:'female',hair:'blonde'} as const;
 for(const id of ['10458','21295','1035','1033']){const file=equipmentModel(id,wearables.items[id].file,a);assert.ok(file?.startsWith('female/'));assert.ok(existsSync('public/models/look/'+file));}
 assert.equal(equipmentModel('missing','items/male.gltf',a),null);
 assert.equal(equipmentModel('10458','items/male.gltf',{body:'male',hair:'brown'}),'items/male.gltf');
 assert.deepEqual(appearanceModels.femaleKits.map(k=>k.part),[0,1,2,3,4,5,6]);
 for(const body of ['male','female'] as const){const files=Object.values(appearanceModels.hair[body]);assert.equal(new Set(files.map(f=>readFileSync('public/models/look/'+f,'utf8'))).size,5);}
});
test('every female model reference exists and representative textured gear has finite UVs',()=>{
 for(const file of new Set(Object.values(appearanceModels.femaleItems)))assert.ok(existsSync('public/models/look/'+file),file);
 for(const id of ['21295','21284','24224','3053','12774','10458']){
  const file=appearanceModels.femaleItems[id];const g=JSON.parse(readFileSync('public/models/look/'+file,'utf8'));
  for(const a of g.accessors){const v=g.bufferViews[a.bufferView],buf=Buffer.from(g.buffers[v.buffer].uri.split(',')[1],'base64');for(let i=0;i<buf.length;i+=4)assert.ok(Number.isFinite(buf.readFloatLE(i)),file);}
  if(id==='21295')assert.ok(g.materials.some((m:{name?:string})=>m.name?.startsWith('flow:0,')));
 }
});
test('picker offers spaced pet and collection milestones while preserving legacy selection support',()=>{
 assert.equal(featuredEmblem('pets-15'),false);assert.equal(featuredEmblem('pets-25'),false);
 for(const id of ['pets-5','pets-10','pets-20','pets-30','pets-50','pets-all','clog-all'])assert.equal(featuredEmblem(id),true);
});

test('a head item that hides the hair replaces the whole head, so no kit face shows through helmet visors',async()=>{
 const {skinPixel}=await import('./skin-palette.ts');
 const read=(file:string)=>JSON.parse(readFileSync('public/models/look/'+file,'utf8'));
 function positions(g:any){const out:number[][]=[];for(const m of g.meshes)for(const p of m.primitives){const a=g.accessors[p.attributes.POSITION],v=g.bufferViews[a.bufferView],buf=Buffer.from(g.buffers[v.buffer].uri.split(',')[1],'base64'),o=(v.byteOffset??0)+(a.byteOffset??0);for(let i=0;i<a.count;i++)out.push([0,1,2].map(k=>buf.readFloatLE(o+(i*3+k)*4)));}return out;}
 const span=(points:number[][],axis:number)=>[Math.min(...points.map(p=>p[axis])),Math.max(...points.map(p=>p[axis]))];
 for(const body of ['male','female'] as const)for(const hair of HAIR_COLORS){
  assert.equal(headModel({body,hair},true),null,`${body} ${hair}: no head kit under a helmet`);
  assert.equal(headModel({body,hair},false),appearanceModels.hair[body][hair]);
 }
 assert.equal(headModel(parseAppearance({body:'auto',hair:'brown'}),true),null);
 // Slayer helmets (every colour and its imbued copy), and the other helmets the outfit picker groups into styles.
 const helmets=['11864','11865','19639','19641','19643','19645','19647','19649','21264','21266','21888','21890','23073','23075','29816','29818',
  '26382','28254','12931','13197','13199','24271','10828','11850','13579','13591','13603','13615','13627','24743','21061','30045','1163','2619','2627'];
 for(const body of ['male','female'] as const){
  const head=positions(read(appearanceModels.hair[body].brown)),[chin]=span(head,1),[left,right]=span(head,0);
  for(const id of helmets){
   const item=wearables.items[id];assert.ok(item?.wear.includes(8),id+' hides the hair');
   const file=body==='male'?item.file:appearanceModels.femaleItems[id];assert.ok(file&&existsSync('public/models/look/'+file),`${body} ${id} model`);
   // The item models the face itself: it reaches the chin and spans the head, so nothing is missing without the kit.
   const points=positions(read(file!)),[low]=span(points,1),[minX,maxX]=span(points,0);
   assert.ok(low<=chin+1,`${body} ${item.name} reaches the chin`);assert.ok(minX<=left+2&&maxX>=right-2,`${body} ${item.name} covers the head`);
  }
 }
 // The face a helmet shows takes the chosen skin tone from its palette texture too.
 const palette=read(wearables.items['11864'].file).images[0].uri as string;assert.match(palette,/^data:image\/png;base64,/);
 assert.deepEqual(skinPixel([214,172,135],'default'),null);assert.ok(skinPixel([214,172,135],'dark'));assert.equal(skinPixel([60,60,48],'dark'),null);
});

test('quest and diary emblems require completion, while collection milestones remain',()=>{
 const j=structuredClone(initial),badges=badgeCatalogue(j);
 assert.equal(badges.filter(b=>b.id.startsWith('quests-')||b.id.startsWith('diaries-')).length,0);
 for(const id of ['quest-cape','diary-cape','pets-10','clog-429'])assert.ok(badges.some(b=>b.id===id));
 assert.equal(coerceFlair(j,{pinnedMark:'quests-50'}).pinnedMark,null);
 j.profile={quests:[{id:1,name:'Quest',state:'finished',points:1,type:'free'}],diaries:[{areaId:1,area:'Area',tiers:[{tier:'Easy',completed:1,total:2}]}],combat:[],syncedAt:''};
 assert.equal(badgeCatalogue(j).find(b=>b.id==='quest-cape')?.unlocked,true);
 assert.equal(badgeCatalogue(j).find(b=>b.id==='diary-cape')?.unlocked,false);
});

test('legacy imported appearance resolves to a selectable default character',()=>{
 assert.equal(parseAppearance({body:'auto',hair:'brown'}).body,'male');
 assert.equal(parseAppearance({body:'female',hair:'red'}).body,'female');
});

test('mine and woodland are valid scenes with thumbnails; unknown scenes are refused',()=>{
 for(const background of ['none','castle','riverside','mine','woodland']){
  assert.equal(parseAppearance({body:'male',hair:'brown',background}).background,background);
  assert.ok(existsSync(new URL(`../public/ui/scenes/${background}.webp`,import.meta.url)),background);
 }
 assert.throws(()=>parseAppearance({body:'male',hair:'brown',background:'moon'}));
 assert.match(readFileSync(new URL('../drizzle/0023_profile_scenes.sql',import.meta.url),'utf8'),/'mine','woodland'/);
});

test('every body, hair and skin choice recolours the base skin on both bodies',async()=>{
 const {skinColor,BASE_SKIN_RGB}=await import('./skin-palette.ts');
 const {SKIN_TONES}=await import('./appearance.ts');
 const {wearables:w}=await import('./flair.ts');
 const colours=(file:string)=>{const g=JSON.parse(readFileSync('public/models/look/'+file,'utf8'));const out:number[][]=[];for(const m of g.meshes)for(const p of m.primitives){const a=g.accessors[p.attributes.COLOR_0],v=g.bufferViews[a.bufferView],buf=Buffer.from(g.buffers[v.buffer].uri.split(',')[1],'base64'),o=(v.byteOffset??0)+(a.byteOffset??0);for(let i=0;i<a.count;i++)out.push([0,1,2].map(k=>buf.readFloatLE(o+(i*3+k)*4)));}return out;};
 for(const body of ['male','female'] as const){
  const kits=body==='female'?appearanceModels.femaleKits:w.kits;
  for(const hair of HAIR_COLORS){
   const files=kits.map(k=>k.part===0?headModel({body,hair},false):k.file);
   const skin=files.flatMap(colours).filter(c=>c.every((v,i)=>Math.abs(v-BASE_SKIN_RGB[i])<1e-5));
   assert.ok(skin.length>300,`${body} ${hair} has skin to recolour`);
   for(const tone of Object.keys(SKIN_TONES) as (keyof typeof SKIN_TONES)[]){
    const next=skinColor(skin[0],tone);
    if(tone==='default')assert.equal(next,null);else assert.ok(next&&next.every(Number.isFinite),`${body} ${hair} ${tone}`);
   }
  }
 }
});

test('character scenes are off: saved scenes stay valid but every character shows the plain background',async()=>{
 const {CHARACTER_SCENES,shownBackground}=await import('./appearance.ts');
 assert.equal(CHARACTER_SCENES,false);
 const saved=parseAppearance({body:'female',hair:'red',background:'castle'});
 assert.equal(saved.background,'castle');
 assert.equal(shownBackground(saved),'none');assert.equal(shownBackground(undefined),'none');
 assert.equal(shownBackground(saved,true),'castle');assert.equal(shownBackground({},true),'none');
});
