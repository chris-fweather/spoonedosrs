'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import L from 'leaflet';
import {MAP_PIN_HINT,MAP_PLACES,isFightKind,MAP_ZOOM,guideMapFocus,guideMapLegs,guideMapStopColours,type GuideMap,type GuideMapPin} from '@/lib/guide-map';
import {guideItemImage} from '@/lib/guides';
import {stopLook,type StopTeleport} from '@/lib/guide-map-teleports';
import {midpointOnLine,pathKey,type PathPoint} from '@/lib/guide-map-paths';
import {walkingPaths} from './guide-map-paths';
import {GAME_CRS,areaFrame,drawExits,escapeHtml as escape,stepWheelZoom,terrainLayer,tileLatLng} from './map-canvas';
import {exitLabel,exitsIn,inBox,type Box,type MapExit,type PlaceNames} from '@/lib/world-map-exits';
import {markerSize} from '@/lib/world-map-markers';
import {townNear} from '@/lib/world-map-places';
import {undergroundName} from '@/lib/world-map-underground';

// Exits name where they lead from the site's town list and the named underground areas.
const TOWNS=MAP_PLACES.map(p=>({...p,kind:'town' as const}));
const EXIT_NAMES:PlaceNames={town:t=>townNear(TOWNS,t),area:t=>undergroundName(t)};
// Stops on the same tile (going back to someone) sit side by side, so neither number hides the other.
const SAME_TILE_GAP=24;
function pinIcon(pin:GuideMapPin,n:number,active:boolean,colour:string|null,shift=0,faded=false,ways:StopTeleport[]=[]){
 const {icon,hint,item}=stopLook(pin,ways,guideItemImage);
 return L.divIcon({className:'gm-marker',iconSize:[30,38],iconAnchor:[15-shift,36],html:`<span class="gm-pin kind-${pin.kind}${item?' has-item':''}${colour?' has-leg':''}${active?' is-active':''}${faded?' is-faded':''}"${colour?` style="--leg:${colour}"`:''}><b>${n}</b>${icon?`<img src="${escape(icon)}" alt="" title="${escape(hint)}">`:''}</span>`});
}
// A stop's label over its pin, with the fight style for a fight. Its details (items, chat options, note) open in the list of
// stops under the map, so the map never repeats them.
function pinLabel(pin:GuideMapPin){
 const hint=isFightKind(pin.kind)?`<small class="gm-card-hint">${escape(MAP_PIN_HINT[pin.kind])}</small>`:'';
 return `<strong>${escape(pin.label)}</strong>${hint}`;
}
// A small chevron halfway along a leg, pointing the way to walk; only on legs long enough to fit it between the pins.
const tile=(p:GuideMapPin)=>({x:p.x,y:p.y,plane:p.plane});
const ARROW_MIN_PX=84;
function arrowIcon(colour:string,degrees:number){
 return L.divIcon({className:'gm-arrow',iconSize:[14,14],iconAnchor:[7,7],html:`<svg viewBox="0 0 14 14" style="transform:rotate(${degrees}deg)"><path d="M4 2.5 9 7 4 11.5" fill="none" stroke="#0b0a08" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-opacity=".7"/><path d="M4 2.5 9 7 4 11.5" fill="none" stroke="${colour}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`});
}

/** A Leaflet map of the game world with numbered stops. Editors click to place a stop and the view is reported back. */
/** `highlight` is the stop whose pin and leg stand out (a hovered stop in the list); the leg falls back to the active stop.
 * Hovering a pin reports it through `onHover`, so its row in the list lights up too. Reading a
 * guide, the active stop is focused: only its leg is drawn, the other stops fade, and the map fits that leg. */
/** The map shows one floor of one area (`area`: the surface or an underground area) and its exits; `jump` moves the view
 * after an exit. */
