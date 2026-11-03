'use client';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Check, X} from 'lucide-react';
import {lockPageScroll} from '@/lib/scroll-lock';
import {DEFAULT_TRAVEL, HOUSE_PORTAL_PRESETS, JEWELLERY_BOXES, NETWORKS, SPELLBOOKS, applyPortalPreset, presetOn, type NetworkId, type PortalPresetId, type TravelSettings} from '@/lib/world-map-settings';
import {ITEM_ICON, KIND_ICON, SPELLBOOK_ICON, TELEPORT_ITEM, TRAVEL_ICON, teleportGroupIcon} from '@/lib/world-map-places';

export type TravelOptionsFile = {v: 1; groups: {id: string; name: string; cat: string; icon?: number}[]; houses: Record<string, {name: string}>; portals: string[]};
const CATEGORIES: [string, string][] = [['jewellery', 'Jewellery'], ['diary', 'Diary rewards'], ['capes', 'Capes'], ['quest', 'Quest items'], ['tablets', 'Tablets and scrolls'], ['other', 'Other items']];
export const TABS = ['Teleports', 'Transport', 'House', 'Account'] as const;
export type TravelTab = (typeof TABS)[number];
/** The game draws every kind of transport with its one Transportation icon; shortcuts and portals have their own, and
 * fairy rings and spirit trees show the Dramen staff and our spirit tree drawing (TRAVEL_ICON). */
const NETWORK_ICON: Record<NetworkId, string> = {shortcut: TRAVEL_ICON.shortcut, boat: KIND_ICON.boat, charter: TRAVEL_ICON.transport, fairy: TRAVEL_ICON.fairy, spirit: TRAVEL_ICON.spirit, glider: KIND_ICON.glider, quetzal: KIND_ICON.quetzal, balloon: KIND_ICON.balloon, canoe: TRAVEL_ICON.transport, minecart: TRAVEL_ICON.transport, carpet: TRAVEL_ICON.transport, mushtree: KIND_ICON.mushtree, portal: TRAVEL_ICON.transport};

/** Portal presets: a spellbook's portals (with its spellbook icon) add or take away that set; All and None replace. */
const PRESETS: [PortalPresetId, string, string | null][] = [...HOUSE_PORTAL_PRESETS.map((p, i): [PortalPresetId, string, string] => [p.id, p.label, SPELLBOOK_ICON[i]]), ['all', 'All', null], ['none', 'None', null]];
const PRESET_TIP: Partial<Record<PortalPresetId, string>> = {all: 'Every portal', none: 'No portals'};
/** A toggle in a grid of options: pressed when the player has it. */
function Chip({on, onClick, icon, children}: {on: boolean; onClick: () => void; icon?: string; children: ReactNode}) {
  return <button type="button" className="wm-chip" aria-pressed={on} onClick={onClick}>{icon ? <img src={icon} alt=""/> : null}<span>{children}</span>{on && <Check size={14} aria-hidden="true"/>}</button>;
}
function Level({label, icon, value, onChange}: {label: string; icon: string; value: number; onChange: (n: number) => void}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return <label className="wm-level"><img src={icon} alt="" width={20} height={20}/>{label}<input inputMode="numeric" value={text} onChange={e => {setText(e.target.value); const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= 99) onChange(n);}} onBlur={() => setText(String(value))} aria-label={label + ' level'}/></label>;
}

/** Which teleports, transport and house features the player has; saved in this browser. As a `sheet` (phones, from the
 * map's Teleports button) it opens low on the screen over a clear backdrop, so the map above shows the changes. */
