'use client';
/** The list of the game's world maps over a map, like the dropdown on the game's own world map: the map shown, and a
 * list of the others to switch to. */
import {useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import {Check, ChevronDown} from 'lucide-react';
import type {GameMap} from '@/lib/world-maps';
import './map-canvas.css';

export function MapPicker({maps, value, onChange}: {maps: GameMap[]; value: GameMap; onChange: (m: GameMap) => void}) {
  const [open, setOpen] = useState(false), box = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null), id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {if (!box.current?.contains(e.target as Node)) setOpen(false);};
    document.addEventListener('pointerdown', close);
    box.current?.querySelector<HTMLButtonElement>('[aria-selected=true]')?.focus({preventScroll: true});
    box.current?.querySelector('[aria-selected=true]')?.scrollIntoView({block: 'nearest'});
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const choose = (m: GameMap) => {setOpen(false); button.current?.focus(); if (m !== value) onChange(m);};
  const keys = (e: KeyboardEvent<HTMLUListElement>) => {
    const items = [...(box.current?.querySelectorAll<HTMLButtonElement>('[role=option]') ?? [])], at = items.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === 'ArrowDown' ? Math.min(items.length - 1, at + 1) : e.key === 'ArrowUp' ? Math.max(0, at - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1;
    if (to >= 0) {e.preventDefault(); items[to]?.focus();}
    if (e.key === 'Escape' || e.key === 'Tab') {if (e.key === 'Escape') e.preventDefault(); setOpen(false); button.current?.focus();}
  };
  return <div className="map-picker" ref={box}>
    <button ref={button} type="button" className="map-picker-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} aria-label={`Map: ${value.name}`} onClick={() => setOpen(o => !o)}>
      <span>{value.name}</span><ChevronDown size={16} aria-hidden="true"/>
    </button>
    {open && <ul id={id} className="map-picker-list" role="listbox" aria-label="Maps" onKeyDown={keys}>
      {maps.map(m => <li key={m.id}><button type="button" role="option" aria-selected={m === value} onClick={() => choose(m)}><span>{m.name}</span>{m === value && <Check size={15} aria-hidden="true"/>}</button></li>)}
    </ul>}
  </div>;
}
