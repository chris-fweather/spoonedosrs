'use client';
import {useEffect,useState,type CSSProperties} from 'react';

/** Where a sprite's visible pixels sit inside its image, as fractions of the image (0 to 1). */
type Bounds={x:number;y:number;w:number;h:number;iw:number;ih:number};
const bounds=new Map<string,Promise<Bounds|null>>();
function measure(src:string):Promise<Bounds|null>{
 let p=bounds.get(src);
 if(!p){p=new Promise<Bounds|null>(done=>{
  const img=new Image();
  img.onload=()=>{try{
   const {naturalWidth:iw,naturalHeight:ih}=img,canvas=document.createElement('canvas');canvas.width=iw;canvas.height=ih;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx||!iw||!ih)return done(null);
   ctx.drawImage(img,0,0);const data=ctx.getImageData(0,0,iw,ih).data;
   let x0=iw,y0=ih,x1=-1,y1=-1;
   for(let y=0;y<ih;y++)for(let x=0;x<iw;x++)if(data[(y*iw+x)*4+3]>16){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
   done(x1<0?null:{x:x0/iw,y:y0/ih,w:(x1-x0+1)/iw,h:(y1-y0+1)/ih,iw,ih});
  }catch{done(null);}};
  img.onerror=()=>done(null);img.src=src;
 });bounds.set(src,p);}
 return p;
}

/** A transform that grows (or shrinks) an item sprite drawn with object-fit: contain, so its visible pixels fill `fill` of
 * the box and sit in its centre. Item sprites carry a lot of empty margin (a potion is a small vial in a 36 by 32 image),
 * while skill and quest icons fill their square; this makes a row of both read the same size. Nothing changes until the
 * sprite is measured, or when it cannot be. `max` caps the growth: tiny sprites such as seeds need more than the default. */
export function useSpriteFit(src:string,fill=.82,max=2.2):CSSProperties|undefined{
 const [b,setB]=useState<Bounds|null>(null);
 useEffect(()=>{let live=true;measure(src).then(v=>{if(live)setB(v);});return()=>{live=false;};},[src]);
 if(!b)return undefined;
 // In box units (the box is 1 by 1): the drawn image, then the visible pixels inside it.
 const k=Math.min(1/b.iw,1/b.ih),dw=b.iw*k,dh=b.ih*k,left=(1-dw)/2,top=(1-dh)/2;
 const cw=b.w*dw,ch=b.h*dh,cx=left+(b.x+b.w/2)*dw,cy=top+(b.y+b.h/2)*dh;
 const s=Math.max(.7,Math.min(max,fill/Math.max(cw,ch)));
 return {transform:`translate(${(-(cx-.5)*s*100).toFixed(2)}%,${(-(cy-.5)*s*100).toFixed(2)}%) scale(${s.toFixed(3)})`};
}
