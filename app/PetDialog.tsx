'use client';
import {receivedMethod} from '@/lib/hunt-history';
import {farmingRunStats,isTreeRun,TREE_RUNS,TREE_RUN,treeRunStats,treeRunsMethod} from '@/lib/farming-runs';
import {TANGLEROOT_TREES,treeFact,treeMethod,treeRate,treeRow} from '@/lib/tangleroot-trees';
import {skillingDrops} from '@/lib/skilling-drops';
import {DropTable} from './DropTable';
import {EffortBasis} from './EffortBasis';
import {useEffect, useMemo, useRef, useState} from 'react';
import {X, Plus, ExternalLink, Dices, Swords, MapPin, BookOpen, Check, Search, RefreshCw} from 'lucide-react';
import {petUnitLabel,acquisitionUnit,acquisitionUnits,xpAtLevel,unitShort,hiscoresCount} from '@/lib/pet-record';
import {lifetimeSkill, petSkill, oddsMethod, usesAcquisition, HONOUR_PER_GAMBLE} from '@/lib/estimates';
import {type Journal, type Pet, type Method, initial, expectedHours, budgetHours, hoursSpent, likelihood, estimateReviewed} from '@/lib/model';
import {IllustratedSelect} from './IllustratedSelect';
import {PetOdds} from './ProgressCharts';
import {ActivityDrops} from './ActivityDrops';
import {bossArtwork} from '@/lib/artwork';
import {atLevel, wikiMethod, methodsForSkill, skillMethodChoice} from '@/lib/pet-rates';
import {chanceTone, logPageForPet, loadPageDrops, num, pct, wiki, wikiSearch, type PageDrops} from '@/lib/ui';
import {DriestRecord} from './DriestRecord';
import {RateBasis} from './PetPanel';
import './method-counts.css';

const UNITS = ['rewards', 'rolls', 'actions', 'laps', 'logs', 'catches', 'uniques', 'kills', 'runs', 'crates', 'gambles', 'pickpockets', 'thefts', 'games', 'raids', 'XP', 'eligible rolls', 'attempts', 'master clues', 'harvests', 'rumours', 'plants', 'trees', 'seeds', 'activities'];
const TABS = ['Drops & odds', 'Guides', 'Progress & notes'] as const;
/** The collection-log page that lists the skilling pets themselves. It is not a drop table, so a skilling pet shows
 * its own sources instead: every activity that rolls it, at the player's level (`lib/skilling-drops.ts`). */
const PET_LIST_PAGE = 'Skilling Pets';

