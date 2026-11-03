'use client';
import './profile-appearance.css';
import {Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode} from 'react';
import {Check, X} from 'lucide-react';
import {badgeCatalogue, badgeTier, coerceFlair, emptyEquipped, equipItem, obtainedItems, wearables, type EquipSlot, type FlairChoice} from '@/lib/flair';
import {VARIANT_NAMES,styleGroups,styleLabels} from '@/lib/item-variants';
import type {Journal} from '@/lib/model';
import type {ProfileFlair} from './Profile';
import {LookStage} from './Look';
import {titleChoices, selectedTitle, titleEffect, titleRarity, titleProgress, editableTitleChoice} from '@/lib/presentation';
import {STAFF_LABEL,STAFF_TONE,rankNameClass,type StaffRole} from '@/lib/staff-policy';
import {GildedIcon, PrefixWord, RankIcon, StaffPrefix} from './StaffBadge';
import {SQUIRE_PREFIX} from '@/lib/features';
import type {NamePrefix} from '@/lib/name-prefix';
import {AchievementEmblem} from './AchievementEmblem';
import {BACKGROUNDS,CHARACTER_SCENES,DEFAULT_APPEARANCE,SKIN_TONES,HAIR_COLORS,featuredEmblem,appearanceModels,type Appearance} from '@/lib/appearance';
import {displayTitle} from '@/lib/flair';
import {num} from '@/lib/ui';
import {AchievementTitle} from './AchievementTitle';
import {companionDescription} from '@/lib/pet-presentation';
import {Meter} from './Meter';
import {HoverTip} from './HoverTip';
import {hasGildedSupporter} from '@/lib/staff-appearance';
import type {Presentation} from '@/lib/presentation';
import {lockPageScroll} from '@/lib/scroll-lock';
import {AccountModeBadge} from './AccountModeBadge';
import './profile-identity.css';
import {SKIN_LABELS,HAIR_SWATCHES} from '@/lib/game-colors';

const itemName=(id:string,name:string)=>VARIANT_NAMES[id]??name;
const LABEL:Record<EquipSlot,string>={head:'Head',cape:'Cape',neck:'Amulet',weapon:'Weapon',body:'Body',shield:'Shield',legs:'Legs',hands:'Gloves',feet:'Boots',ring:'Ring',ammo:'Ammo'};
/** The in-game worn equipment grid: gloves, boots and ring share the bottom row, in that order. */
const GRID:(EquipSlot|null)[]=[null,'head',null,'cape','neck','ammo','weapon','body','shield',null,'legs',null,'hands','feet','ring'];
type Tab='equipment'|'appearance'|'badges';
/** Renders of the real three.js scenes (lib/profile-scene.ts) with the default base character. */
const HAIR_LABELS:Record<Appearance['hair'],string>={brown:'Brown',blonde:'Blonde',black:'Black',red:'Red',grey:'Grey'};
const HAIR_OPTIONS=HAIR_COLORS.map(id=>({id,label:HAIR_LABELS[id],color:HAIR_SWATCHES[id]}));
const SKIN_OPTIONS=(Object.keys(SKIN_TONES) as NonNullable<Appearance['skin']>[]).map(id=>({id,label:SKIN_LABELS[id],color:SKIN_TONES[id]}));
const SCENE_ART:Record<keyof typeof BACKGROUNDS,string>={none:'/ui/scenes/none.webp',castle:'/ui/scenes/castle.webp',riverside:'/ui/scenes/riverside.webp',mine:'/ui/scenes/mine.webp',woodland:'/ui/scenes/woodland.webp'};

