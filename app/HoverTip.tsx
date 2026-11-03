'use client';
import {useEffect, useId, useState, useRef, useLayoutEffect, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {claimTip,releaseTip,tipTakesPointer,type OpenTip} from '@/lib/hover-tips';

/** Render outside clipped model and panel containers. Works with keyboard focus too. Only one tip is open at a time
 * (lib/hover-tips): opening one closes the other at once. An `interactive` tip takes the pointer (for a link inside it)
 * once the pointer crosses from the trigger onto it, stays open while it is on either, and closes once it leaves both;
 * until then the pointer passes through it, so a tip covering a neighbouring trigger never hides that trigger. */
export function HoverTip({label, children, className = '', active=false, content, placement='below', outsideSelector, tabIndex=0, touchPreview=true, tipClass='', interactive=false, title}: {label: string; /** An empty title keeps an ancestor's native tooltip (a row link's) off this trigger. */ title?: string; tipClass?: string; children: ReactNode; className?: string; active?:boolean; content?:ReactNode; placement?:'below'|'right'; outsideSelector?:string; tabIndex?:number; touchPreview?:boolean; interactive?:boolean}) {
  const id = useId();
  const tip=useRef<HTMLSpanElement>(null);
  const trigger=useRef<HTMLSpanElement>(null);
  const hovered=useRef(false),focused=useRef(false),dismissed=useRef(false);
  const touch=useRef(false),touchArmed=useRef(false);
  const [portal,setPortal]=useState<Element|null>(null);
  const [position, setPosition] = useState<{left: number; top: number} | null>(null);
  const [size,setSize]=useState('');
  const leaving=useRef<ReturnType<typeof setTimeout>|null>(null);
  const stay=()=>{if(leaving.current){clearTimeout(leaving.current);leaving.current=null;}};
  // Whether the open interactive tip takes the pointer yet (always for touch and keyboard).
  const [armed,setArmed]=useState(false);
  // This tip in the site-wide "one open tip" registry: another tip opening closes this one straight away.
  const [self]=useState<OpenTip>(()=>({close:()=>{if(leaving.current){clearTimeout(leaving.current);leaving.current=null;}setPosition(null);}}));
  useEffect(()=>()=>{stay();releaseTip(self);},[self]);
  useEffect(()=>{if(!position)releaseTip(self);},[position,self]);
  // An interactive tip starts taking the pointer when the pointer travels into it from this trigger (not when it
  // reaches the tip over another trigger the tip happens to cover: that trigger opens its own tip instead).
  useEffect(()=>{
    if(!position||!interactive||armed)return;
    const move=(e:PointerEvent)=>{
      const el=tip.current,over=e.target instanceof Element?e.target.closest('[data-hover-trigger]'):null;
      if(el&&tipTakesPointer({x:e.clientX,y:e.clientY},el.getBoundingClientRect(),{fromTrigger:hovered.current||!!leaving.current,overOtherTrigger:!!over&&over!==trigger.current})){stay();hovered.current=true;setArmed(true);}
    };
    document.addEventListener('pointermove',move);
    return()=>document.removeEventListener('pointermove',move);
  },[position,interactive,armed]);
  useEffect(()=>{
    if(active&&trigger.current)show(trigger.current);
    else if(!hovered.current&&!focused.current)setPosition(null);
  },[active]);
  useEffect(() => {
    if (!position) return;
    const hide = () => {touchArmed.current=false;dismissed.current=true;setPosition(null);};
    const outside = (event:PointerEvent) => {
      if(event.target instanceof Node&&!trigger.current?.contains(event.target)&&!tip.current?.contains(event.target))hide();
    };
    document.addEventListener('pointerdown',outside);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {document.removeEventListener('pointerdown',outside);window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide);};
  }, [position]);
  useLayoutEffect(()=>{
    if(!position||!tip.current)return;
    const rect=tip.current.getBoundingClientRect();
    const anchor=outsideSelector?trigger.current?.closest(outsideSelector)?.getBoundingClientRect():trigger.current?.getBoundingClientRect();
    let preferredLeft=position.left,preferredTop=position.top;
    if(placement==='right'&&anchor){
      if(anchor.right+10+rect.width<=window.innerWidth-8)preferredLeft=anchor.right+10;
      else if(anchor.left-10-rect.width>=8)preferredLeft=anchor.left-10-rect.width;
      else {preferredLeft=anchor.left;preferredTop=anchor.top-rect.height-10>=8?anchor.top-rect.height-10:anchor.bottom+10;}
    }else if(anchor){
      // Below the trigger when it fits, otherwise above it, so the card never covers what it describes.
      preferredTop=anchor.bottom+8+rect.height<=window.innerHeight-8||anchor.top-8-rect.height<8?anchor.bottom+8:anchor.top-8-rect.height;
    }
    const left=Math.max(8,Math.min(preferredLeft,window.innerWidth-rect.width-8));
    const top=Math.max(8,Math.min(preferredTop,window.innerHeight-rect.height-8));
    if(left!==position.left||top!==position.top)setPosition({left,top});
  },[position,label,placement,outsideSelector,size]);
  // Content that loads later (a price card) changes the tip's size: place it again.
  useEffect(()=>{const el=tip.current;if(!position||!el||typeof ResizeObserver==='undefined')return;const o=new ResizeObserver(()=>setSize(el.offsetWidth+'x'+el.offsetHeight));o.observe(el);return()=>o.disconnect();},[position]);
  function show(el: HTMLElement) {
    if(dismissed.current)return;
    claimTip(self);setArmed(touch.current||focused.current);
    setPortal(el.closest('dialog') ?? document.body);
    const r = el.getBoundingClientRect();
    if(placement==='right'){const a=outsideSelector?el.closest(outsideSelector)?.getBoundingClientRect()??r:r;setPosition({left:a.right+10,top:r.top});return;}
    setPosition({left: Math.max(8, Math.min(r.left, window.innerWidth - 208)), top: Math.max(8, Math.min(r.bottom + 8, window.innerHeight - 110))});
  }
  return <span ref={trigger} data-hover-trigger="" className={className} title={title} tabIndex={tabIndex} aria-label={label} aria-describedby={position ? id : undefined}
    onPointerDown={e => {touch.current=e.pointerType==='touch'||e.pointerType==='pen';}}
    onMouseEnter={e => {if(touch.current)return;stay();dismissed.current=false;hovered.current=true;if(!(interactive&&position))show(e.currentTarget);}} onMouseLeave={() => {if(touch.current)return;hovered.current=false;if(active||focused.current)return;if(interactive){stay();leaving.current=setTimeout(()=>{leaving.current=null;if(!hovered.current)setPosition(null);},160);}else setPosition(null);}}
    onClickCapture={e => {
      // Touch previews are deliberate: the following tap activates the existing child action.
      // Keyboard activation (detail 0) and mouse clicks keep their normal single-click behavior.
      if(touchPreview&&touch.current&&e.detail!==0&&!touchArmed.current){
        e.preventDefault();e.stopPropagation();touchArmed.current=true;dismissed.current=false;show(e.currentTarget);return;
      }
      touchArmed.current=false;dismissed.current=true;setPosition(null);
    }}
    onFocus={e => {focused.current=(e.target as HTMLElement).matches(':focus-visible');if(focused.current&&!touch.current){dismissed.current=false;show(e.currentTarget);}}} onBlur={() => {focused.current=false;if(!active&&!hovered.current)setPosition(null);}} onKeyDown={e => {if (e.key === 'Escape') {touchArmed.current=false;dismissed.current=true;setPosition(null);}}}>
    {children}
    {position && createPortal(<span ref={tip} id={id} role="tooltip" className={'floating-tooltip'+(tipClass?' '+tipClass:'')} style={interactive?{...position,pointerEvents:armed?'auto':'none'}:position}>{content??label}</span>, portal ?? document.body)}
  </span>;
}
