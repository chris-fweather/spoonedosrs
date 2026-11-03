'use client';
import {lazy,Suspense,useEffect,useId,useMemo,useState,useSyncExternalStore} from 'react';
import {ArrowDown,ArrowUp,ListPlus,MapPin,Navigation,Plus,Route,Search,X} from 'lucide-react';
import {MAP_PIN_GROUPS,MAP_PIN_ICON,MAP_PIN_LABEL,MAP_PLACES,MAP_STOP_LIMITS,MAP_ZOOM,guideMapExits,guideMapLegs,guideMapStopColours,hasStopDetails,hasStopText,type GuideMap as GuideMapData,type GuideMapExit,type GuideMapPin} from '@/lib/guide-map';
import {worldMapDirections} from '@/lib/features';
import {guideItemChoices,guideItemImage,guideItems,searchGuideItems} from '@/lib/guides';
import {TRAVEL_METHODS,stopLook,teleportStopMethod,type StopTeleport} from '@/lib/guide-map-teleports';
import {useStopTeleports} from './guide-map-teleports';
import {InlineText,ItemImage} from './GuideParts';
import {ItemHover} from './ItemPriceCard';
import {areaExits,areaFor,areaWith,backLabel,onSurface,wayOut,type Box,type MapExit,type MapPlace as MapSpot} from '@/lib/world-map-exits';
import {useMapExits,type MapExits} from './map-exits';
import './guide-map.css';

// Leaflet only loads on pages that show a map, and only in the browser.
const GuideMapView=lazy(()=>import('./GuideMapView'));
const FLOORS=['Ground floor','1st floor','2nd floor','3rd floor'];
function useMounted(){const [mounted,setMounted]=useState(false);useEffect(()=>setMounted(true),[]);return mounted;}
const Loading=()=><div className="gm-canvas gm-loading" role="status">Loading the map…</div>;

/** The area a guide map shows for a spot: the surface, or the underground area around it grown to hold the map's
 * underground stops (quest dungeons the travel data does not know). Kept as the same object while the box is the same. */
function useArea(spot:MapSpot,pins:GuideMapPin[],doors:MapExits|null):Box{
 const b=areaWith(areaFor(spot.at,doors?.areas),pins);
 return useMemo(()=>({x0:b.x0,y0:b.y0,x1:b.x1,y1:b.y1}),[b.x0,b.y0,b.x1,b.y1]);
}
/** Ways into another area from the travel data, plus the route's own (a quest dungeon the data lacks). Floor changes are
 * not drawn: readers reach a stop upstairs from the list of stops. */
function useExits(pins:GuideMapPin[],doors:MapExits|null):(MapExit|GuideMapExit)[]{
 return useMemo(()=>{const known=doors?.exits??[];return areaExits([...known,...guideMapExits(pins,known)]);},[pins,doors]);
}
function BackButton({spot,onClick}:{spot:MapSpot;onClick:()=>void}){
 const label=backLabel(spot);
 // Guide maps are small, so the button says just where it goes; the full wording is its accessible name.
 return label?<button type="button" className="map-back" aria-label={label} title={label} onClick={onClick}>{onSurface(spot.at)?<><ArrowDown size={16} aria-hidden="true"/>Ground floor</>:<><ArrowUp size={16} aria-hidden="true"/>Surface</>}</button>:null;
}
// A stop's number badge takes the colour of the route line that ends at it, so the list matches the map.
// Its icon says what to do there ("Fight · any style") on hover; an item stop shows the item it gives.
function StopMark({pin,n,colour,ways=[]}:{pin:GuideMapPin;n:number;colour?:string|null;ways?:StopTeleport[]}){const {icon,hint,item}=stopLook(pin,ways,guideItemImage);return <span className={'gm-stop-mark kind-'+pin.kind+(colour?' has-leg':'')+(item?' has-item':'')} title={hint} style={colour?{'--leg':colour} as React.CSSProperties:undefined}><b>{n}</b>{icon&&<img src={icon} alt=""/>}</span>;}