export function TravelOptions({value, options, onChange, onClose, sheet = false, initialTab = 'Teleports'}: {value: TravelSettings; options: TravelOptionsFile | null; onChange: (s: TravelSettings) => void; onClose: () => void; sheet?: boolean; initialTab?: TravelTab}) {
  const dialog = useRef<HTMLDialogElement>(null), [tab, setTab] = useState<TravelTab>(initialTab);
  useEffect(() => {
    const el = dialog.current, previous = document.activeElement instanceof HTMLElement ? document.activeElement : null, restore = lockPageScroll();
    el?.showModal();
    return () => {el?.close(); restore(); previous?.focus({preventScroll: true});};
  }, []);
  const set = (patch: Partial<TravelSettings>) => onChange({...value, ...patch});
  const house = (patch: Partial<TravelSettings['house']>) => set({house: {...value.house, ...patch}});
  const toggle = <T,>(list: T[], item: T) => list.includes(item) ? list.filter(x => x !== item) : [...list, item];
  const groups = options?.groups ?? [], portals = options?.portals ?? [];
  return createPortal(<dialog ref={dialog} className={'modal wm-options' + (sheet ? ' is-sheet' : '')} aria-labelledby="wm-options-title" onCancel={e => {e.preventDefault(); onClose();}}>
    <div className="modal-body">
      <header className="modal-head"><div className="modal-title"><h2 id="wm-options-title">Teleports &amp; travel</h2><span className="muted sm">Routes only use what you switch on.</span></div><button type="button" className="icon-btn" aria-label="Close teleports and travel" onClick={onClose}><X size={19}/></button></header>
      <div className="tabs" role="tablist">{TABS.map(t => <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}</div>
      <div className="modal-scroll">
        {tab === 'Teleports' && <>
          <section className="wm-option-group"><h3>Spellbooks</h3><div className="wm-chips">{SPELLBOOKS.map((b, i) => <Chip key={b} icon={SPELLBOOK_ICON[i]} on={value.spellbooks.includes(i)} onClick={() => set({spellbooks: toggle(value.spellbooks, i)})}>{b}</Chip>)}
            <Chip icon={teleportGroupIcon('home', 'Home teleport')} on={value.home} onClick={() => set({home: !value.home})}>Home teleport</Chip>
            <Chip icon={teleportGroupIcon('minigames', 'Minigame teleports')} on={value.minigames} onClick={() => set({minigames: !value.minigames})}>Minigame teleports</Chip></div></section>
          {!options && <p className="muted sm">Loading teleports…</p>}
          {CATEGORIES.map(([cat, label]) => {const list = groups.filter(g => g.cat === cat); return list.length ? <section key={cat} className="wm-option-group"><h3>{label}</h3><div className="wm-chips">{list.map(g => <Chip key={g.id} icon={teleportGroupIcon(g.id, g.name, g.icon)} on={value.items.includes(g.id)} onClick={() => set({items: toggle(value.items, g.id)})}>{g.name}</Chip>)}</div></section> : null;})}
        </>}
        {tab === 'Transport' && <section className="wm-option-group"><h3>Transport you can use</h3><div className="wm-chips">{NETWORKS.map(n => <Chip key={n.id} icon={NETWORK_ICON[n.id]} on={value.networks[n.id]} onClick={() => set({networks: {...value.networks, [n.id]: !value.networks[n.id]}})}>{n.label}</Chip>)}</div></section>}
        {tab === 'House' && <>
          <section className="wm-option-group"><h3>House location</h3>
            <select className="wm-select" value={value.house.location} onChange={e => house({location: Number(e.target.value)})} aria-label="House location"><option value={0}>No house</option>{Object.entries(options?.houses ?? {}).map(([id, h]) => <option key={id} value={id}>{h.name}</option>)}</select></section>
          {value.house.location > 0 && <>
            <section className="wm-option-group"><h3>Getting there</h3><div className="wm-chips"><Chip icon={teleportGroupIcon('house', 'Teleport to house')} on={value.house.teleport} onClick={() => house({teleport: !value.house.teleport})}>Teleport to house</Chip></div></section>
            <section className="wm-option-group"><h3>Jewellery box</h3><div className="seg wm-seg" role="group" aria-label="Jewellery box">{JEWELLERY_BOXES.map((b, i) => <button key={b} type="button" aria-pressed={value.house.box === i} onClick={() => house({box: i})}>{b}</button>)}</div></section>
            <section className="wm-option-group"><h3>Mounted and garden</h3><div className="wm-chips">
              <Chip icon={ITEM_ICON(TELEPORT_ITEM['Amulet of glory'])} on={value.house.glory} onClick={() => house({glory: !value.house.glory})}>Amulet of glory</Chip>
              <Chip icon={ITEM_ICON(TELEPORT_ITEM["Xeric's talisman"])} on={value.house.xeric} onClick={() => house({xeric: !value.house.xeric})}>Xeric&apos;s talisman</Chip>
              <Chip icon={ITEM_ICON(TELEPORT_ITEM['Digsite pendant'])} on={value.house.digsite} onClick={() => house({digsite: !value.house.digsite})}>Digsite pendant</Chip>
              <Chip icon={ITEM_ICON(TELEPORT_ITEM['Mythical cape'])} on={value.house.mythical} onClick={() => house({mythical: !value.house.mythical})}>Mythical cape</Chip>
              <Chip icon={TRAVEL_ICON.fairy} on={value.house.fairy} onClick={() => house({fairy: !value.house.fairy})}>Fairy ring</Chip>
              <Chip icon={TRAVEL_ICON.spirit} on={value.house.spirit} onClick={() => house({spirit: !value.house.spirit})}>Spirit tree</Chip></div></section>
            <section className="wm-option-group"><h3>Portals and nexus</h3>
              <div className="seg wm-presets" role="group" aria-label="Portal presets">{PRESETS.map(([id, label, icon]) => {const on = presetOn(id, value.house.portals, portals); return <button key={id} type="button" aria-pressed={on} title={PRESET_TIP[id] ?? label + ' spellbook portals'} onClick={() => house({portals: applyPortalPreset(id, value.house.portals, portals)})}>{icon && <img src={icon} alt=""/>}{label}</button>;})}</div>
              <div className="wm-chips">{(options?.portals ?? []).map(p => <Chip key={p} icon={TRAVEL_ICON.housePortal} on={value.house.portals.includes(p)} onClick={() => house({portals: toggle(value.house.portals, p)})}>{p}</Chip>)}</div></section>
          </>}
        </>}
        {tab === 'Account' && <>
          <section className="wm-option-group"><h3>Levels</h3><div className="wm-levels"><Level label="Agility" icon="/icons/skills/agility.png" value={value.agility} onChange={agility => set({agility})}/><Level label="Magic" icon="/icons/skills/magic.png" value={value.magic} onChange={magic => set({magic})}/></div></section>
          <section className="wm-option-group"><h3>Progress</h3><div className="wm-chips"><Chip icon="/ui/quest-point-icon.png" on={value.quests} onClick={() => set({quests: !value.quests})}>Quests done</Chip><Chip icon="/ui/achievement-diaries-icon.png" on={value.unlocks} onClick={() => set({unlocks: !value.unlocks})}>Diaries and unlocks</Chip></div>
            <p className="fine">Other skills, items and unlocks are taken as met.</p></section>
        </>}
      </div>
      <footer className="modal-foot"><button type="button" className="btn ghost" onClick={() => onChange(structuredClone(DEFAULT_TRAVEL))}>Reset</button><span className="muted"/><button type="button" className="btn primary" onClick={onClose}>Done</button></footer>
    </div>
  </dialog>, document.body);
}

/** "8 teleports · 12 transport" for the button that opens the options. */
export function travelSummary(s: TravelSettings) {
  const teleports = s.items.length + s.spellbooks.length + (s.home ? 1 : 0) + (s.minigames ? 1 : 0) + (s.house.location && s.house.teleport ? 1 : 0);
  const transport = Object.values(s.networks).filter(Boolean).length;
  return `${teleports} teleport${teleports === 1 ? '' : 's'} · ${transport} transport`;
}