export default function GuideMapView({map,plane,area,exits,onExit,jump,active,highlight,onActive,onHover,onPlace,onView,editing=false,teleports}:{teleports?:StopTeleport[][];map:GuideMap;plane:number;area:Box;exits:MapExit[];onExit:(e:MapExit)=>void;jump?:{x:number;y:number;key:number}|null;active?:number|null;highlight?:number|null;onActive?:(i:number)=>void;onHover?:(i:number|null)=>void;onPlace?:(x:number,y:number)=>void;onView?:(v:{x:number;y:number;zoom:number})=>void;editing?:boolean}){
 // The focused part of the route (readers only): the active stop's leg and the stops at its ends.
 const focus=useMemo(()=>editing||active==null||!map.pins[active]?null:guideMapFocus({pins:map.pins,lines:map.lines},active),[editing,active,map.pins,map.lines]);
 const el=useRef<HTMLDivElement>(null),leaflet=useRef<L.Map|null>(null),layer=useRef<L.TileLayer|null>(null),pins=useRef<L.LayerGroup|null>(null),lines=useRef<L.LayerGroup|null>(null),doors=useRef<L.LayerGroup|null>(null),frame=useRef<ReturnType<typeof areaFrame>|null>(null);
 const [zoom,setZoom]=useState(map.zoom),[moved,setMoved]=useState(0);
 const latest=useRef({onActive,onHover,onPlace,onView,onExit,area});latest.current={onActive,onHover,onPlace,onView,onExit,area};
 const markers=useRef<(L.Marker|null)[]>([]);
 useEffect(()=>{
  const m=L.map(el.current!,{crs:GAME_CRS,minZoom:MAP_ZOOM.min,maxZoom:MAP_ZOOM.max,maxBoundsViscosity:1,scrollWheelZoom:false,zoomSnap:1,attributionControl:true});
  m.attributionControl.setPrefix(false);
  m.setView(tileLatLng(map.x,map.y),map.zoom,{animate:false});
  frame.current=areaFrame(m,MAP_ZOOM.min);
  lines.current=L.layerGroup().addTo(m);doors.current=L.layerGroup().addTo(m);pins.current=L.layerGroup().addTo(m);
  m.on('zoomend',()=>setZoom(m.getZoom()));
  m.on('moveend',()=>setMoved(n=>n+1));
  m.on('click',e=>{const x=Math.floor(e.latlng.lng),y=Math.floor(e.latlng.lat);if(inBox(latest.current.area,x,y))latest.current.onPlace?.(x,y);});
  m.on('moveend',()=>{const c=m.getCenter();latest.current.onView?.({x:Math.floor(c.lng),y:Math.floor(c.lat),zoom:m.getZoom()});});
  // Reading a guide, the wheel scrolls the page; one click on the map lets it zoom.
  let wheel=editing;stepWheelZoom(m,()=>wheel);
  if(!editing){m.on('focus click',()=>{wheel=true;});m.on('blur mouseout',()=>{wheel=false;});}
  const resize=new ResizeObserver(()=>m.invalidateSize());resize.observe(el.current!);
  leaflet.current=m;
  return()=>{resize.disconnect();m.remove();leaflet.current=null;};
  // The map is created once; later changes move it below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 // The view stays inside the area, with terrain for this floor of it. Runs before the effects below move the view.
 useEffect(()=>{
  const m=leaflet.current;if(!m)return;
  frame.current?.set(area);
  layer.current?.remove();
  layer.current=terrainLayer(plane,MAP_ZOOM.min,MAP_ZOOM.max,area).addTo(m);
 },[plane,area]);
 useEffect(()=>{const m=leaflet.current;if(m&&jump)m.setView(tileLatLng(jump.x,jump.y),Math.max(m.getZoom(),MAP_ZOOM.initial+1),{animate:false});},[jump]);
 // Exits on this floor, beside a stop drawn on the same spot.
 useEffect(()=>{
  const m=leaflet.current,group=doors.current;if(!m||!group)return;
  const shown=map.pins.filter(p=>p.plane===plane);
  const aside=markerSize(m.getZoom())+6;
  drawExits(m,group,exitsIn(exits,plane,area),e=>latest.current.onExit(e),{label:e=>exitLabel(e,EXIT_NAMES),offset:e=>shown.some(p=>Math.abs(p.x-e.from.x)<=1&&Math.abs(p.y-e.from.y)<=1)?aside:0});
 },[exits,plane,area,map.pins,zoom,moved]);
 useEffect(()=>{
  const group=pins.current;if(!group)return;group.clearLayers();
  const colours=guideMapStopColours({pins:map.pins,lines:map.lines}),shown=map.pins.map((p,i)=>i).filter(i=>map.pins[i].plane===plane);
  const at=(i:number)=>`${map.pins[i].x},${map.pins[i].y}`,shift=(i:number)=>{const same=shown.filter(j=>at(j)===at(i));return (same.indexOf(i)-(same.length-1)/2)*SAME_TILE_GAP;};
  const focused=focus?.stops??null;markers.current=[];
  map.pins.forEach((pin,i)=>{if(pin.plane!==plane||!inBox(area,pin.x,pin.y))return;
   const marker=L.marker(tileLatLng(pin.x,pin.y),{icon:pinIcon(pin,i+1,active===i,colours[i],shift(i),!!focused&&!focused.includes(i),teleports?.[i]),title:pin.label||`Stop ${i+1}`,keyboard:true,zIndexOffset:active===i?1000:0});
   if(pin.label&&(!focused||focused.includes(i)))marker.bindTooltip(pinLabel(pin),{direction:'top',offset:[shift(i),-34],className:'gm-pin-tip'});
   marker.on('click',e=>{L.DomEvent.stopPropagation(e);latest.current.onActive?.(i);});
   marker.on('mouseover',()=>latest.current.onHover?.(i));
   marker.on('mouseout',()=>latest.current.onHover?.(null));
   marker.addTo(group);markers.current[i]=marker;
  });
 },[map.pins,map.lines,plane,area,active,focus,teleports]);
 // The highlighted stop's pin stands out and comes to the front; set on the pins already drawn, so hovering never redraws them.
 useEffect(()=>{
  markers.current.forEach((m,i)=>{if(!m)return;const lit=highlight===i;m.getElement()?.querySelector('.gm-pin')?.classList.toggle('is-lit',lit);m.setZIndexOffset(lit?2000:active===i?1000:0);});
 },[highlight,active,map.pins,map.lines,plane,area,focus,teleports]);
 // The route: each walking leg follows the tiles a player walks (worked out off the main thread), over a dark halo so it
 // shows on any terrain. A leg waits for its path rather than flashing a straight line first; a leg with no walking path
 // (water, a locked door, too far) is a straight dashed line.
 const legs=useMemo(()=>guideMapLegs({pins:map.pins,lines:map.lines}).filter(l=>l.plane===plane&&inBox(area,map.pins[l.to].x,map.pins[l.to].y)),[map.pins,map.lines,plane,area]);
 const [paths,setPaths]=useState<Record<string,PathPoint[]|null>>({});
 useEffect(()=>{
  if(!legs.length)return;
  let live=true;const asks=legs.map(l=>({from:tile(map.pins[l.from]),to:tile(map.pins[l.to])}));
  walkingPaths(asks).then(found=>{if(live)setPaths(old=>{const next={...old};asks.forEach((a,i)=>{next[pathKey(a.from,a.to)]=found[i];});return next;});});
  return()=>{live=false;};
 },[legs,map.pins]);
 const lit=highlight??active??null;
 useEffect(()=>{
  const group=lines.current,m=leaflet.current;if(!group||!m)return;group.clearLayers();
  const lead=focus?focus.leg?.to??-1:legs.some(l=>l.to===lit)?lit:null;
  for(const leg of legs){
   if(focus&&leg.to!==lead)continue;
   const a=map.pins[leg.from],b=map.pins[leg.to],key=pathKey(tile(a),tile(b));
   if(!(key in paths))continue;
   const path=paths[key],points=(path??[[a.x,a.y],[b.x,b.y]]).map(([x,y])=>tileLatLng(x,y)),on=lead===leg.to,dim=lead!==null&&!on;
   const style={interactive:false,lineCap:'round' as const,lineJoin:'round' as const,dashArray:path?undefined:'7 9'};
   L.polyline(points,{...style,color:'#0b0a08',weight:on?9:7,opacity:dim?.25:.55}).addTo(group);
   L.polyline(points,{...style,color:leg.colour,weight:on?5:3.5,opacity:dim?.4:1}).addTo(group);
   const mid=midpointOnLine(points.map(p=>m.latLngToLayerPoint(p)));
   if(!mid||mid.length<ARROW_MIN_PX)continue;
   L.marker(m.layerPointToLatLng(L.point(mid.x,mid.y)),{icon:arrowIcon(leg.colour,mid.degrees),interactive:false,keyboard:false,opacity:dim?.4:1}).addTo(group);
  }
 },[legs,map.pins,paths,lit,zoom,focus]);
 // Editing, choosing a stop centres it. Reading, the map fits the focused leg (along its walking path once that has
 // arrived) or the lone stop, and goes back to the writer's view when the focus is cleared.
 useEffect(()=>{if(!editing)return;const pin=active===null||active===undefined?null:map.pins[active];if(pin&&leaflet.current&&pin.plane===plane)leaflet.current.panTo(tileLatLng(pin.x,pin.y));},[editing,active,map.pins,plane]);
 const focusKey=focus?.leg?pathKey(tile(map.pins[focus.leg.from]),tile(map.pins[focus.leg.to])):null,focusPath=focusKey&&focusKey in paths?paths[focusKey]:null;
 const fitted=useRef(false);
 useEffect(()=>{
  const m=leaflet.current;if(!m||editing)return;
  if(!focus){if(fitted.current&&plane===map.plane&&inBox(area,map.x,map.y))m.setView(tileLatLng(map.x,map.y),map.zoom);fitted.current=false;return;}
  const stops=focus.stops.map(i=>map.pins[i]).filter(p=>p.plane===plane&&inBox(area,p.x,p.y));if(!stops.length)return;
  const points=(focusPath??stops.map(p=>[p.x,p.y] as PathPoint)).map(([x,y])=>tileLatLng(x,y)),bounds=L.latLngBounds(points);
  fitted.current=true;
  if(points.length<2||bounds.getNorthEast().equals(bounds.getSouthWest())){m.setView(points[0],Math.max(m.getZoom(),MAP_ZOOM.initial+1));return;}
  // Room for the zoom buttons (top left), the Route button (top right) and the pin heads above each stop.
  m.fitBounds(bounds,{paddingTopLeft:[48,84],paddingBottomRight:[40,28],maxZoom:MAP_ZOOM.max-1});
  // Refit only when the focus, the floor or the leg's path changes, not on every map move.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[editing,focus,plane,area,focusPath]);
 return <div ref={el} className={'gm-canvas'+(editing?' is-editing':'')}/>;
}