/** A stop's details, opened in place under it in the list while it is the chosen stop: the teleports that land there, the
 * items used there (with their price cards), the chat options to pick in order, styled like the game's highlighted options,
 * and a note. The map only highlights the stop's pin, so the details live in one place. */
function StopDetails({pin,teleports,id}:{pin:GuideMapPin;teleports:StopTeleport[];id:string}){
 return <div className="gm-stop-details" id={id}>
  {teleports.length>0&&<TeleportList teleports={teleports}/>}
  {!!pin.items?.length&&<ul className="gm-card-items" aria-label="Items">{pin.items.map(i=><li key={i.id}><ItemHover id={i.id} quantity={i.quantity} className="gm-card-item" focusable><ItemImage id={i.id}/><span>{guideItems[i.id]??'Item'}</span>{i.quantity>1&&<b>×{i.quantity.toLocaleString('en-US')}</b>}</ItemHover></li>)}</ul>}
  {!!pin.dialogue?.length&&<ol className="gm-card-dialogue" aria-label="Chat options">{pin.dialogue.map((line,n)=><li key={n}><span aria-hidden="true">{n+1}.</span><q>{line}</q></li>)}</ol>}
  {pin.note&&<p className="gm-card-note">{pin.note}</p>}
 </div>;
}
/** The teleports landing at a teleport stop, each with its game icon; the one the guide names stands out. */
function TeleportList({teleports}:{teleports:StopTeleport[]}){
 return <div className="gm-card-teleports"><small>Ways to get here</small><ul>{teleports.map(t=><li key={t.name} className={t.named?'is-named':undefined} title={t.named?'The teleport this guide uses':t.via}><img src={t.icon} alt=""/><span>{t.name}</span></li>)}</ul></div>;
}
/** A closed stop's second, muted line: the first few items it uses and what else its details hold, so readers see which
 * stops have more without opening them. An item stop's one item is already its icon; a teleport stop's ways there show
 * once it is opened. */
function StopMeta({pin}:{pin:GuideMapPin}){
 const items=pin.items?.length&&!(pin.kind==='item'&&pin.items.length===1)?pin.items:[];
 const lines=pin.dialogue?.length??0,text=pin.note??(lines?`${lines} chat option${lines>1?'s':''}`:'');
 if(!items.length&&!text)return null;
 return <span className="gm-stop-meta" aria-hidden="true">{items.length>0&&<span className="gm-stop-items">{items.slice(0,4).map(i=><ItemImage key={i.id} id={i.id}/>)}{items.length>4&&<small>+{items.length-4}</small>}</span>}{text&&<span className="gm-stop-note">{text}</span>}</span>;
}

// Readers can hide route lines. The choice holds for every map that shows lines by default, on this page and later
// visits (per browser); a map whose writer turned lines off starts without them and can be turned on for this visit.
const ROUTE_KEY='spooned:guide-maps:route',routeWatchers=new Set<()=>void>();
let routeHidden:boolean|null=null;
function readRouteHidden(){if(routeHidden===null){try{routeHidden=localStorage.getItem(ROUTE_KEY)==='off';}catch{routeHidden=false;}}return routeHidden;}
function setRouteHidden(hidden:boolean){routeHidden=hidden;try{if(hidden)localStorage.setItem(ROUTE_KEY,'off');else localStorage.removeItem(ROUTE_KEY);}catch{/* private browsing: keep it for this visit */}routeWatchers.forEach(f=>f());}
const watchRoute=(f:()=>void)=>{routeWatchers.add(f);return()=>{routeWatchers.delete(f);};};
function useRouteShown(map:GuideMapData):[boolean,()=>void]{
 const hidden=useSyncExternalStore(watchRoute,readRouteHidden,()=>false),[own,setOwn]=useState(false);
 if(map.lines===false)return [own,()=>setOwn(v=>!v)];
 return [!hidden,()=>setRouteHidden(!hidden)];
}
/** The map's one overlay control. While a stop is chosen it goes back to the whole route; otherwise it turns the route lines
 * on or off (a map without lines just goes back to all its stops). */
