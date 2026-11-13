'use client';
import {useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties} from 'react';
import {LockKeyhole, Target, Check, X} from 'lucide-react';
import {FeatureLinks} from './FeatureLinks';
import {PlayerSearch, SiteBrand} from './SiteHeader';
import {HeaderNavigation} from './HeaderNavigation';
import {emptyFlair, PlayerCard, SkillsPanel, ActivityRanks, Overview, type ProfileFlair} from './Profile';
import {ChipRow, FilterBar, IconBox, SearchBox, SortMenu} from './Controls';
import {DiscordLogin} from './DiscordLogin';
import {siteSession, useSiteSession} from './site-session';
import {Meter} from './Meter';
import {ProfileEmpty} from './ProfileEmpty';
import {ProfileChat} from './Community';
import {JournalLoading} from './JournalLoading';
import {OWNER_TABS, PROFILE_TABS} from './profile-tabs';
import './profile-banner-layout.css';
import './insights.css';
import {PlayerStatus} from './PlayerStatus';
import type {PlayerLookup} from '@/lib/player-lookup';
import {progressAvailability} from '@/lib/progress-availability';
import {acquisitionUnit,acquisitionMethod,acquisitionLabel,countUnit} from '@/lib/pet-record';
import {hoursToMilestone, petProgress, petRateLines} from '@/lib/pet-rates';
import {PetDialog} from './PetDialog';
import {PetPanel} from './PetPanel';
import {Quests, Diaries, Combat} from './AccountProgress';
import {CollectionLog} from './CollectionLog';
import {CollectionTimeline} from './CollectionTimeline';
import {Connections} from './Connections';
import {ProgressHeader} from './ProgressHeader';
import {CategoryBars, DryMeter} from './ProgressCharts';
import {PopShell, type PopApi, type PopNode} from './Pop';
import {phoenixShownCount, selectedMethod, normalizeRates} from '@/lib/estimates';
import {initial, type Journal, type Pet, expectedHours, likelihood} from '@/lib/model';
import {profileSaveBody} from '@/lib/flair';
import {SyncQueuedNotice, useQueuedSync} from './SyncQueued';
import {compact, num} from '@/lib/ui';

const CATS = ['All', 'Bosses', 'Skilling', 'Minigames', 'Raids', 'Clues'];

