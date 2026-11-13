import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import heads from './head-portraits.json' with {type: 'json'};
import {headPortrait} from './head-portrait.ts';
import {characterPortrait,menuAccount} from './account-menu.ts';
import {wearables} from './flair.ts';
import {initial} from './model.ts';

const SLAYER_HELMET='11864', WIZARD_HAT='579', FACEGUARD='24271';
const file=(src:string)=>'public'+src.split(/[?#]/)[0];

test('every head-slot item has a drawn layer for both bodies, and every drawn layer is a head item on disk',()=>{
  const items=Object.entries(wearables.items).filter(([,item])=>item.slot==='head').map(([id])=>id);
  for(const body of ['male','female'] as const){
    const drawn=(heads as Record<string,Record<string,unknown>>)[body];
    for(const id of items)assert.ok(Object.hasOwn(drawn,id),`${body} ${id} has no head portrait`);
    for(const id of Object.keys(drawn)){assert.equal(wearables.items[id]?.slot,'head');assert.ok(existsSync(`public/portraits/heads/${body}-${id}.svg`));}
    assert.ok(existsSync(`public/portraits/heads/${body}-jaw.svg`));
  }
});

test('no head item, or one that is not a head item, keeps the plain portrait',()=>{
  const look={body:'male',hair:'brown'} as const,portrait=characterPortrait(look);
  assert.equal(headPortrait(look,null,portrait),null);
  assert.equal(headPortrait(look,'4151',portrait),null);
  assert.equal(headPortrait(look,'no-such-item',portrait),null);
  assert.equal(headPortrait(look,'__proto__',portrait),null);
});

test('an open hat sits on the bare head; the frame grows to hold it with the chin at the bottom',()=>{
  const look={body:'female',hair:'red',skin:'tan'} as const,portrait=characterPortrait(look);
  const head=headPortrait(look,WIZARD_HAT,portrait)!;
  assert.deepEqual(head.layers.map(l=>l.src),[portrait,`/portraits/heads/female-${WIZARD_HAT}.svg?v=h1#tan`]);
  assert.deepEqual(head.layers[0].box,[0,0,40,44]);
  assert.ok(head.frame[1]<0,'the hat rises above the bare head');
  assert.equal(head.frame[1]+head.frame[3],44);
  assert.ok(head.frame[2]<=60&&head.frame[3]<=66);
});

test('a helmet that covers the head replaces it, keeping the jaw only when the helmet leaves it open',()=>{
  const look={body:'male',hair:'brown'} as const,portrait=characterPortrait(look);
  assert.deepEqual(headPortrait(look,SLAYER_HELMET,portrait)!.layers.map(l=>l.src),[`/portraits/heads/male-${SLAYER_HELMET}.svg?v=h1`]);
  assert.deepEqual(wearables.items[FACEGUARD].wear.includes(11),false);
  assert.deepEqual(headPortrait(look,FACEGUARD,portrait)!.layers.map(l=>l.src),['/portraits/heads/male-jaw.svg?v=h1',`/portraits/heads/male-${FACEGUARD}.svg?v=h1`]);
});

test('skin tones are chosen by URL fragment, and each named tone is a target in the drawn file',()=>{
  const svg=readFileSync(file(`/portraits/heads/male-jaw.svg`),'utf8');
  for(const tone of ['pale','dark','green','purple'])assert.match(svg,new RegExp(`<g id="${tone}"/>`));
  assert.match(svg,/#dark:target~g\{--s:#[0-9a-f]{6}\}/);
});

test('the account menu shows the head item the journal still allows, as on the profile',()=>{
  const journal=structuredClone(initial);journal.username='Sample';
  const base={name:'Sample',title:null,choice:'auto',mark:null,owner:false,donation:{amountMinor:null,currency:'USD',hidden:true},journal,appearance:{body:'male',hair:'brown'} as const};
  assert.equal(menuAccount({...base,equipped:{head:SLAYER_HELMET}}).head,null,'not in the collection log');
  journal.log={obtained:1,total:1,tabs:[{name:'Other',pages:[{name:'Slayer',obtained:1,total:1,items:[{id:Number(SLAYER_HELMET),name:'Slayer helmet',quantity:1}]}]}]};
  const shown=menuAccount({...base,equipped:{head:SLAYER_HELMET}});
  assert.equal(shown.head?.layers.at(-1)?.src,`/portraits/heads/male-${SLAYER_HELMET}.svg?v=h1`);
  assert.equal(menuAccount({...base,equipped:{head:null}}).head,null);
  assert.equal(menuAccount(base).head,null);
});