export function ProfileEditor({journal:j,flair,onSave,onClose,initialTab='equipment',portraitAspect}:{journal:Journal;flair:ProfileFlair;onSave:(next:ProfileFlair)=>Promise<boolean>;onClose:()=>void;initialTab?:Tab;portraitAspect?:number}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const isOwner=flair.staff?.role==='owner';
  const isSupporter=flair.supporter??displayTitle(j.username,flair.title)==='the Generous';
  // The prefix earned today (Sir, or Squire for helpers and guide writers); choosing it is a yes or no.
  const earned=flair.earnedPrefix??(flair.staff?'Sir':null);
  const [identityTab,setIdentityTab]=useState<'title'|'rank'|'achievement'|'emblems'>('achievement');
  const [tier,setTier]=useState('all');
  const [appearance,setAppearance]=useState<Appearance>(flair.appearance??DEFAULT_APPEARANCE);
  const starting=()=>coerceFlair(j,flair);
  const [draft,setDraft]=useState<FlairChoice>(starting);
  const [staffBadge,setStaffBadge]=useState<Presentation['staffBadge']>(flair.staffBadge??null);
  const [staffPrefix,setStaffPrefix]=useState<NamePrefix|null>(flair.staffPrefix&&earned?earned:null);
  const [titleChoice,setTitleChoice]=useState(()=>editableTitleChoice(j,flair.titleChoice??'auto',flair.pinnedMark,isOwner,isSupporter,flair.staff?.role));
  const [tab,setTab]=useState<Tab>(initialTab);
  const [slot,setSlot]=useState<EquipSlot|'pet'>('head');
  const [query,setQuery]=useState('');
  const [saving,setSaving]=useState(false), [error,setError]=useState('');
  const badges=badgeCatalogue(j);
  const previewTitle=selectedTitle(j,titleChoice,draft.pinnedMark,isOwner,isSupporter,flair.staff?.role);
  const badge=badges.find(b=>b.id===draft.pinnedMark);
  const pet=j.pets.find(p=>p.id===draft.companionPet);
  const donation=flair.donation?{...flair.donation,badge:staffBadge==='gilded'?'gilded' as const:null}:undefined;
  useEffect(()=>{const el=dialog.current;const restore=lockPageScroll();el?.showModal();return()=>{el?.close();restore();};},[]);
  const owned=useMemo(()=>obtainedItems(j),[j]);
  const choices=slot==='pet'
    ? j.pets.filter(p=>p.obtained&&wearables.pets[p.id]).map(p=>({id:p.id,name:p.name,img:`/pets/${p.id}.png`}))
    : Object.entries(wearables.items).filter(([id,item])=>item.slot===slot&&owned.has(id)).map(([id,item])=>({id,name:itemName(id,item.name),img:`/items/${id}.png`}));
  // Versions of one item (Torva and Sanguine torva, graceful colours, (g) and (t) trims) are one choice with a Styles row.
  const groups=slot==='pet'?choices.map(item=>[item]):styleGroups(choices,id=>itemName(id,wearables.items[id]?.name??id));
  const filtered=groups.filter(group=>group.some(item=>item.name.toLowerCase().includes(query.trim().toLowerCase())));
  const picked=slot==='pet'?draft.companionPet:draft.equipped[slot];
  const visibleBadges=badges.filter(b=>featuredEmblem(b.id)||b.id===draft.pinnedMark).filter(b=>(tier==='all'||badgeTier(b.id)===tier)).filter(b=>(b.name+' '+b.detail).toLowerCase().includes(query.trim().toLowerCase()));
  const headItem=draft.equipped.head?wearables.items[draft.equipped.head]:undefined;
  const hairHidden=!!headItem?.wear.includes(8)&&(appearance.body==='male'||!!appearanceModels.femaleItems[draft.equipped.head!]);
  // The Styles tray hangs under the chosen item's row; its notch points at that card wherever the grid puts it.
  const pickedCard=useRef<HTMLButtonElement>(null),stylesTray=useRef<HTMLDivElement>(null);
  const [notch,setNotch]=useState<number|null>(null);
  useLayoutEffect(()=>{const card=pickedCard.current,tray=stylesTray.current;if(!card||!tray)return;const place=()=>{const c=card.getBoundingClientRect(),t=tray.getBoundingClientRect();setNotch(Math.round(c.left+c.width/2-t.left));};place();const observer=new ResizeObserver(place);observer.observe(tray);return()=>observer.disconnect();},[picked,slot,query,tab]);
  const close=()=>{if(!saving)onClose();};
  function choose(id:string|null){setDraft(d=>slot==='pet'?{...d,companionPet:id}:{...d,equipped:equipItem(d.equipped,slot,id),displayPiece:null});}
  // Privacy lives in Account settings; the save never sends it, so the stored choices stay as they are.
  async function save(){if(saving)return;setSaving(true);setError('');try{if(await onSave({...flair,...draft,appearance,staffBadge,staffPrefix,titleChoice,preview:false}))onClose();else setError('Could not save. Your choices are still here.');}catch{setError('Could not save. Please retry.');}finally{setSaving(false);}}
  return <dialog ref={dialog} className="profile-studio" aria-labelledby="studio-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target===dialog.current)close();}}>
    <div className="studio-shell">
      <header className="studio-header"><div><h2 id="studio-title">Profile settings</h2><p>Your equipment, companion and achievements.</p></div><button type="button" className="icon-btn" aria-label="Close profile settings" disabled={saving} onClick={close}><X size={20}/></button></header>
      <div className="studio-navigation">          <div className="studio-toolbar"><div className="seg"><button type="button" aria-pressed={tab==='equipment'} onClick={()=>{setTab('equipment');setQuery('');}}>Outfit &amp; pet</button><button type="button" aria-pressed={tab==='appearance'} onClick={()=>setTab('appearance')}>Appearance</button><button type="button" aria-pressed={tab==='badges'} onClick={()=>{setTab('badges');setQuery('');}}>Titles &amp; emblems</button></div></div>
          <p className="studio-hint">{tab==='equipment'?'Select an equipment slot, then an item from your collection.':tab==='appearance'?'Choose your body, hair colour and skin tone.':'Choose your name title, site rank, achievement title and emblem.'}</p>
</div>
      <div className={`studio-layout studio-tab-${tab}`}>
        <aside className="studio-preview"><div className="studio-identity char-name"><div className="profile-identity"><span className="profile-prefixes"><StaffPrefix staff={flair.staff?{...flair.staff,displayRole:staffBadge==='gilded'?null:staffBadge,displayPrefix:staffPrefix}:null} prefix={flair.staff?null:staffPrefix} donation={donation}/><AccountModeBadge mode={j.accountMode}/></span><div className="profile-name-lines"><b><span className={rankNameClass(flair.staff?{...flair.staff,displayRole:staffBadge==='gilded'?null:staffBadge}:null)}>{j.username}</span>{flair.title&&<span className="rs-title">{flair.title}</span>}</b>{previewTitle&&<AchievementTitle className="preview-title" label={previewTitle}/>}</div></div></div><div className="studio-model" style={{'--portrait-aspect':portraitAspect&&portraitAspect>.3&&portraitAspect<3?portraitAspect:.8} as CSSProperties}><LookStage appearance={appearance} equipped={draft.equipped} petId={pet?.id??null} petName={pet?.name??null} petDescription={pet?companionDescription(j,pet.id,pet.name):undefined} username={j.username}/>{badge&&tab!=='appearance'&&<span className="studio-emblem-tip" aria-label={`${badgeTier(badge.id)} · ${badge.name}`}><AchievementEmblem mark={badge} className="studio-emblem"/></span>}</div><b className="studio-preview-label">Your profile preview</b>{badge&&<small>{badge.name} · {badgeTier(badge.id)}</small>}</aside>
        <section className="studio-controls">
          <fieldset disabled={saving} className="studio-fields">
          {tab==='appearance'?<div className="studio-appearance compact-appearance"><fieldset className="appearance-body-picker"><legend>Body</legend><div className="appearance-body" role="group" aria-label="Character body">{(['male','female'] as const).map(body=><button type="button" aria-pressed={appearance.body===body} key={body} onClick={()=>setAppearance(a=>({...a,body}))}><span aria-hidden="true">{body==='female'?'♀':'♂'}</span><b>{body==='female'?'Female':'Male'}</b></button>)}</div></fieldset><ColourRow legend="Hair colour" options={HAIR_OPTIONS} selected={appearance.hair} note={hairHidden?'Hidden by your head item':null} onPick={hair=>setAppearance(a=>({...a,hair}))}/><ColourRow legend="Skin tone" options={SKIN_OPTIONS} selected={appearance.skin??'default'} onPick={skin=>setAppearance(a=>({...a,skin}))}/>{CHARACTER_SCENES&&<fieldset className="scene-picker"><legend>Character scene <span>{BACKGROUNDS[appearance.background??'none']}</span></legend><div className="wallpaper-picker">{(Object.keys(BACKGROUNDS) as (keyof typeof BACKGROUNDS)[]).map(key=><button type="button" key={key} aria-pressed={(appearance.background??'none')===key} onClick={()=>setAppearance(a=>({...a,background:key}))}><img src={SCENE_ART[key]} alt="" width={240} height={150} loading="lazy" decoding="async"/><span>{BACKGROUNDS[key]}</span>{(appearance.background??'none')===key&&<Check className="choice-check" size={14} aria-hidden="true"/>}</button>)}</div></fieldset>}<p className="appearance-note">Original OSRS base models and game palette colours. Lighting may differ from the game. Special skin colours can require in-game unlocks.</p></div>:tab==='equipment'?<div className="studio-equipment">
            <div className="studio-slots"><div className="worn-grid">{GRID.map((s,i)=>s?<button type="button" key={s} className={`equip-slot ${slot===s?'on':''} ${draft.equipped[s]?'filled':'empty'}`} aria-pressed={slot===s} aria-label={LABEL[s]} title={LABEL[s]} onClick={()=>{setSlot(s);setQuery('');}}><img src={draft.equipped[s]?`/items/${draft.equipped[s]}.png`:`/ui/slots/${s}.png`} alt=""/><small>{LABEL[s]}</small></button>:<span key={i}/>)}</div><button type="button" className="studio-pet-slot" aria-pressed={slot==='pet'} onClick={()=>{setSlot('pet');setQuery('');}}><img src={pet?`/pets/${pet.id}.png`:'/pets/20663.png'} alt=""/> Following pet</button><button type="button" className="link sm" onClick={()=>{setDraft(d=>({...d,equipped:emptyEquipped(),companionPet:null,displayPiece:null}));setAppearance(DEFAULT_APPEARANCE);}}>Reset character</button></div>
            <div className="studio-inventory"><div className="studio-inventory-head"><b>{slot==='pet'?'Following pet':LABEL[slot]}</b><small>{filtered.length} {filtered.length===1?"choice":"choices"}</small></div><div className="studio-search-row"><input className="studio-search" aria-label="Search equipment or pets" placeholder={`Search ${slot==='pet'?'pets':LABEL[slot].toLowerCase()}…`} value={query} onChange={e=>setQuery(e.target.value)}/><select className="studio-slot-filter" aria-label="Filter equipment slot or pets" value={slot} onChange={e=>{setSlot(e.target.value as EquipSlot|'pet');setQuery('');}}>{Object.entries(LABEL).map(([id,label])=><option key={id} value={id}>{label}</option>)}<option value="pet">Pets</option></select></div><div className="studio-item-list"><button type="button" className="studio-item" onClick={()=>choose(null)} aria-pressed={slot==='pet'?!draft.companionPet:!draft.equipped[slot]}><span className="empty-slot-icon">×</span><span>{slot==='pet'?'No following pet':'Remove custom item'}</span></button>{filtered.slice(0,120).map(group=>{const item=group.find(member=>member.id===picked)??group[0],on=item.id===picked,labels=group.length>1?styleLabels(group):[];return <Fragment key={group[0].id}><button type="button" ref={on?pickedCard:undefined} className="studio-item" aria-pressed={on} onClick={()=>choose(item.id)}><img src={item.img} alt=""/><span>{item.name}</span>{group.length>1&&<small className="style-count">{group.length} styles</small>}{appearance.body==='female'&&slot!=='pet'&&!appearanceModels.femaleItems[item.id]&&<small className="model-unavailable">Female model unavailable</small>}</button>{on&&group.length>1&&<div ref={stylesTray} className="studio-styles" role="group" aria-label={`Styles: ${item.name}`} style={notch===null?undefined:{'--notch':`${notch}px`} as CSSProperties}><p className="studio-styles-caption"><b>Style</b><span>{labels[group.indexOf(item)]}</span></p><div className="style-swatches">{group.map(member=><button type="button" key={member.id} className="style-swatch" title={member.name} aria-label={member.name} aria-pressed={member.id===picked} onClick={()=>choose(member.id)}><img src={member.img} alt=""/></button>)}</div></div>}</Fragment>;})}{!filtered.length&&<p className="studio-empty">{query?'No matches. Try a different name.':'No collected items for this slot yet.'}</p>}{filtered.length>120&&<p className="fine">Showing 120 matches. Search to narrow the list.</p>}</div></div>
          </div>:<div className="studio-badges">
            <div className="identity-tabs" role="tablist" aria-label="Titles and emblems" onKeyDown={e=>{const tabs=['title','rank','achievement','emblems'] as const;const index=tabs.indexOf(identityTab);const next=e.key==='ArrowRight'?(index+1)%4:e.key==='ArrowLeft'?(index+3)%4:e.key==='Home'?0:e.key==='End'?3:null;if(next!==null){e.preventDefault();setIdentityTab(tabs[next]);setQuery('');e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();}}}>
              {([['title','Title'],['rank','Site rank'],['achievement','Achievement title'],['emblems','Emblems']] as const).map(([id,label])=><button type="button" role="tab" id={`identity-tab-${id}`} aria-controls="identity-panel" aria-selected={identityTab===id} tabIndex={identityTab===id?0:-1} key={id} onClick={()=>{setIdentityTab(id);setQuery('');}}>{label}</button>)}
            </div>
            <div className="identity-panel" id="identity-panel" role="tabpanel" aria-labelledby={`identity-tab-${identityTab}`} tabIndex={0}>
            {identityTab==='title'?<div className="identity-options">
              <Choice><button type="button" className="identity-choice" aria-pressed={!staffPrefix} onClick={()=>setStaffPrefix(null)}><X className="choice-none" size={26} aria-hidden="true"/><b>None</b><Picked on={!staffPrefix}/></button></Choice>
              {(SQUIRE_PREFIX?['Sir','Squire'] as const:['Sir'] as const).map(word=>{const on=staffPrefix===word,how=earned===word?null:word==='Sir'?(SQUIRE_PREFIX?'For moderators, admins and the owner.':'For the site team.'):earned==='Sir'?'You show Sir, which outranks it.':'For helpers and guide writers.';return <Choice key={word} label={word} how={how}><button type="button" className="identity-choice" disabled={!!how} aria-pressed={on} onClick={()=>setStaffPrefix(word)}><b className="title-sample"><PrefixWord prefix={word}/> <span className="player-username">{j.username}</span></b><Picked on={on}/></button></Choice>;})}
            </div>:identityTab==='rank'?<div className="identity-options">
              {(['helper','moderator','admin','owner'] as StaffRole[]).map(role=>{const own=role===flair.staff?.role,on=(staffBadge??flair.staff?.role)===role;return <Choice key={role} label={STAFF_LABEL[role]} how={isOwner||own?null:'Assigned by the site team.'}><button type="button" className="identity-choice" disabled={!isOwner&&!own} aria-pressed={on} onClick={()=>setStaffBadge(isOwner?role:null)}><RankIcon staff={{role,prefix:null}}/><b className={STAFF_TONE[role]}>{STAFF_LABEL[role]}</b><Picked on={on}/></button></Choice>;})}
              <Choice label="Gilded supporter" how={hasGildedSupporter(flair.donation)?null:'Unlocks when your shown donations reach $100.'}><button type="button" className="identity-choice" disabled={!hasGildedSupporter(flair.donation)} aria-pressed={staffBadge==='gilded'} onClick={()=>setStaffBadge('gilded')}><GildedIcon/><b>Gilded supporter</b><Picked on={staffBadge==='gilded'}/></button></Choice>
              {!flair.staff&&<Choice><button type="button" className="identity-choice" aria-pressed={!staffBadge} onClick={()=>setStaffBadge(null)}><X className="choice-none" size={26} aria-hidden="true"/><b>None</b><Picked on={!staffBadge}/></button></Choice>}
            </div>:identityTab==='achievement'?<div className="identity-options achievement-options"><input className="studio-search" aria-label="Search achievement titles" placeholder="Search titles or requirements…" value={query} onChange={e=>setQuery(e.target.value)}/>
              {[{id:'none',label:'',requirement:'No achievement title',unlocked:true},...titleChoices(j,isSupporter,flair.staff?.role)].filter(t=>(t.label+' '+t.requirement).toLowerCase().includes(query.trim().toLowerCase())).map(t=>{const locked=!t.unlocked&&!isOwner,progress=titleProgress(j,t.id);return <Choice key={t.id} label={t.label} how={locked?t.requirement+'.':null} progress={locked&&progress?(progress.total?`${num(Math.min(progress.completed,progress.total),0)} / ${num(progress.total,0)} ${progress.unit}`:'Sync to see progress'):undefined}><button type="button" className="identity-choice" aria-label={t.label||'No achievement title'} disabled={locked} aria-pressed={titleChoice===t.id} onClick={()=>setTitleChoice(t.id)}>{t.id==='none'?<><X className="choice-none" size={26} aria-hidden="true"/><b>None</b></>:<><b className="title-sample"><span className={titleEffect(t.label)}>{t.label}</span></b><small className="title-rarity">{t.id==='auto'?'Default':titleRarity(t.label)}</small>{locked&&progress&&<Meter done={progress.completed} total={progress.total} unknown={!progress.total}/>}</>}<Picked on={titleChoice===t.id}/></button></Choice>;})}
            </div>:<>
<div className="emblem-toolbar"><input className="studio-search" aria-label="Search achievement emblems" placeholder="Search pets, combat, quests, diaries…" value={query} onChange={e=>setQuery(e.target.value)}/><label className="emblem-tier-filter"><span className="sr-only">Emblem tier</span><select aria-label="Filter emblem tier" value={tier} onChange={e=>setTier(e.target.value)}><option value="all">All tiers</option>{['bronze','silver','gold','platinum','diamond','legendary'].map(t=><option key={t} value={t}>{t}</option>)}</select></label></div><div className="studio-badge-list"><Choice><button type="button" className="badge-choice" onClick={()=>setDraft(d=>({...d,pinnedMark:null}))} aria-pressed={!draft.pinnedMark}><X className="choice-none" size={26} aria-hidden="true"/><b>None</b><Picked on={!draft.pinnedMark}/></button></Choice>{visibleBadges.map(b=><Choice key={b.id} label={b.name} how={b.unlocked?null:b.detail+'.'} progress={b.unlocked?undefined:`${num(Math.min(b.completed,b.total),0)} / ${num(b.total,0)}`}><button type="button" className="badge-choice" aria-label={`${b.name}: ${b.detail}`} disabled={!b.unlocked} aria-pressed={draft.pinnedMark===b.id} onClick={()=>setDraft(d=>({...d,pinnedMark:b.id}))}><AchievementEmblem mark={b} className="badge-token"/><b>{b.name}</b><small>{badgeTier(b.id)}</small>{!b.unlocked&&<Meter done={b.completed} total={b.total}/>}<Picked on={draft.pinnedMark===b.id}/></button></Choice>)}</div></>}
            </div></div>}
          </fieldset>
        </section>
      </div>
      <footer className="studio-footer"><span role="status" className={error?'studio-save-error':'studio-save-hint'}>{error|| 'Equipment and emblems must be unlocked before you can display them.'}</span><button type="button" className="btn ghost" disabled={saving} onClick={close}>Cancel</button><button type="button" className="btn primary" disabled={saving} onClick={()=>void save()}>{saving?'Saving…':'Save profile'}</button></footer>
    </div>
  </dialog>;
}

