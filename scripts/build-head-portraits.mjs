/** Head-slot portraits for the account menu and boards: each worn head item drawn the way scripts/build-account-portraits.mjs
 * draws the bare head, in the same portrait units (the bare head fills 0 0 40 44), so the two stack as layers. A helmet
 * that covers the head (identity slot 8) is drawn alone, with the jaw underneath when it leaves slot 11 open, as on the
 * 3D character (lib/appearance.ts headModel). Writes public/portraits/heads and lib/head-portraits.json.
 * Run with `node scripts/build-head-portraits.mjs` after the models in public/models/look change. */
import fs from 'node:fs';
import sharp from 'sharp';
import {skinColor,skinPixel} from '../lib/skin-palette.ts';
import {SKIN_COLORS,cacheHex} from '../lib/game-colors.ts';

const models='public/models/look/', out='public/portraits/heads';
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
const wearables=JSON.parse(fs.readFileSync('lib/wearables.json')), appearance=JSON.parse(fs.readFileSync('lib/appearance-models.json'));
const JAW={male:'kits/14.gltf',female:'female/kits/296.gltf'};
const toLinear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
const hex=rgb=>'#'+rgb.map(c=>Math.round(Math.max(0,Math.min(1,c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055))*255).toString(16).padStart(2,'0')).join('');