export function PetDialog({journal, pet, setPet, busy, error, canEdit=false, editProgress=false, moderation=false, onSave}: {
  canEdit?:boolean; editProgress?:boolean; moderation?:boolean; journal: Journal; pet: Pet | null; setPet: (p: Pet | null) => void; busy: boolean; error: string; onSave: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Drops & odds');
  const [index, setIndex] = useState(0);
  const [drops,setDrops]=useState<PageDrops|null>(null);
  const logPage = useMemo(() => pet ? logPageForPet(journal, pet) : null, [journal, pet?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = logPage?.name === PET_LIST_PAGE ? null : logPage;
  const skillDrops = useMemo(() => pet && logPage?.name === PET_LIST_PAGE ? skillingDrops(pet, journal) : null, [journal, pet?.id, logPage?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pet) { setTab(editProgress&&canEdit?'Progress & notes':'Drops & odds'); setIndex(pet.obtained&&receivedMethod(pet)?pet.methods.indexOf(receivedMethod(pet)!):pet.plannedMethod??0); ref.current?.showModal(); }
    else ref.current?.close();
  }, [pet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDrops(null);
    if (!page) return;
    let live = true;
    loadPageDrops(page.name, page.items.map(i => i.id)).then(d => { if (live) setDrops(d); }).catch(() => { if (live) setDrops({sources:[],items:{},error:'Drop sources are temporarily unavailable.'}); });
    return () => { live = false; };
  }, [page?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { scroll.current?.scrollTo({top:0}); }, [tab, pet?.id]);
  useEffect(() => { if(error)scroll.current?.scrollTo({top:0}); }, [error]);

  const m = pet?.methods[index];
  function setMethod(at: number, patch: Partial<Method>) {
    if (!pet || busy || !pet.methods[at]) return;
    const methods = [...pet.methods]; methods[at] = {...methods[at], ...patch}; setPet({...pet, methods});
  }
  function change(key: keyof Method, value: string, at = index) {
    const m = pet?.methods[at];
    if (!pet || !m || busy) return;
    const methods = [...pet.methods];
    methods[at] = {
      ...m,
      ...(key === 'kph' ? {paceConfirmed: true} : key === 'rate' ? {rateConfirmed: false,rateOverride:true} : {}),
      [key]: ['kc', 'rate', 'kph'].includes(key) ? (value === '' ? null : Number(value)) : value,
      ...(['name', 'unit'].includes(key) ? {activity: null, rateConfirmed: false, paceConfirmed: false} : {}),
      ...(key==='unit'?{kc:null,rate:null,kph:null,rateOverride:true}:{}),
    };
    setPet({...pet, methods, ...(pet.obtained&&receivedMethod(pet)===m&&key==='kph'&&m.unit==='XP'?{historicalXph:value===''?null:Number(value)}:{}),...(pet.obtained&&receivedMethod(pet)===m&&key==='name'?{obtainedMethod:value}:{}), ...(pet.name==='Phoenix' && m.unit==='rolls' && key==='kc' ? {crateRolls:value===''?null:Number(value)} : {})});
  }

  const close = () => { if (!busy) setPet(null); };
  if (!pet) return <dialog className="modal pet-dialog" ref={ref}/>;

  const planned = oddsMethod(pet);
  const received=usesAcquisition(pet);
  const skill = lifetimeSkill(pet, journal);
  const wikiCalc = planned && skill && !planned.rateOverride ? (() => { const w = wikiMethod(pet.name, planned.name); return w ? atLevel(w, skill.level) : null; })() : null;
  const xpUnit = planned?.unit === 'XP';
  const effort = hoursSpent(pet, journal);
  const mean = expectedHours(pet), budget = budgetHours(pet), chance = likelihood(pet);
  const activity = pet.name === 'Abyssal protector' ? 'Guardians of the Rift' : pet.methods.find(x => x.activity)?.activity || page?.name || pet.methods[0]?.name || pet.name;
  const bossImg = bossArtwork(activity) || bossArtwork(page?.name);
  const reviewed = estimateReviewed(pet);
  const synced = planned && planned.kc == null && !received ? hiscoresCount(pet, journal, planned) : null;

  return <dialog className="modal pet-dialog" ref={ref} aria-labelledby="pet-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === ref.current) close(); }}>
    <form className="modal-body" onSubmit={async e => { e.preventDefault(); if(canEdit&&!busy)await onSave(); }}>
      <header className="modal-head">
        <div className="art lg"><img src={`/pets/${pet.id}.png`} alt=""/></div>
        <div className="modal-title">
          <span className="kicker">{pet.category}{page ? ` · ${page.name}` : ''}</span>
          <h2 id="pet-title">{pet.name}</h2>
          <span className={`tag ${pet.obtained ? 'good' : 'warn'}`}>{pet.obtained ? <><Check size={12}/> Collected{pet.date ? ` ${new Date(pet.date).toLocaleDateString()}` : ''}</> : 'Not collected yet'}</span>
        </div>
        <button type="button" className="icon-btn" aria-label="Close" disabled={busy} onClick={close}><X size={22}/></button>
      </header>

      <div className="tabs" role="tablist" aria-label="Pet details">
        {TABS.filter(t=>canEdit||t!=='Progress & notes').map(t => <button type="button" key={t} role="tab" aria-selected={tab === t} disabled={busy} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      <div className="modal-scroll" ref={scroll} role="tabpanel" aria-label={tab}>
        {error && <div className="notice error" role="alert">{error}</div>}
        {tab === 'Drops & odds' && <>
      <div className="statline">
        <div><span>{xpUnit ? 'Expected XP' : 'Drop rate'}</span><b>{xpUnit && wikiCalc?.expectedXp != null ? num(wikiCalc.expectedXp, 0) : planned?.rate ? (xpUnit ? num(planned.rate, 0) : `1/${num(planned.rate, 0)}`) : '—'}</b><small>{xpUnit ? (wikiCalc?.expectedXp != null ? `wiki at level ${skill?.level}` : isTreeRun(planned) && !planned?.rateOverride ? `tree run at level ${skill?.level ?? 99}` : 'unverified figure') : planned?.unit ? `per ${pet.name==='Abyssal protector'&&planned.unit==='rewards'?'search':planned.unit.replace(/s$/, '')}` : 'not set'}</small></div>
        <div><span>Your {petUnitLabel(pet,planned?.unit ?? 'count')}</span><b>{planned?.kc != null ? num(planned.kc, 0) : '—'}</b><small>{planned?.kc != null && planned.rate ? `${num(planned.kc / planned.rate, 2)}× rate` : synced ? `hiscores: ${num(synced.value, 0)}` : 'enter it in Progress'}</small></div>
        <div><span>{received?'Chance by obtained count':'Chance by now'}</span><b className={chanceTone(chance)}>{chance === null ? '—' : pct(chance)}</b><small>{received?'using your obtained record':'at your count'}{planned?.rateOverride?' · estimate':''}</small></div>
        <div><span>Mean hunt</span><b>{mean === null ? '—' : `${num(mean)} h`}</b><small>{mean === null ? 'needs rate & pace' : `at ${num(planned!.kph!)} ${unitShort(pet,planned!.unit)}/h${reviewed?'':' · default estimate'}`}</small></div>
        <div><span>95% budget</span><b>{budget === null ? '—' : `${num(budget)} h`}</b><small>1 in 20 still dry</small></div>
        <div><span>{pet.recordedHours != null ? 'Recorded time' : pet.obtained ? 'Estimated time to pet' : 'Estimated effort'}</span><b>{effort === null ? '—' : `${num(effort)} h`}</b><small>{pet.recordedHours != null ? 'hours already spent' : effort === null ? 'no count yet' : 'count ÷ pace'}</small></div>
      </div>


          {skill&&<p className="current-skill"><b>Current {skill.name}: level {skill.level}</b><span>{num(skill.xp,0)} XP</span></p>}
          <PetOdds pet={pet}/>
          <DriestRecord name={pet.name} activity={activity}/>
          <details key={pet.id} className="rate-explanation"><summary>Method &amp; calculation details</summary><RateBasis journal={journal} pet={pet}/></details>
          {skillDrops && <><h3 className="sub">{pet.name} drop table</h3>
          <DropTable sources={[skillDrops.source]} labels={{item: 'Source', qty: 'Level', filter: 'Filter sources…'}} unit={skillDrops.unit} bar={skillDrops.bar}
            notes={<p className="fine">{skillDrops.known ? `Rates at ${skillDrops.skill} level ${skillDrops.level}, OSRS Wiki.` : 'Level 99 rates; sync hiscores for yours.'}</p>}/></>}
          {logPage?.name !== PET_LIST_PAGE && <><h3 className="sub">{page ? `${page.name} drop table` : 'Drop table'}</h3>
          {page?<ActivityDrops journal={journal} page={page} drops={drops} kc={planned?.unit==='kills'?planned?.kc:null} focus={pet.name.toLowerCase()}/>:<div className="activity-source-fallback"><p className="muted">No activity drop table is catalogued for this pet. Its Wiki page has the available acquisition and reward mechanics.</p><a className="btn ghost sm" href={wiki(pet.name)} target="_blank" rel="noreferrer">Pet sources on the Wiki <ExternalLink size={13}/></a></div>}</>}
        </>}

        {tab === 'Guides' && <div className="guides">
          <a href={'/guides?activity='+encodeURIComponent(activity)}><span className="gi"><BookOpen size={22}/></span><span><b>Community guides</b><small>SpoonedOSRS strategies, equipment and inventory setups</small></span></a>
          <a href={wiki(pet.name)} target="_blank" rel="noreferrer"><span className="gi"><Dices size={22}/></span><span><b>Pet &amp; drop mechanics</b><small>Exact drop rates, rolls, thresholds and special cases</small></span><ExternalLink size={16}/></a>
          <a href={wiki(activity + '/Strategies')} target="_blank" rel="noreferrer"><span className="gi"><Swords size={22}/></span><span><b>Strategy &amp; gear</b><small>Recommended setups, inventory and mechanics walkthrough</small></span><ExternalLink size={16}/></a>
          <a href={wiki(activity)} target="_blank" rel="noreferrer"><span className="gi">{bossImg ? <img src={bossImg} alt=""/> : <BookOpen size={22}/>}</span><span><b>{activity}</b><small>Requirements, combat stats and full drop info</small></span><ExternalLink size={16}/></a>
          <a href={wikiSearch(activity + ' location')} target="_blank" rel="noreferrer"><span className="gi"><MapPin size={22}/></span><span><b>Getting there</b><small>Location and fastest teleports</small></span><ExternalLink size={16}/></a>
        </div>}

        {canEdit&&tab === 'Progress & notes' && <fieldset className="pet-editor" disabled={busy}>
          <legend className="sr-only">Edit {pet.name} progress</legend>
          <section className="pet-edit-section">
            <h3>Collection details</h3>
            <div className="pet-edit-toggles">
              <label className="check big"><input type="checkbox" checked={pet.obtained} onChange={e=>setPet({...pet,obtained:e.target.checked})}/> Pet collected</label>
              {!moderation&&<label className="check big"><input type="checkbox" checked={pet.priority} onChange={e=>setPet({...pet,priority:e.target.checked})}/> On my hunt list</label>}
            </div>
            {pet.obtained ? <>
              <p className="fine">Record when you received the pet. Leave anything you don’t know blank.</p>
              <div className="pet-edit-fields">
                <label className="field">Date received<input type="date" value={pet.date} onChange={e=>setPet({...pet,date:e.target.value})}/></label>
                <label className="field">Received-at unit<select value={acquisitionUnit(pet)} onChange={e=>setPet({...pet,obtainedUnit:e.target.value,obtainedCount:null,obtainedStartCount:null,obtainedApproximate:false})}>{acquisitionUnits(pet).map(unit=><option key={unit} value={unit}>{unit==='level'?`${petSkill[pet.name]} level (XP unknown)`:unit==='XP'?`${petSkill[pet.name]} XP`:pet.name==='Tiny tempor'&&unit==='rolls'?'Permits spent (rolls)':unit==='kills'?'Kill count (KC)':cap(petUnitLabel(pet,unit))}</option>)}</select></label>
                <label className="field pet-edit-wide">{acquisitionUnit(pet)==='level'?`${petSkill[pet.name]} level when received`:acquisitionUnit(pet)==='XP'?`${petSkill[pet.name]} XP when received`:`${cap(petUnitLabel(pet,acquisitionUnit(pet)))} when received`}<input type="number" min={0} max={acquisitionUnit(pet)==='level'?99:acquisitionUnit(pet)==='XP'?200000000:1e12} step={acquisitionUnit(pet)==='XP'?'any':1} value={pet.obtainedCount??''} placeholder="Unknown" onChange={e=>setPet({...pet,obtainedCount:e.target.value===''?null:Number(e.target.value)})}/><small>{acquisitionUnit(pet)==='level'&&pet.obtainedCount?`Level ${pet.obtainedCount} starts at ${num(xpAtLevel(pet.obtainedCount),0)} XP. Your exact XP remains unknown.`:pet.name==='Abyssal protector'?'One reward search is one pet roll; use searches, not games completed.':'This is separate from your current progress. Changing the unit clears this value.'}</small></label>
                <label className="field pet-estimate-check pet-edit-wide"><span><input type="checkbox" checked={pet.obtainedApproximate??false} onChange={e=>setPet({...pet,obtainedApproximate:e.target.checked})}/> Approximate acquisition count</span></label>
                <label className="field pet-edit-wide">{acquisitionUnit(pet)==='level'?'XP':cap(petUnitLabel(pet,acquisitionUnit(pet)))} at start of hunt (optional)<input type="number" min={0} max={1e12} value={pet.obtainedStartCount??''} onChange={e=>setPet({...pet,obtainedStartCount:e.target.value===''?null:Number(e.target.value)})}/><small>Exclude progress earned before this hunt. Blank assumes 0; other methods go in Your methods.</small></label>
              </div>
            </> : <p className="fine">Mark the pet collected to add its received-at count, date and method.</p>}
          </section>

          <section className="pet-edit-section">
            <div className="pet-edit-heading"><h3>Method details</h3></div>
            <p className="fine">{pet.obtained?'The method you got the pet from. Its rate sets your odds.':'The method you hunt with. Its rate and pace set your odds and times.'}</p>
            {m ? <>
              <IllustratedSelect label={pet.obtained?'Got it from':'Hunting with'} value={String(index)} onChange={v=>{if(busy)return;const method=pet.methods[Number(v)];setIndex(Number(v));setPet({...pet,plannedMethod:Number(v),...(pet.obtained?{obtainedMethod:method.name,historicalXph:null,...(acquisitionUnit(pet)!==method.unit?{obtainedUnit:method.unit,obtainedCount:null,obtainedStartCount:null}:{})}:{})});}} options={pet.methods.map((x,i)=>({value:String(i),label:x.name,detail:unitShort(pet,x.unit),image:bossArtwork(x.activity)||bossArtwork(x.name)||`/pets/${pet.id}.png`}))}/>
              {pet.obtained&&pet.obtainedMethod&&!receivedMethod(pet)&&<p className="fine">Saved as “{pet.obtainedMethod}”. Pick the method it matches.</p>}
              <div className="pet-edit-fields">
                <label className="field pet-edit-wide">{m.unit==='XP'?'Mean XP per pet':`Drop rate: 1 in … ${petUnitLabel(pet,m.unit)}`}<input type="number" min={1} max={1e12} step="any" value={m.rate==null?'':m.rate>=1000?Math.round(m.rate):Number(m.rate.toFixed(2))} placeholder="e.g. 3000" onChange={e=>change('rate',e.target.value)}/><small>{m.rateOverride?'Your own estimate; it changes only your numbers.':methodFact(pet,m)??'Wiki or saved rate.'}</small></label>
                {m.unit==='gambles'&&<label className="field">Honour points per hour<input type="number" min={1} step="any" value={m.kph?Math.round(m.kph*HONOUR_PER_GAMBLE):''} onChange={e=>change('kph',Number(e.target.value)>0?String(Number(e.target.value)/HONOUR_PER_GAMBLE):'')}/><small>A high-level gamble costs 500 points in each role (2,000).</small></label>}
                {['runs','raids','games'].includes(m.unit)&&<label className="field">Minutes per {m.unit.replace(/s$/,'')}<input type="number" min={0.01} step="any" value={m.kph?Number((60/m.kph).toFixed(2)):''} onChange={e=>change('kph',Number(e.target.value)>0?String(60/Number(e.target.value)):'')}/></label>}
              </div>
              {pet.name==='Tiny tempor'&&<p className="fine">One spent reward permit = one reward-pool roll. Enter permits spent; Tempoross completions and unspent permits do not count.</p>}
              {pet.name==='Phoenix'&&m.unit==='rolls'&&<p className="fine">Enter reward rolls, not Wintertodt subdues.</p>}
              {m.rateOverride&&pet.name==='Tangleroot'&&isTreeRun(m)&&m.name==='Tree runs'&&<button type="button" className="btn ghost sm" onClick={()=>setMethod(index,{rate:treeRunStats(skill?.level??99).xpPerPet,rateOverride:false,rateConfirmed:true})}>Reset to tree-run estimate</button>}
              {m.rateOverride&&m.farmingRun&&<button type="button" className="btn ghost sm" onClick={()=>setMethod(index,{rate:farmingRunStats(m.farmingRun!,skill?.level??99).runsPerPet,rateOverride:false,rateConfirmed:true})}>Reset to tree-run chance</button>}
              {m.rateOverride&&pet.name==='Tangleroot'&&!wikiMethod(pet.name,m.name)&&treeRow(m.name)?.unit===m.unit&&<button type="button" className="btn ghost sm" onClick={()=>setMethod(index,{rate:treeRate(treeRow(m.name)!,skill?.level),rateOverride:false,rateConfirmed:true})}>Reset to sheet estimate</button>}
              {m.rateOverride&&wikiMethod(pet.name,m.name)&&skill&&<button type="button" className="btn ghost sm" onClick={()=>{const calc=atLevel(wikiMethod(pet.name,m.name)!,skill.level);if(!calc)return;const methods=[...pet.methods];methods[index]={...m,rate:m.unit==='XP'?calc.expectedXp:calc.actions,rateOverride:false,rateConfirmed:true};setPet({...pet,methods});}}>Reset to Wiki estimate</button>}
              <details className="pet-method-settings"><summary>Method name &amp; units</summary><div className="pet-edit-fields">
                <label className="field pet-edit-wide">Method name<input value={m.name} maxLength={200} onChange={e=>change('name',e.target.value)}/></label>
                <label className="field pet-edit-wide">Counted in<select value={m.unit} onChange={e=>change('unit',e.target.value)}>{[...new Set([...UNITS,m.unit])].map(u=><option key={u} value={u}>{petUnitLabel(pet,u)}</option>)}</select><small>Changing units clears this method’s count, rate and pace.</small></label>
              </div></details>
            </> : <p className="muted">Add a method to track this pet.</p>}
            <p className="pet-save-calculation" role="status">{chance!==null?`${received?'Chance by obtained record':'Chance at your counts'}: ${pct(chance)}${planned?.rateOverride?' (estimate)':''}`:'Add a count and a rate to see your chance.'}</p>
          </section>

          <MethodCounts pet={pet} journal={journal} level={skill?.level??null} selected={index} onSelect={i=>{setIndex(i);if(!pet.obtained)setPet({...pet,plannedMethod:i});}} onChange={(i,key,v)=>change(key,v,i)}
            onAdd={m=>{const at=pet.methods.length;setIndex(at);setPet({...pet,plannedMethod:pet.obtained?pet.plannedMethod:at,methods:[...pet.methods,m]});}}
            onRemove={i=>{const methods=pet.methods.filter((_,j)=>j!==i),shift=(n:number|undefined)=>n===undefined?n:n===i?0:n>i?n-1:n;setIndex(shift(index)??0);setPet({...pet,methods,plannedMethod:shift(pet.plannedMethod)});}}/>
          <section className="pet-edit-section pet-edit-wide">
            <h3>Time &amp; notes</h3><EffortBasis pet={pet}/>
            <div className="pet-edit-fields">
              <label className="field">Hours already spent (optional)<input type="number" min={0} max={1e9} step="any" value={pet.recordedHours??''} placeholder="Use count ÷ pace" onChange={e=>setPet({...pet,recordedHours:e.target.value===''?null:Number(e.target.value)})}/></label>
              {skill&&<label className="field">Average {skill.name} XP/hour (optional)<input type="number" min={1} max={1e9} step="any" value={pet.historicalXph??''} placeholder="Your past training pace" onChange={e=>setPet({...pet,historicalXph:e.target.value===''?null:Number(e.target.value)})}/></label>}
              {!moderation&&<label className="field pet-edit-wide">Notes<textarea value={pet.notes} rows={3} maxLength={10000} placeholder="Gear, plans or milestones…" onChange={e=>setPet({...pet,notes:e.target.value})}/></label>}
            </div>
          </section>
        </fieldset>}

      </div>

      <footer className="modal-foot">
        <span className="muted">{canEdit&&tab==='Progress & notes'?'Changes apply when you save.':'Esc to close'}</span>
        <button type="button" className="btn ghost" disabled={busy} onClick={close}>Close</button>
        {canEdit&&(tab==='Progress & notes'?<button type="submit" className="btn primary" disabled={busy}>{busy?'Saving…':moderation?'Review correction':'Save progress'}</button>:<button type="button" className="btn primary" disabled={busy} onClick={()=>setTab('Progress & notes')}>Edit progress</button>)}
      </footer>
    </form>
  </dialog>;
}

/** Methods a player can add: the OSRS Wiki skilling methods at their level, the pet's default methods, or a custom one. */
function methodChoices(pet:Pet,level:number|null):Method[]{
  const have=new Set(pet.methods.map(m=>m.name.toLowerCase())),skill=petSkill[pet.name],trees=pet.name==='Tangleroot';
  // Tangleroot: the tree run, then PetCord's per-tree methods; Wiki crops it already covers are left out.
  const wiki=skill?(methodsForSkill(skill)?.methods??[]).filter(w=>!trees||!treeRow(w.name)).map(w=>skillMethodChoice(skill,w,level)):[];
  const defaults=trees?[treeRunsMethod(level),...TANGLEROOT_TREES.map(r=>treeMethod(r,level))]:(initial.pets.find(x=>x.id===pet.id)?.methods??[]).map(m=>({...m,kc:null}));
  const seen=new Set<string>();
  return [...defaults,...wiki].filter(m=>{const k=m.name.toLowerCase();if(have.has(k)||seen.has(k))return false;seen.add(k);return true;});
}

/** A number field with its unit inside it, so every count and pace says what it counts: 1,200 laps, 79 laps/h. */
function UnitInput({unit,label,...props}:{unit:string;label:string}&React.InputHTMLAttributes<HTMLInputElement>){
  return <span className="unit-input" style={{'--unit-width':`${Math.ceil(unit.length*6.4)}px`} as React.CSSProperties}><input type="number" min={0} max={1e12} aria-label={label} {...props}/><i aria-hidden="true">{unit}</i></span>;
}

const cap=(s:string)=>s.charAt(0).toUpperCase()+s.slice(1);
/** One short muted fact under a method's rate, when the method has one: the tree run's make-up, XP per tree. */
function methodFact(pet:Pet,m:Method):string|null{
  if(pet.name!=='Tangleroot')return null;
  if(m.name===TREE_RUNS&&isTreeRun(m))return `Average run: ${TREE_RUN.magic} magic + ${TREE_RUN.palm} palm, ~${num(treeRunStats(99).xp/1000,0)}k XP`;
  return treeFact(m);
}
const rateText=(x:Method)=>x.rate?x.unit==='XP'?`${num(x.rate,0)} XP`:`1/${num(x.rate,0)}`:'—';

/** Every method with its own count and pace, like the pet sheet: fill in kills or XP for each method at once and add
 * more from a search. Hours use each method's pace; pick a row to edit its rate below. */
function MethodCounts({pet,journal,level,selected,onSelect,onChange,onAdd,onRemove}:{pet:Pet;journal:Journal;level:number|null;selected:number;onSelect:(i:number)=>void;onChange:(i:number,key:'kc'|'kph',value:string)=>void;onAdd:(m:Method)=>void;onRemove:(i:number)=>void}){
  const countOf=(x:Method)=>pet.name==='Phoenix'&&x.unit==='rolls'?pet.crateRolls:x.kc;
  const [query,setQuery]=useState(''),[adding,setAdding]=useState(false);
  // Only the methods in use show: those with a count, the one used for estimates, and any picked from the search.
  const [picked,setPicked]=useState<string[]>([]);
  const inUse=(x:Method,i:number)=>i===selected||countOf(x)!=null||picked.includes(x.name);
  const hours=pet.methods.reduce((sum,x)=>{const count=countOf(x);return sum+(count&&x.kph?count/x.kph:0);},0),chance=pet.obtained?null:likelihood(pet);
  const q=query.trim().toLowerCase(),match=(m:Method)=>m.name.toLowerCase().includes(q);
  const hidden=pet.methods.filter((x,i)=>!inUse(x,i));
  const choices=adding?[...hidden,...methodChoices(pet,level)].filter(match).slice(0,8):[],added=adding&&q?pet.methods.filter((x,i)=>inUse(x,i)&&match(x)).slice(0,4):[];
  const custom=():Method=>({rateConfirmed:false,paceConfirmed:false,name:query.trim()||'My method',activity:null,kc:null,kph:null,rate:null,unit:petSkill[pet.name]?'XP':'kills',rateOverride:true,source:'Custom estimate'});
  const add=(m:Method)=>{if(!pet.methods.includes(m))onAdd(m);setPicked(list=>[...list,m.name]);setAdding(false);setQuery('');};
  const remove=(i:number)=>{const x=pet.methods[i];setPicked(list=>list.filter(n=>n!==x.name));if(x.source==='Custom estimate')onRemove(i);else onChange(i,'kc','');};
  const current=pet.methods[selected],synced=current&&countOf(current)==null?hiscoresCount(pet,journal,current):null;
  return <section className="pet-edit-section method-counts-section">
    <div className="pet-edit-heading"><h3>Your methods</h3>{!adding&&<button type="button" className="btn ghost sm" disabled={pet.methods.length>=100} onClick={()=>setAdding(true)}><Plus size={14}/> Add method</button>}</div>
    <p className="fine">Your count and pace on each method. Every count adds to your chance; pick a row to see its details.</p>
    {adding&&<div className="method-add">
      <label className="search"><Search size={15} aria-hidden="true"/><input autoFocus aria-label="Search methods" placeholder={petSkill[pet.name]?'Search, like Anglerfish or Barbarian fishing':'Search methods'} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add(choices[0]??custom());}if(e.key==='Escape'){e.preventDefault();setAdding(false);}}}/></label>
      <div className="method-add-results">
        {choices.map(m=><button type="button" key={m.name} onClick={()=>add(m)}><b>{m.name}</b><small>{m.rate?m.unit==='XP'?`${num(m.rate,0)} XP per pet`:`1/${num(m.rate,0)} ${unitShort(pet,m.unit)}`:`no rate yet · ${unitShort(pet,m.unit)}`}{m.kph?` · ${num(m.kph,0)} ${unitShort(pet,m.unit)}/h`:''}</small></button>)}
        {added.map(m=><button type="button" key={'have-'+m.name} disabled><b>{m.name}</b><small>added</small></button>)}
        <button type="button" className="method-add-custom" onClick={()=>add(custom())}><b>Custom method{query.trim()?`: ${query.trim()}`:''}</b><small>Enter your own rate and pace</small></button>
      </div>
      <button type="button" className="btn ghost sm" onClick={()=>setAdding(false)}>Cancel</button>
    </div>}
    <div className="method-counts" aria-label="Your count and pace for each method">
    <div className="method-count head" aria-hidden="true"><span>Method</span><span>Your count</span><span>Pace</span><span>Rate</span><span>Hours</span><span/></div>
    {pet.methods.map((x,i)=>{
      if(!inUse(x,i))return null;
      const count=countOf(x),h=count&&x.kph?count/x.kph:null,unit=unitShort(pet,x.unit);
      return <div key={i} className={'method-count'+(i===selected?' is-selected':'')}>
        <button type="button" className="method-count-name" aria-pressed={i===selected} title={`Edit ${x.name}`} onClick={()=>onSelect(i)}><b>{x.name}</b></button>
        <label className="method-count-field"><small>Your count</small><UnitInput unit={unit} label={`${x.name}: your ${petUnitLabel(pet,x.unit)}`} step={x.unit==='XP'?'any':1} placeholder="—" value={count??''} onChange={e=>onChange(i,'kc',e.target.value)}/></label>
        <label className="method-count-field"><small>Pace</small><UnitInput unit={`${unit}/h`} label={`${x.name}: ${petUnitLabel(pet,x.unit)} per hour`} step="any" placeholder="—" value={x.kph??''} onChange={e=>onChange(i,'kph',e.target.value)}/></label>
        <span className="method-count-rate" title={x.unit==='XP'?'Mean XP per pet':`1 pet per this many ${petUnitLabel(pet,x.unit)}`}>{rateText(x)}</span>
        <span className="method-count-hours">{h===null?'—':`${num(h)} h`}</span>
        <button type="button" className="method-count-remove" aria-label={`Remove ${x.name}`} title={i===selected?'Used for estimates':'Remove method'} disabled={i===selected} onClick={()=>remove(i)}><X size={14}/></button>
      </div>;})}
    <div className="method-count total" aria-live="polite"><span>Total</span><span/><span/><span className="method-count-rate">{chance===null?'':`${pct(chance)} chance`}</span><span className="method-count-hours">{hours?`${num(hours)} h`:'—'}</span><span/></div>
  </div>
  {synced&&<p className="method-hiscores"><RefreshCw size={13} aria-hidden="true"/><span>Hiscores: <b>{num(synced.value,0)}</b> {synced.label}</span><button type="button" className="link" onClick={()=>onChange(selected,'kc',String(synced.value))}>Use for {current.name}</button></p>}
  </section>;
}