function RouteControl({hasRoute,route,whole,onShowAll,onToggle}:{hasRoute:boolean;route:boolean;whole:boolean;onShowAll:()=>void;onToggle:()=>void}){
 const label=!whole?(hasRoute?'Show the whole route':'Show all stops'):route?'Hide the route':'Show the route';
 return <button type="button" className="gm-route-toggle" aria-pressed={hasRoute?route&&whole:undefined} aria-label={label} title={label} onClick={whole?onToggle:onShowAll}><Route size={15} aria-hidden="true"/><span>{hasRoute?'Route':'All stops'}</span></button>;
}

/** A map in a published guide: the chosen view and its numbered stops. On a wide enough page the stops are the steps on the
 * left of the map, otherwise they follow underneath; a stop that says what to do there shows it under its name. */
export function GuideMap({map:saved}:{map:GuideMapData}){
 // The map opens on the floor and area of the writer's view. Exits (ways into another area) and
 // the stops in the list move between floors and areas; the view stays inside the area shown.
 const mounted=useMounted(),home:MapSpot={plane:saved.plane,at:{x:saved.x,y:saved.y}},[spot,setSpot]=useState<MapSpot>(home),[jump,setJump]=useState<{x:number;y:number;key:number}|null>(null);
 const [active,setActive]=useState<number|null>(null),[hover,setHover]=useState<number|null>(null),plane=spot.plane,uid=useId();
 const [route,toggleRoute]=useRouteShown(saved),map={...saved,lines:route},hasRoute=guideMapLegs({pins:saved.pins}).length>0;
 const doors=useMapExits(),area=useArea(spot,saved.pins,doors),exits=useExits(saved.pins,doors);
 const colours=guideMapStopColours(map),teleports=useStopTeleports(saved.pins),steps=hasStopText(saved);
 const goTo=(t:{x:number;y:number;plane:number})=>{setSpot({plane:t.plane,at:{x:t.x,y:t.y}});setJump({x:t.x,y:t.y,key:Date.now()});};
 // Choosing a stop (in the list or on the map) focuses its leg, on its floor; choosing it again shows the whole route.
 const focus=(i:number)=>{if(active===i){showAll();return;}const pin=map.pins[i];setSpot({plane:pin.plane,at:{x:pin.x,y:pin.y}});setActive(i);};
 const showAll=()=>{setActive(null);setSpot(home);};
 const onExit=(e:MapExit|GuideMapExit)=>{if('stop' in e){setSpot({plane:e.to.plane,at:{x:e.to.x,y:e.to.y}});setActive(e.stop);return;}setActive(null);goTo(e.to);};
 // Back to the surface: the area's way out, else the map's own view or first stop on the surface.
 const surfacePin=saved.pins.find(p=>onSurface(p)),out=onSurface(spot.at)?null:wayOut(doors?.exits??[],area,spot.at,doors?.areas)??(onSurface(home.at)?home.at:surfacePin??null);
 const canGoBack=onSurface(spot.at)||!!out;
 const back=()=>{
  setActive(null);
  if(onSurface(spot.at)){setSpot({plane:0,at:spot.at});return;}
  if(out)goTo({...out,plane:0});
 };
 return <figure className={'guide-map'+(steps?' is-steps':'')}>
  {map.title&&<header><h3>{map.title}</h3></header>}
  <div className="gm-body">
  <div className="gm-frame">{mounted?<Suspense fallback={<Loading/>}><GuideMapView map={map} plane={plane} area={area} exits={exits} onExit={onExit} jump={jump} active={active} highlight={hover!==null&&map.pins[hover]?.plane===plane?hover:null} onHover={setHover} onActive={focus} teleports={teleports}/></Suspense>:<Loading/>}
   {canGoBack&&backLabel(spot)&&<div className="gm-map-back"><BackButton spot={spot} onClick={back}/></div>}
   {(hasRoute||active!==null)&&<div className="gm-map-tools"><RouteControl hasRoute={hasRoute} route={route} whole={active===null} onShowAll={showAll} onToggle={toggleRoute}/></div>}</div>
  {map.pins.length>0&&<ol className="gm-stops">{map.pins.map((pin,i)=>{
   const name=pin.label||MAP_PIN_LABEL[pin.kind],directions=worldMapDirections(pin,name),ways=teleports[i],details=hasStopDetails(pin)||ways.length>0,open=details&&active===i;
   // The timeline between this stop and the next takes the colour of the route line that ends there (dotted for a teleport or a floor change).
   const next=i+1<map.pins.length?colours[i+1]:null;
   return <li key={i} className={'gm-stop'+(active===i?' is-active':'')+(hover===i?' is-lit':'')+(next?' has-next-leg':'')} style={next?{'--next':next} as React.CSSProperties:undefined}
    onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)} onFocus={()=>setHover(i)} onBlur={()=>setHover(null)}>
    <button type="button" className="gm-stop-row" aria-pressed={active===i} aria-expanded={details?open:undefined} aria-controls={open?`${uid}-${i}`:undefined} onClick={()=>focus(i)}>
     <StopMark pin={pin} n={i+1} colour={colours[i]} ways={ways}/>
     <span className="gm-stop-text"><span className="gm-stop-label" title={name}>{name}</span>{!open&&!pin.text&&<StopMeta pin={pin}/>}</span>
    </button>
    {directions&&<a className="gm-directions" href={directions} aria-label={`Directions to ${pin.label||'stop '+(i+1)}`} title="Directions on the world map"><Navigation size={14}/></a>}
    {/* Instructions sit outside the stop's button, as their game terms are links of their own. */}
    {pin.text&&<p className="gm-stop-say"><InlineText text={pin.text}/></p>}
    {pin.text&&!open&&<StopMeta pin={pin}/>}
    {open&&<StopDetails pin={pin} teleports={ways} id={`${uid}-${i}`}/>}
   </li>;})}</ol>}
  </div>
 </figure>;
}

