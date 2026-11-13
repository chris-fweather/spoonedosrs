import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

/** The Cache-Control each path pattern in public/_headers sets (Workers static assets apply these). */
function rules(){
 const out={};let path=null;
 for(const line of readFileSync('public/_headers','utf8').split('\n')){
  if(/^\S/.test(line)&&!line.startsWith('#'))path=line.trim();
  else if(path&&/^\s+Cache-Control:/i.test(line))out[path]=line.split(':').slice(1).join(':').trim();
 }
 return out;
}
test('our 3D character models are cached by the browser for a day and refreshed in the background',()=>{
 assert.equal(rules()['/models/*'],'public, max-age=86400, stale-while-revalidate=604800');
});
test('game artwork keeps its cache rules',()=>{
 for(const path of ['/icons/*','/items/*','/pets/*'])assert.match(rules()[path]??'',/max-age=86400/,path);
});