function accessor(g,id){
 const a=g.accessors[id],v=g.bufferViews[a.bufferView],b=Buffer.from(g.buffers[v.buffer].uri.split(',')[1],'base64');
 const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],start=(v.byteOffset??0)+(a.byteOffset??0);
 const read={5126:(o)=>b.readFloatLE(o),5123:(o)=>b.readUInt16LE(o),5125:(o)=>b.readUInt32LE(o),5121:(o)=>b.readUInt8(o)}[a.componentType];
 const step={5126:4,5123:2,5125:4,5121:1}[a.componentType];
 return Array.from({length:a.count},(_,i)=>Array.from({length:size},(_,k)=>read(start+(i*size+k)*step)));
}
const images=new Map();
async function texture(g,index){
 const uri=g.images[g.textures[index].source].uri;
 if(!images.has(uri)){const {data,info}=await sharp(Buffer.from(uri.split(',')[1],'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});images.set(uri,{data,width:info.width,height:info.height});}
 return images.get(uri);
}
/** Triangles of a model: three positions, an sRGB-linear colour, its alpha and whether it shows the base skin. */
async function triangles(file){
 const g=JSON.parse(fs.readFileSync(models+file)),faces=[];
 for(const mesh of g.meshes)for(const p of mesh.primitives){
  const pos=accessor(g,p.attributes.POSITION),order=p.indices!==undefined?accessor(g,p.indices).map(v=>v[0]):pos.map((_,i)=>i);
  const material=g.materials?.[p.material]??{},colors=p.attributes.COLOR_0!==undefined?accessor(g,p.attributes.COLOR_0):null;
  const map=material.pbrMetallicRoughness?.baseColorTexture?await texture(g,material.pbrMetallicRoughness.baseColorTexture.index):null;
  const uv=map?accessor(g,p.attributes.TEXCOORD_0):null;
  for(let i=0;i+2<order.length;i+=3){
   const ids=[order[i],order[i+1],order[i+2]],points=ids.map(j=>pos[j]);
   let rgb=[1,1,1],alpha=1,skin=null;
   if(colors){rgb=[0,1,2].map(k=>ids.reduce((s,j)=>s+colors[j][k],0)/3);skin=ids.map(j=>colors[j]);}
   if(map){
    const u=ids.reduce((s,j)=>s+uv[j][0],0)/3,v=ids.reduce((s,j)=>s+uv[j][1],0)/3;
    const x=Math.min(map.width-1,Math.max(0,Math.floor((u-Math.floor(u))*map.width))),y=Math.min(map.height-1,Math.max(0,Math.floor((v-Math.floor(v))*map.height)));
    const o=(y*map.width+x)*4,px=[map.data[o],map.data[o+1],map.data[o+2]];
    rgb=rgb.map((c,k)=>c*toLinear(px[k]/255));alpha=map.data[o+3]/255;
    if(material.alphaMode!=='BLEND')alpha=alpha<.5?0:1;
    skin=px;
   }
   if(alpha<.05)continue;
   faces.push({points,rgb,alpha,skin,texture:!!map,doubleSided:!!material.doubleSided});
  }
 }
 return faces;
}
/** The bare-head portrait's projection (scripts/build-account-portraits.mjs): bounds of the head kit and the jaw. */
function projection(body){
 const xs=[],ys=[];
 for(const file of [`appearance/${body}-brown.gltf`,JAW[body]]){const g=JSON.parse(fs.readFileSync(models+file)),a=g.accessors[g.meshes[0].primitives[0].attributes.POSITION];xs.push(a.min[0],a.max[0]);ys.push(a.min[1],a.max[1]);}
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),scale=Math.min(32/(maxX-minX),39/(maxY-minY)),cx=(minX+maxX)/2;
 return ([x,y])=>[20+(x-cx)*scale,3+(maxY-y)*scale];
}
/** Skin faces take their colour from the URL fragment (`#dark`), read by `:target`, so one file serves every tone. */
const SCALE=4, BASE_SKIN=cacheHex(SKIN_COLORS.default);
const TONES=Object.entries(SKIN_COLORS).filter(([tone])=>tone!=='default').map(([tone,value])=>`#${tone}:target~g{--s:${cacheHex(value)}}`).join('');
const isSkin=f=>!!f.skin&&!!(f.texture?skinPixel(f.skin,'dark'):skinColor(f.skin[0],'dark'));
function svg(faces,project){
 const drawn=[];let box=[Infinity,Infinity,-Infinity,-Infinity];
 for(const f of faces){
  const [a,b,c]=f.points,u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n)||1;
  let [nx,ny,nz]=n.map(k=>k/len);
  if(nz<0){if(!f.doubleSided)continue;nx=-nx;ny=-ny;nz=-nz;}
  const shade=.72+.33*Math.max(0,(-.25*nx+.45*ny+nz)/1.13);
  const pts=f.points.map(project);pts.forEach(([x,y])=>{box=[Math.min(box[0],x),Math.min(box[1],y),Math.max(box[2],x),Math.max(box[3],y)];});
  const d='M'+pts.map(([x,y])=>`${Math.round(x*SCALE)} ${Math.round(y*SCALE)}`).join('L')+'Z';
  const skin=isSkin(f);
  const paint=skin?` class="k" style="--l:${Math.min(100,Math.round(shade*100))}%"`:` fill="${hex(f.rgb.map(c=>c*shade))}"${f.alpha<1?` fill-opacity="${f.alpha.toFixed(2)}"`:''}`;
  drawn.push({z:a[2]+b[2]+c[2],paint,skin,d});
 }
 drawn.sort((p,q)=>p.z-q.z);
 // Neighbouring faces of one colour share a path.
 const paths=[];for(const f of drawn){const last=paths.at(-1);if(last&&!f.skin&&last.paint===f.paint)last.d+=f.d;else paths.push({...f});}
 const view=[Math.floor(box[0]),Math.floor(box[1]),Math.ceil(box[2])-Math.floor(box[0]),Math.ceil(box[3])-Math.floor(box[1])];
 const style=drawn.some(f=>f.skin)?`<style>.k{fill:color-mix(in srgb-linear,var(--s) var(--l),#000)}g{--s:${BASE_SKIN}}${TONES}</style>${Object.keys(SKIN_COLORS).filter(t=>t!=='default').map(t=>`<g id="${t}"/>`).join('')}`:'';
 return {view,text:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view.map(v=>v*SCALE).join(' ')}">${style}<g>${paths.map(p=>`<path${p.paint} d="${p.d}"/>`).join('')}</g></svg>`};
}

const manifest={jaw:{},male:{},female:{}};
let count=0;
for(const body of ['male','female']){
 const project=projection(body);
 const jaw=svg(await triangles(JAW[body]),project);fs.writeFileSync(`${out}/${body}-jaw.svg`,jaw.text);manifest.jaw[body]=jaw.view;count++;
 for(const [id,item] of Object.entries(wearables.items)){
  if(item.slot!=='head')continue;
  const file=body==='female'?appearance.femaleItems[id]:item.file;
  if(!file||!fs.existsSync(models+file))continue;
  const faces=await triangles(file);if(!faces.length)continue;
  const drawn=svg(faces,project);
  fs.writeFileSync(`${out}/${body}-${id}.svg`,drawn.text);count++;
  manifest[body][id]=drawn.view;
 }
}
fs.writeFileSync('lib/head-portraits.json',JSON.stringify(manifest)+'\n');
console.log(`Exported ${count} head portraits.`);