export default function Tracker({username}: {username: string}) {
  const [j, setJ] = useState<Journal>(() => ({...structuredClone(initial), username}));
  const [ready, setReady] = useState(false);
  const overviewSize = useRef<HTMLDivElement>(null);
  const connectionsSize = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const leftSize = useRef<HTMLElement>(null);
  const chatSize = useRef<HTMLDivElement>(null);
  const queued=useQueuedSync(username,()=>void refreshJournal(username));
  const [lookup,setLookup]=useState<PlayerLookup|null>(null);
  const [lookupAttempt,setLookupAttempt]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setLookup(null);
    void fetch('/api/player-status?username='+encodeURIComponent(username),{signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error('Lookup unavailable');return await r.json() as PlayerLookup;})
      .then(async result=>{if(controller.signal.aborted)return;setLookup(result);if(result.persisted)await load(username);if(result.status==='sync_queued')queued.follow(['runeprofile','temple']);})
      .catch(()=>{if(!controller.signal.aborted)setLookup({username,state:'unavailable',hiscores:'unavailable',runeprofile:'unavailable',skills:[],checkedAt:new Date().toISOString()});});
    return ()=>controller.abort();
  },[username,lookupAttempt]);
  const [view, setView] = useState('Overview');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('All');
  const [status, setStatus] = useState('all');
  const [hunt, setHunt] = useState(false);
  const [sort, setSort] = useState('default');
  const petResults=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(petResults.current)petResults.current.scrollTop=0;},[q,cat,status,hunt,sort,view]);
  const [pet, setPet] = useState<Pet | null>(null);
  const [editPetProgress,setEditPetProgress]=useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  /** The address holds a name RuneScape could never have: say so, with nothing to retry. */
  const [badName, setBadName] = useState(false);
  const auth = useSiteSession();
  const [flair, setFlair] = useState<ProfileFlair>(emptyFlair);
  const [pop, setPop] = useState<{key: string; node: PopNode} | null>(null);
  const journalRef = useRef(j);
  journalRef.current = j;
  const usernameRef = useRef(j.username);

  const show = useCallback((key: string, node: PopNode) => { if (!j.restricted) setPop(p => p?.key === key ? null : {key, node}); }, [j.restricted]);
  useEffect(() => { if (j.restricted) {setPop(null);setPet(null);} }, [j.restricted]);
  const closePop = useCallback(() => setPop(null), []);
  const popApi: PopApi = {key: pop?.key ?? null, show, close: closePop};

  async function load(username = 'Obifloat') {
    setReady(false); setJ({...structuredClone(initial),username,restricted:true}); setFlair(emptyFlair); setPet(null); setPop(null); setMessage('');
    try {
      setError(''); setBadName(false);
      const r = await fetch('/api/journal?username=' + encodeURIComponent(username));
      const d = await r.json() as Journal & {error?: string};
      if (r.status === 400) { setBadName(true); return; }
      if (!r.ok) throw Error(d.error || 'Request failed.');
      if(usernameRef.current.toLowerCase()!==username.toLowerCase())return;
      setJ(d); usernameRef.current = d.username;
      try { localStorage.setItem('pet-journal-account', d.username); } catch {}
      await loadProfile(d.username);
      if(usernameRef.current.toLowerCase()===username.toLowerCase())setReady(true);
    } catch (e) { setError((e as Error).message); }
  }
  // Reloads the journal in place when a queued source lands, without the loading screen.
  async function refreshJournal(username: string) {
    try {
      const r = await fetch('/api/journal?username=' + encodeURIComponent(username), {cache: 'no-store'});
      if (!r.ok || usernameRef.current.toLowerCase() !== username.toLowerCase()) return;
      setJ(await r.json() as Journal);
    } catch { /* The next landed source tries again. */ }
  }
  async function addAccount(username: string) {
    setBusy(true);
    try {
      const r = await fetch('/api/accounts', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username})});
      const d = await r.json() as Journal & {error?: string};
      if (!r.ok) throw Error(d.error);
      setJ(d); setReady(true); setPet(null); setPop(null); usernameRef.current = d.username;
      try { localStorage.setItem('pet-journal-account', d.username); } catch {}
      window.location.assign('/player/' + encodeURIComponent(d.username));
      await refreshSession(); return true;
    } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  }
  async function loadProfile(username: string) {
    try {
      const r = await fetch('/api/profile?username=' + encodeURIComponent(username));
      const stored = r.ok ? await r.json() as ProfileFlair : emptyFlair;
      if(usernameRef.current.toLowerCase()===username.toLowerCase())setFlair({...emptyFlair, ...stored, preview: false});
    } catch { setFlair(emptyFlair); }
  }
  async function updateFlair(next: ProfileFlair): Promise<boolean> {
    if (!flair.canEdit || !auth.user) return false;
    const clean = profileSaveBody(j, next, flair.staff?.role==='owner', {staffRole: flair.staff?.role});
    try {
      const r = await fetch('/api/profile', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: j.username, ...clean})});
      const saved = await r.json() as ProfileFlair & {error?: string};
      if (!r.ok) throw new Error(saved.error || 'Could not save profile.');
      setFlair({...emptyFlair, ...saved}); setError(''); setMessage('Profile saved.');
      return true;
    } catch (e) { setError((e as Error).message); return false; }
  }
  async function refreshSession(force = true) {
    await siteSession.load(force);
    void loadProfile(usernameRef.current);
  }
  async function logout() {
    const r = await fetch('/api/auth/logout', {method: 'POST'});
    if (!r.ok) { const d = await r.json() as {error?: string}; setError(d.error || 'Could not log out.'); return; }
    siteSession.clear();
    setView('Overview'); setPet(null); setPop(null);
    await load(usernameRef.current);
  }
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('login') === 'failed') {
      params.delete('login');
      const next = params.toString();
      history.replaceState(null, '', next ? `${location.pathname}?${next}` : location.pathname);
      queueMicrotask(() => setError('Discord login did not finish. Try again.'));
    }
    usernameRef.current = username;
    void load(username); void refreshSession(false);
    const key = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (e.key === '/' && !typing) {
        const input = document.querySelector<HTMLInputElement>('.wbody .search input');
        if (input) { e.preventDefault(); input.focus(); }
      }
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) setPop(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [username]);
  useEffect(() => { document.querySelector('.wbody')?.scrollTo({top: 0}); }, [view, j.username]);
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(''), 2500); return () => clearTimeout(t); }, [message]);

  async function action(url: string, payload: unknown) {
    setBusy(true); setError(''); setMessage('');
    try {
      const r = await fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...payload as Record<string, unknown>, username: j.username})});
      const d = await r.json() as Journal & {error?: string;syncReport?:{status:string}[]};
      // A refresh pressed again during its one-minute cooldown is not an error: say when it can run.
      if (url === '/api/sync' && r.status === 429) { setMessage(queued.pending.length ? 'Already syncing. New data appears as each source finishes.' : 'Refreshed a moment ago. You can refresh again in a minute.'); return false; }
      if (!r.ok) throw Error(d.error || 'Request failed.');
      setJ(d);
      const waiting=(d.syncReport??[]).filter(r=>r.status==='queued').map(r=>(r as {source?:string}).source??'');
      if(waiting.length){queued.follow(waiting);setMessage('Sync queued. New data appears as each source finishes.');}
      else setMessage(d.syncReport?.length?'Refresh complete. See Connections for each source’s result.':'Saved.');
      return true;
    } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  }
  const openFull = (p: Pet,edit=false) => { if (j.restricted) return; setEditPetProgress(edit);setPet({...structuredClone(p),obtainedUnit:acquisitionUnit(p),obtainedMethod:acquisitionMethod(p)}); setError(''); };
  const openPet = (p: Pet) => show('pet:' + p.id, null);
  const available=progressAvailability(j);
  const displayJournal=!j.restricted&&j.details?.skills!==false&&!j.hiscores.skills.length&&lookup?.username.toLowerCase()===j.username.toLowerCase()&&lookup.skills.length?{...j,hiscores:{...j.hiscores,skills:lookup.skills}}:j;
  const owner=!!auth.user&&flair.canEdit;
  const sectionKey:Record<string,keyof NonNullable<Journal['details']>>={Pets:'pets','Collection log':'log',Quests:'quests',Diaries:'diaries',Combat:'combat'};
  const visibleTabs=PROFILE_TABS.filter(t=>owner||(!OWNER_TABS.includes(t.n)&&j.details?.[sectionKey[t.n]]!==false));
  const activeView=visibleTabs.some(t=>t.n===view)?view:'Overview';
  // Measure only intrinsic content: overview, fixed portrait/skills/ranks and the
  // collapsed banner. The joining guide is a separate top-layer dialog.
  useLayoutEffect(() => {
    const overview = overviewSize.current;
    const left = leftSize.current, chat = chatSize.current;
    if (!left || !chat) return;
    const measure = () => {
      const tabs = overview?.closest('.window')?.querySelector('.wtabs');
      const naturalHeight = overview?.getBoundingClientRect().height ?? 0;
      const children = Array.from(left.children);
      const gap = Number.parseFloat(getComputedStyle(left).rowGap) || 0;
      const leftHeight = children.reduce((height, child) => {
        // Boss ranks fills down to the window's bottom edge, so measure its intrinsic
        // rows instead of feeding the stretched card height back into the frame height.
        if (child.classList.contains('activity-ranks')) {
          const heading = child.querySelector<HTMLElement>('.activity-rank-heading');
          const grid = child.querySelector<HTMLElement>('.activity-rank-grid');
          if (heading && grid) {
            const cardStyle = getComputedStyle(child), headStyle = getComputedStyle(heading), gridStyle = getComputedStyle(grid);
            const icons = Array.from(grid.children) as HTMLElement[];
            const rows = new Set(icons.map(icon => icon.offsetTop)).size;
            const rowHeight = Math.max(0, ...icons.map(icon => icon.getBoundingClientRect().height));
            const gridHeight = Math.max(Number.parseFloat(gridStyle.minHeight) || 0, rows * rowHeight + Math.max(0, rows - 1) * (Number.parseFloat(gridStyle.rowGap) || 0));
            const edges = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'].reduce((n, key) => n + (Number.parseFloat(cardStyle[key as 'paddingTop']) || 0), 0);
            return height + heading.getBoundingClientRect().height + (Number.parseFloat(headStyle.marginBottom) || 0) + gridHeight + edges;
          }
        }
        return height + child.getBoundingClientRect().height;
      }, 0) + gap * Math.max(0, children.length - 1);
      const bannerHeight = chat.getBoundingClientRect().height;
      const centreHeight = naturalHeight + (tabs?.getBoundingClientRect().height ?? 0) + 34 + bannerHeight + 12;
      // The left column shares only the window's row; the banner row beside it stays free.
      setContentHeight(Math.ceil(Math.max(leftHeight + bannerHeight + 12, centreHeight)));
    };
    const observer = new ResizeObserver(measure);
    if (overview) observer.observe(overview);
    observer.observe(chat);
    for (const child of Array.from(left.children)) observer.observe(child);
    measure();
    return () => observer.disconnect();
  }, [ready, owner, j.restricted, displayJournal.hiscores.activities.length, displayJournal.hiscores.skills.length]);
  const go = (n: string) => { if(!owner&&OWNER_TABS.includes(n))return; setView(n); setQ(''); setCat('All'); setStatus('all'); setHunt(false); };
  const syncProfile = () => void action('/api/sync', {source: 'all'});

  const huntCount = j.pets.filter(p => p.priority).length;
  let pets = j.pets.filter(p => (cat === 'All' || cat === p.category) && (status === 'all' || (status === 'owned' ? p.obtained : !p.obtained)) && (!hunt || p.priority)
    && `${p.name} ${p.category} ${p.methods.map(m => `${m.name} ${m.activity ?? ''}`).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  pets = [...pets].sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name)
    : sort === 'hours' ? (expectedHours(a) ?? Infinity) - (expectedHours(b) ?? Infinity)
    : sort === 'hunt' ? Number(b.priority)-Number(a.priority)||a.name.localeCompare(b.name)
    : sort === 'dry' ? (likelihood(b) ?? -1) - (likelihood(a) ?? -1)
    : Number(b.obtained) - Number(a.obtained) || a.name.localeCompare(b.name));

  // what the side pop-out shows
  let popBody: React.ReactNode = null;
  if (pop && !j.restricted) {
    if (pop.key.startsWith('pet:')) {
      const p = j.pets.find(x => 'pet:' + x.id === pop.key);
      popBody = p && <PetPanel journal={j} pet={p} canEdit={flair.canEdit} onEdit={()=>openFull(p,true)} busy={busy || !ready} onFull={() => openFull(p)} onHunt={() => void action('/api/journal', {pet: {...p, priority: !p.priority}, revision: j.revision})}/>;
    } else popBody = typeof pop.node === 'function' ? pop.node(displayJournal) : pop.node;
  }

  return <div className="site">
    <header className="hdr"><div className="hdr-in">
      <SiteBrand/>
      <PlayerSearch/>
      <HeaderNavigation>
        <FeatureLinks/>
        <DiscordLogin user={auth.user} pending={!auth.known} names={auth.names} viewing={j.username} disabled={busy} onSelect={n => window.location.assign('/player/' + encodeURIComponent(n))} onClaim={addAccount} onLogout={() => void logout()}/>
      </HeaderNavigation>

    </div></header>

    {(error || message) && <div className="toasts">
      {error && <div role="alert" className="notice error">{error}{!ready && <button className="btn sm" onClick={() => void load(j.username)}>Retry</button>}<button className="icon-btn" aria-label="Dismiss" onClick={() => setError('')}><X size={15}/></button></div>}
      {message && <div role="status" className="notice ok"><Check size={15}/>{message}</div>}
    </div>}

    {ready&&<SyncQueuedNotice pending={queued.pending} landed={queued.landed}/>}
    {ready&&lookup&&lookup.state==='not_found'&&<PlayerStatus lookup={lookup} username={j.username} saved={!!j.restricted||available.pets||available.log||available.quests||available.diaries||available.combat||!!j.statsSyncedAt} savedAt={j.statsSyncedAt??j.logSyncedAt} onRetry={()=>setLookupAttempt(n=>n+1)}/>}
    {!ready ? <JournalLoading username={j.username} failed={!!error} invalid={badName} owner={!!auth.user&&auth.names.some(n=>n.toLowerCase()===j.username.toLowerCase())}/> : <div className="frame has-pop profile-banner-layout" style={{'--profile-content-h': `${contentHeight}px`} as CSSProperties}>
      <aside ref={leftSize} className="col-left">
        <PlayerCard journal={displayJournal} flair={flair} onFlair={updateFlair} viewerKey={auth.user?.id ?? 'guest'}/>
        {(!displayJournal.restricted&&(owner||displayJournal.details?.skills!==false))&&<SkillsPanel journal={displayJournal} pop={popApi}/>}
        <ActivityRanks journal={displayJournal}/>
      </aside>

      <section className="window osrs-panel">
        {j.restricted ? <div className="private-profile"><LockKeyhole size={30}/><h2>{ready?'Private collection':'Loading profile...'}</h2><p>{ready?`${j.username} has made their collection and progress private.`:'Your journal is being loaded.'}</p></div> : <>
        <nav className="wtabs" role="tablist">{visibleTabs.map(({n, img}) => <button key={n} type="button" role="tab" aria-selected={activeView === n} onClick={() => go(n)} title={n}>
          <img src={img} alt=""/><span>{n}</span>
        </button>)}</nav>

        <div className={`wbody ${activeView === 'Overview' ? 'overview-body' : ''} ${['Collection log', 'Quests', 'Combat', 'Pets', 'Diaries', 'Insights'].includes(activeView) ? 'fill' : ''}`}>
          <div ref={overviewSize} className="profile-sizing-pane" hidden={activeView !== 'Overview'} inert={activeView !== 'Overview'}><Overview journal={displayJournal} go={go} onOpen={openPet}/></div>

          {activeView === 'Pets' && (available.pets ? <div className="pets-view">
            <ProgressHeader icon="/brand/rocky-mascot.webp" kicker="Pets collected" done={j.pets.filter(p=>p.obtained).length} total={j.pets.length}/>
            <FilterBar>
              <SearchBox label="Search pets" placeholder="Search pets, bosses or activities…" value={q} onChange={setQ}/>
              <SortMenu label="Pet status" value={hunt?'hunt':status} onChange={value=>{setHunt(value==='hunt');setStatus(value==='hunt'?'all':value);}} options={[{value:'all',label:'All pets'},{value:'owned',label:'Collected'},{value:'missing',label:'Missing'},{value:'hunt',label:`Hunt list (${huntCount})`}]}/>
              <SortMenu label="Sort pets" value={sort} onChange={setSort} options={[{value: 'default', label: 'Collected first'}, {value: 'name', label: 'Name A–Z'}, {value: 'hunt', label: 'Hunt list first'}, {value: 'hours', label: 'Quickest hunt'}, {value: 'dry', label: 'Most dry'}]}/>

            </FilterBar>
            <ChipRow label="Pet categories" chips={CATS.map(c => {const n = j.pets.filter(p => (c === 'All' || p.category === c) && (!hunt || p.priority)); const g = n.filter(p => p.obtained).length;
              return {id: c, label: c, count: `${g}/${n.length}`, pressed: cat === c, onClick: () => setCat(c)};})}/>
            <div ref={petResults} className="pets-scroll" role="region" aria-label="Pet results" tabIndex={0}>
              <div className="pet-grid">{pets.map(p => {
                const m = selectedMethod(p);
                const sub = p.methods.find(x => x.activity)?.activity || m?.name || p.category;
                const outlook = petRateLines(p, j);
                // The same chance, hours and count the pet's pop-out shows (lib/pet-rates.ts, petProgress).
                const progress = petProgress(p, j);
                const shownChance = progress.chance;
                const shownHours = progress.hours;
                const rateText = outlook.averageXp != null ? `~${compact(outlook.averageXp)} XP mean`
                  : outlook.lines.find(line => line.label === 'Drop rate' || line.label.startsWith('Drop rate at'))?.value
                  ?? (m?.rate ? m.unit==='XP'?`~${compact(m.rate)} XP estimate`:`1/${num(m.rate, 0)}` : 'Rate unavailable');
                const phoenix = p.name === 'Phoenix' ? phoenixShownCount(p.crateRolls, j.hiscores.activities.find(a => a.name === 'Wintertodt')?.score) : null;
                const count = (n: number) => n >= 10_000 ? compact(n) : n >= 1000 ? `${num(n / 1000, 1)}K` : num(n, 0), countText = phoenix ? `${count(phoenix.value)} ${countUnit(phoenix.value, phoenix.unit)}` : progress.count ? `${count(progress.count.value)} ${countUnit(progress.count.value, progress.count.unit)}` : null;
                const next = hoursToMilestone(shownHours, shownChance), left = p.obtained ? 'Collected' : next ? `~${num(Math.max(1, next.hours), 0)} h to ${next.percent}%` : shownHours !== null ? 'Past 95%' : null;
                // Laid out like a collection-log activity tile: icon, name, progress, then one small line of kills and time left.
                return <button className={`pet cl-activity pet-tile ${p.obtained ? 'owned' : ''} ${pop?.key === 'pet:' + p.id ? 'sel' : ''}`} onClick={() => openPet(p)} key={p.id} title={`${p.name} · ${sub} · ${rateText}${p.obtained&&p.obtainedCount!=null?` · Obtained: ${acquisitionLabel(p)}`:''}`}>
                  <IconBox src={`/pets/${p.id}.png`} alt=""/>
                  <b>{p.name}</b>
                  <Meter done={p.obtained ? 1 : (shownChance ?? 0)} total={1}/>
                  <small className="tile-progress-count">{[countText, left].filter(Boolean).join(' · ') || rateText}</small>
                </button>;
              })}</div>
              {!pets.length && <div className="empty"><Target size={32}/><h3>{hunt ? 'Your hunt list is empty' : 'No matching pets'}</h3><p className="muted">{hunt ? 'Click a pet and choose “Add to hunt list”.' : 'Try another search or filter.'}</p></div>}
            </div>
          </div> : <ProfileEmpty section="Pets" icon="/brand/rocky-mascot.webp" canEdit={owner} busy={busy||queued.pending.length>0} onSync={syncProfile}/>)}

          {activeView === 'Collection log' && <CollectionLog journal={j} log={j.log} canEdit={owner} onConnect={syncProfile} busy={busy||queued.pending.length>0} pop={popApi} onSaveDate={(itemId,date)=>action('/api/collection-date',{itemId,date,revision:journalRef.current.revision})}/>}
          {activeView === 'Quests' && <Quests journal={j} pop={popApi} onSync={syncProfile} canEdit={owner} busy={busy||queued.pending.length>0}/>}
          {activeView === 'Diaries' && <Diaries journal={j} pop={popApi} onSync={syncProfile} canEdit={owner} busy={busy||queued.pending.length>0}/>}
          {activeView === 'Combat' && <Combat journal={j} pop={popApi} onSync={syncProfile} canEdit={owner} busy={busy||queued.pending.length>0}/>}

          {owner && activeView === 'Insights' && <div className="insights">
            <div className="insights-grid">
              <DryMeter pets={j.pets} onOpen={openPet} pageSize={6}/>
              <CategoryBars pets={j.pets} onSelect={c => { go('Pets'); setCat(c); }}/>
              <CollectionTimeline journal={j}/>
            </div>
          </div>}
          {owner && <div ref={connectionsSize} className="profile-sizing-pane stack" hidden={activeView !== 'Connections'} inert={activeView !== 'Connections'}><Connections journal={j} busy={busy || !flair.canEdit} ready={ready && flair.canEdit} syncing={queued.pending.length>0} onSync={source => void action('/api/sync', {source})} onImport={data => void action('/api/sync', {source: 'import', data})} onError={setError}/></div>}
        </div></>}
      </section>

      <div ref={chatSize} className="profile-join-slot"><ProfileChat embedded/></div>
      <PopShell onClose={closePop}>{popBody}</PopShell>
    </div>

    }

    <PetDialog journal={j} pet={j.restricted ? null : pet} setPet={p=>setPet(p?normalizeRates({...j,pets:[p]}).pets[0]:null)} canEdit={ready&&flair.canEdit} editProgress={editPetProgress} busy={busy} error={error} onSave={async () => { if (pet && await action('/api/journal', {pet, revision: j.revision})) setPet(null); }}/>
  </div>;
}
