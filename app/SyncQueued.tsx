'use client';
import {useEffect, useRef, useState} from 'react';
import {RefreshCw} from 'lucide-react';

const NAMES: Record<string, string> = {runeprofile: 'RuneProfile', temple: 'TempleOSRS', wom: 'Wise Old Man'};
const POLL_MS = 6_000, GIVE_UP_MS = 4 * 60_000;
const list = (sources: string[]) => sources.map(s => NAMES[s] ?? s).join(', ');

/** Follows a queued sync (lib/sync-queue.ts): asks /api/sync/status which sources are still on their way, calls
 * `onLanded` each time one finishes (so the profile reloads its data) and clears itself when none are left. Shows
 * "Sync queued" until the first source lands, then "Syncing…". Never shows a queue position. */
export function useQueuedSync(username: string, onLanded: () => void) {
  const [pending, setPending] = useState<string[]>([]);
  const [started, setStarted] = useState(0);
  const [landed, setLanded] = useState(false);
  const landedRef = useRef(onLanded);landedRef.current = onLanded;
  useEffect(() => {
    if (!started) return;
    let stopped = false, last: string[] | null = null;
    const tick = async () => {
      if (stopped) return;
      try {
        const r = await fetch('/api/sync/status?username=' + encodeURIComponent(username), {cache: 'no-store'});
        const now = r.ok ? ((await r.json()) as {pending?: string[]}).pending ?? [] : last ?? [];
        if (stopped) return;
        if (last && now.length < last.length) {setLanded(true); landedRef.current();}
        last = now; setPending(now);
        if (!now.length) {stopped = true; return;}
      } catch { /* Try again on the next tick. */ }
      if (Date.now() - started > GIVE_UP_MS) {stopped = true; setPending([]); return;}
      setTimeout(() => void tick(), POLL_MS);
    };
    const first = setTimeout(() => void tick(), POLL_MS);
    return () => {stopped = true; clearTimeout(first);};
  }, [started, username]);
  /** Call with the sources a response says were queued. */
  const follow = (sources: string[]) => {if (!sources.length) return; setPending(sources); setLanded(false); setStarted(Date.now());};
  return {pending, landed, follow};
}

export function SyncQueuedNotice({pending, landed}: {pending: string[]; landed: boolean}) {
  if (!pending.length) return null;
  return <div className="player-status sync-queued" role="status" aria-live="polite">
    <span><b><RefreshCw size={13} className="spin" aria-hidden="true"/> {landed ? 'Syncing…' : 'Sync queued'}</b>
      <small>Waiting on {list(pending)}. New data appears here as each one finishes; saved progress is kept.</small></span>
  </div>;
}
