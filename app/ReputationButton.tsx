'use client';
import {useEffect, useState} from 'react';
import {ThumbsUp} from 'lucide-react';
import {canGiveRespect, reputationHint, reputationSummary, type Reputation} from '@/lib/reputation';
import {num} from '@/lib/ui';

export function ReputationButton({username, viewerKey, previewCount}: {username:string; viewerKey:string; previewCount?:number}) {
  const [rep, setRep] = useState<Reputation|null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [retry, setRetry] = useState(0);
  const url = '/api/reputation?' + new URLSearchParams({username});
  useEffect(() => {
    if(previewCount!==undefined){setRep({count:previewCount,given:false,signedIn:false,ownProfile:true,available:true});return;}
    const abort = new AbortController();
    setRep(null); setError(''); setNotice('');
    fetch(url, {signal:abort.signal}).then(async r => {
      const data = await r.json() as Reputation & {error?:string};
      if (!r.ok) throw Error(data.error || 'Could not load respect.');
      if (!abort.signal.aborted) setRep(data);
    }).catch(e => {if (!abort.signal.aborted) setError(e.message);});
    return () => abort.abort();
  }, [url, viewerKey, retry, previewCount]);

  async function vote() {
    if (previewCount!==undefined || !rep || busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const r = await fetch(url, {method:rep.given ? 'DELETE' : 'PUT'});
      const data = await r.json() as Reputation & {error?:string};
      if (!r.ok) throw Error(data.error || 'Could not update respect.');
      setRep(data); setNotice(data.given ? 'Respect given. Thank you!' : 'Your respect was removed.');
    } catch(e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }

  const disabled = previewCount!==undefined || busy || !rep || (!rep.given && !canGiveRespect(rep));
  const hint = previewCount!==undefined?'Sample reputation · no real votes':rep ? reputationHint(rep) : 'Loading respect…';
  // Thumbs up on this player's guides count towards the total. No hover: the count is all a visitor needs.
  const summary = rep ? reputationSummary(rep, n => num(n, 0)) : '';
  return <div className="profile-reputation" onPointerDown={e=>e.stopPropagation()}>
    <button type="button" className={'rep-button' + (rep?.given ? ' given' : '')} disabled={disabled}
      aria-label={`${rep?.given ? 'Undo your respect' : 'Give +1 respect'} to ${username}${rep ? `; ${summary}` : ''}`}
      aria-pressed={rep?.given ?? false} onClick={()=>void vote()}>
      <ThumbsUp size={20} fill={rep?.given ? 'currentColor' : 'none'}/>
      <b>{rep ? num(rep.count,0) : '—'}</b>
    </button>
    <span className="rep-hint" aria-hidden="true">{hint}</span>
    <span className="sr-only" role="status">{notice}</span>
    {/* A failed load says only that respect is unavailable; a refused vote keeps its reason (signed out, daily limit). */}
    {error && <div className={'rep-error'+(rep?'':' short')} role="alert">{rep?error:'Respect unavailable'}<button type="button" onClick={()=>setRetry(n=>n+1)}>Retry</button></div>}
  </div>;
}