/** One cell of the titles and emblems grids. Locked options stay visible, dimmed, and say how to unlock on hover, tap or keyboard focus. */
function Choice({label='',how=null,progress,children}:{label?:string;how?:string|null;progress?:string;children:ReactNode}){
 if(!how)return <span className="choice-cell">{children}</span>;
 return <HoverTip className="choice-cell locked" label={`${label}: ${how}${progress?` ${progress}`:''}`} content={<span className="achievement-tooltip-content"><strong className="tooltip-heading">{label}</strong><span>{how}</span>{progress&&<span className="tooltip-detail">{progress}</span>}</span>}>{children}</HoverTip>;
}
function Picked({on}:{on:boolean}){return on?<Check className="choice-check" size={14} aria-hidden="true"/>:null;}

/** One row of round colour swatches. The chosen colour's name shows once, in the label; each swatch names itself on
 * hover and to screen readers. Arrow keys move the choice like a radio group. */
function ColourRow<T extends string>({legend,options,selected,onPick,note}:{legend:string;options:{id:T;label:string;color:string}[];selected:T;onPick:(id:T)=>void;note?:string|null}){
 const current=options.find(o=>o.id===selected)??options[0];
 const step=(e:KeyboardEvent<HTMLDivElement>)=>{const delta=e.key==='ArrowRight'||e.key==='ArrowDown'?1:e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:0;if(!delta)return;e.preventDefault();const index=(options.indexOf(current)+delta+options.length)%options.length;onPick(options[index].id);e.currentTarget.querySelectorAll<HTMLButtonElement>('button')[index]?.focus();};
 return <fieldset className="colour-picker"><legend>{legend}<span>{current.label}</span>{note&&<small>{note}</small>}</legend><div className="colour-swatches" role="radiogroup" aria-label={legend} onKeyDown={step}>{options.map(o=><button type="button" role="radio" key={o.id} className="colour-swatch" title={o.label} aria-label={`${legend}: ${o.label}`} aria-checked={o.id===current.id} tabIndex={o.id===current.id?0:-1} onClick={()=>onPick(o.id)}><i style={{background:o.color}}/></button>)}</div></fieldset>;
}