export const newGuideMap=():GuideMapData=>({title:'',x:3222,y:3218,plane:0,zoom:MAP_ZOOM.initial,pins:[]});

/** The map section editor: move the map to the view readers should see, and click it to add numbered stops. */
export function GuideMapEditor({value,onChange}:{value:GuideMapData;onChange:(m:GuideMapData)=>void}){
 const mounted=useMounted(),[active,setActive]=useState<number|null>(null),[jump,setJump]=useState(0);
 const [shown,setShown]=useState(value);// the view the map opens at; moving the map only updates the saved view
 // Writers reach other floors with the Floor list and underground areas through exits, like readers.
 const [at,setAt]=useState({x:value.x,y:value.y}),[moveTo,setMoveTo]=useState<{x:number;y:number;key:number}|null>(null);
 const doors=useMapExits(),area=useArea({plane:value.plane,at},value.pins,doors),exits=useExits(value.pins,doors);
 const set=(patch:Partial<GuideMapData>)=>onChange({...value,...patch});
 const pins=value.pins,colours=guideMapStopColours(value),ways=useStopTeleports(pins),setPin=(i:number,patch:Partial<GuideMapPin>)=>set({pins:pins.map((p,j)=>j===i?{...p,...patch}:p)});
 const [open,setOpen]=useState<number|null>(null);// the stop whose details are open
 function move(i:number,step:number){const next=[...pins],[pin]=next.splice(i,1);next.splice(i+step,0,pin);set({pins:next});setActive(i+step);if(open===i)setOpen(i+step);}
 return <div className="gm-editor">
  <div className="guide-insert-fields">
   <label>Title<input value={value.title} maxLength={80} placeholder="Optional, like Getting to the Kraken" onChange={e=>set({title:e.target.value})}/></label>
   <label>Jump to<select value="" onChange={e=>{const p=MAP_PLACES.find(x=>x.name===e.target.value);if(p){const view={...value,x:p.x,y:p.y,zoom:Math.max(value.zoom,8),plane:0};onChange(view);setShown(view);setAt(p);setJump(j=>j+1);}}}><option value="">A town or landmark…</option>{MAP_PLACES.map(p=><option key={p.name}>{p.name}</option>)}</select></label>
   <label>Floor<select value={value.plane} onChange={e=>set({plane:Number(e.target.value)})}>{FLOORS.map((f,i)=><option key={f} value={i}>{f}</option>)}</select></label>
  </div>
  <div className="gm-frame">{mounted?<Suspense fallback={<Loading/>}><GuideMapView key={jump} editing teleports={ways} map={{...shown,pins,lines:value.lines}} plane={value.plane} area={area} exits={exits} jump={moveTo} onExit={e=>{onChange({...value,plane:e.to.plane,x:e.to.x,y:e.to.y});setAt({x:e.to.x,y:e.to.y});setMoveTo({x:e.to.x,y:e.to.y,key:Date.now()});}} active={active} onActive={setActive}
   onView={v=>onChange({...value,...v})} onPlace={(x,y)=>{if(pins.length>=20)return;set({pins:[...pins,{x,y,plane:value.plane,label:'',kind:pins.length?'stop':'start'}]});setActive(pins.length);}}/></Suspense>:<Loading/>}</div>
  <div className="gm-editor-hint"><p className="fine"><MapPin size={13} aria-hidden="true"/> Click the map to add a stop. Readers see the map as you leave it.</p><label className="check"><input type="checkbox" checked={value.lines!==false} onChange={e=>set({lines:e.target.checked?undefined:false})}/> Route lines</label></div>
  {pins.length>0&&<ol className="gm-edit-stops">{pins.map((pin,i)=><li key={i} className={active===i?'is-active':''} onFocus={()=>setActive(i)}>
   <StopMark pin={pin} n={i+1} colour={colours[i]} ways={ways[i]}/>
   <select aria-label={`Stop ${i+1} kind`} value={pin.kind} onChange={e=>setPin(i,{kind:e.target.value as GuideMapPin['kind']})}>{MAP_PIN_GROUPS.map(g=><optgroup key={g.label} label={g.label}>{g.kinds.map(k=><option key={k.kind} value={k.kind}>{k.label}</option>)}</optgroup>)}</select>
   <input aria-label={`Stop ${i+1} label`} value={pin.label} maxLength={60} placeholder="Label, like Father Aereck" onChange={e=>setPin(i,{label:e.target.value})}/>
   <span className="gm-edit-actions"><button type="button" aria-label="Stop details" title="What to do, items, chat options and a note" aria-expanded={open===i} className={hasStopDetails(pin)||pin.text?'has-details':''} onClick={()=>setOpen(open===i?null:i)}><ListPlus size={15}/></button><button type="button" aria-label="Move up" title="Move up" disabled={i===0} onClick={()=>move(i,-1)}><ArrowUp size={14}/></button><button type="button" aria-label="Move down" title="Move down" disabled={i===pins.length-1} onClick={()=>move(i,1)}><ArrowDown size={14}/></button><button type="button" aria-label="Remove stop" title="Remove" onClick={()=>{set({pins:pins.filter((_,j)=>j!==i)});setActive(null);setOpen(null);}}><X size={14}/></button></span>
   {open===i&&<StopDetailsEditor pin={pin} n={i+1} ways={ways[i]} onChange={patch=>setPin(i,patch)}/>}
  </li>)}</ol>}
 </div>;
}

/** A stop's details in the editor: what to do there, items from the item search with their quantities, the chat options to pick in order, and
 * a short note. Readers see them in the stop's card. */
function StopDetailsEditor({pin,n,ways,onChange}:{pin:GuideMapPin;n:number;ways:StopTeleport[];onChange:(patch:Partial<GuideMapPin>)=>void}){
 const [query,setQuery]=useState(''),L=MAP_STOP_LIMITS,items=pin.items??[],lines=pin.dialogue??[];
 const results=query.trim()?searchGuideItems(query,guideItemChoices,24).filter(([id])=>!items.some(i=>i.id===id)):[];
 const setLines=(next:string[])=>onChange({dialogue:next});
 const method=teleportStopMethod(pin,ways);
 return <div className="gm-edit-details" role="group" aria-label={`Stop ${n} details`}>
  <label className="gm-edit-field"><span>What to do here <small>shows under the stop&rsquo;s name</small></span><textarea rows={2} maxLength={L.text} placeholder="Like Walk north-east to the castle garden and plant the tree." value={pin.text??''} onChange={e=>onChange({text:e.target.value})}/></label>
  {pin.kind==='teleport'&&<label className="gm-edit-field"><span>How to get there <small>sets the icon; empty uses the label</small></span><span className="gm-edit-via"><img src={method?.icon??MAP_PIN_ICON.teleport??undefined} alt="" title={method?.name??'Teleport'}/><input list={`gm-via-${n}`} maxLength={L.via} placeholder={method?.name??'Like Amulet of glory, Varrock Teleport or Spirit tree'} value={pin.via??''} onChange={e=>onChange({via:e.target.value})}/></span><datalist id={`gm-via-${n}`}>{[...new Set([...ways.map(w=>w.name),...TRAVEL_METHODS])].map(v=><option key={v} value={v}/>)}</datalist></label>}
  <div className="gm-edit-field"><span>Items</span>
   {items.length>0&&<ul className="gm-edit-items">{items.map(i=><li key={i.id}><ItemImage id={i.id}/><span>{guideItems[i.id]??'Item'}</span><input type="number" min={1} max={L.quantity} aria-label={`${guideItems[i.id]} quantity`} value={i.quantity} onChange={e=>{const quantity=Math.max(1,Math.min(L.quantity,Math.round(Number(e.target.value))||1));onChange({items:items.map(x=>x.id===i.id?{...x,quantity}:x)});}}/><button type="button" aria-label={`Remove ${guideItems[i.id]}`} title="Remove" onClick={()=>onChange({items:items.filter(x=>x.id!==i.id)})}><X size={14}/></button></li>)}</ul>}
   {items.length<L.items&&<label className="search"><Search size={14} aria-hidden="true"/><input aria-label={`Add an item to stop ${n}`} placeholder="Add an item, like Lobster pot…" value={query} onChange={e=>setQuery(e.target.value)}/></label>}
   {results.length>0&&<div className="guide-item-results gm-edit-results">{results.map(([id,name])=><button type="button" key={id} title={name} aria-label={`Add ${name}`} onClick={()=>{onChange({items:[...items,{id,quantity:1}]});setQuery('');}}><ItemImage id={id}/><span>{name}</span></button>)}</div>}
  </div>
  <div className="gm-edit-field"><span>Chat options <small>in order</small></span>
   {lines.length>0&&<ol className="gm-edit-lines">{lines.map((line,j)=><li key={j}><b>{j+1}.</b><input aria-label={`Chat option ${j+1}`} value={line} maxLength={L.line} placeholder="The option to pick, like Can I have a quest?" onChange={e=>setLines(lines.map((x,k)=>k===j?e.target.value:x))}/><button type="button" aria-label={`Remove chat option ${j+1}`} title="Remove" onClick={()=>setLines(lines.filter((_,k)=>k!==j))}><X size={14}/></button></li>)}</ol>}
   {lines.length<L.dialogue&&<button type="button" className="btn sm ghost gm-edit-add" onClick={()=>setLines([...lines,''])}><Plus size={14} aria-hidden="true"/>Chat option</button>}
  </div>
  <label className="gm-edit-field"><span>Note</span><input value={pin.note??''} maxLength={L.note} placeholder="Optional, like Wear the Ghostspeak amulet" onChange={e=>onChange({note:e.target.value})}/></label>
 </div>;
}
