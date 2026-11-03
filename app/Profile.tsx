'use client';
import {useEffect, useRef, useState} from 'react';
import './profile-release.css';
import './overview-pets.css';
import './profile-placeholders.css';
import {ReleaseStamp} from './ReleaseStamp';
import {releaseOrder} from '@/lib/release-dates';
import activityNames from '@/lib/activity-catalogue.json';
import {ChevronRight, ExternalLink} from 'lucide-react';
import {rankTier} from '@/lib/rank-rewards';
import {SkillRankIcon,skillRankLabel} from './SkillRankIcon';
import {achievementTitle, displayTitle, earnedMarks, emptyEquipped, type StoredFlair} from '@/lib/flair';
import {selectedTitle} from '@/lib/presentation';
import {collectedDate,companionDescription,petHoverLines} from '@/lib/pet-presentation';
import './profile-identity.css';
import {HoverTip} from './HoverTip';
import {ProfileStaffControls} from './ProfileStaffControls';
import {ProfileIdentity} from './ProfileIdentity';
import {ProfileEditor} from './ProfileEditor';
import {ReputationButton} from './ReputationButton';
import {AchievementEmblem} from './AchievementEmblem';
import {BadgeHover} from './BadgeCard';
import {emblemInfo} from '@/lib/badge-info';
import {LookStage} from './Look';
import type {Journal, Pet} from '@/lib/model';
import {progressAvailability} from '@/lib/progress-availability';
import {petSkill} from '@/lib/estimates';
import {bossArtwork} from '@/lib/artwork';
import {DryMeter, QuickestHunts} from './ProgressCharts';
import {LuckHunts, PetSummary, luckHours} from './PetSummary';
import {petLuck} from '@/lib/pet-luck';
import {atLevel, methodWiki, methodsForSkill} from '@/lib/pet-rates';
import {compact, num, wiki} from '@/lib/ui';
import {Meter, Count} from './Meter';
import {PopHead, Stats, xpFor, type PopApi} from './Pop';

// In-game skills tab order: three columns, read across.
const SKILL_ORDER = ['Attack', 'Hitpoints', 'Mining', 'Strength', 'Agility', 'Smithing', 'Defence', 'Herblore', 'Fishing', 'Ranged', 'Thieving', 'Cooking', 'Prayer', 'Crafting', 'Firemaking', 'Magic', 'Fletching', 'Woodcutting', 'Runecraft', 'Slayer', 'Farming', 'Construction', 'Hunter', 'Sailing'];
type Skill = Journal['hiscores']['skills'][number];

export function combatLevel(j: Journal) {
  if(!['Attack','Strength','Defence','Hitpoints','Prayer','Ranged','Magic'].every(n=>j.hiscores.skills.some(s=>s.name===n)))return null;
  const l = (n: string) => j.hiscores.skills.find(s => s.name === n)?.level ?? 1;
  const base = 0.25 * (l('Defence') + Math.max(l('Hitpoints'), 10) + Math.floor(l('Prayer') / 2));
  const melee = 0.325 * (l('Attack') + l('Strength'));
  const range = 0.325 * Math.floor(l('Ranged') * 1.5);
  const mage = 0.325 * Math.floor(l('Magic') * 1.5);
  return Math.floor(base + Math.max(melee, range, mage));
}

export type ProfileFlair = StoredFlair & {preview: boolean};
export const emptyFlair: ProfileFlair = {companionPet: null, displayPiece: null, equipped: emptyEquipped(), pinnedMark: null, title: null, canEdit: false, preview: false};

export function PlayerCard({journal: j, flair, onFlair, viewerKey='guest', reputationPreview}: {journal: Journal; flair: ProfileFlair; onFlair: (next: ProfileFlair) => Promise<boolean>; viewerKey?:string; reputationPreview?:number}) {
  const [editing,setEditing]=useState(false);
  // The settings preview copies the portrait's shape, so it frames the character exactly as the profile will.
  const stage=useRef<HTMLDivElement>(null),[portraitAspect,setPortraitAspect]=useState<number>();
  const openEditor=()=>{const el=stage.current;if(el?.clientWidth&&el.clientHeight)setPortraitAspect(el.clientWidth/el.clientHeight);setEditing(true);};
  const clean=flair, title=displayTitle(j.username,clean.title), earnedTitle=flair.showcase?flair.showcase.achievementTitle:(j.restricted?null:selectedTitle(j,clean.titleChoice??'auto',clean.pinnedMark,flair.staff?.role==='owner',title==='the Generous',flair.staff?.role));
  // Privacy lives in Account settings; older ?settings=privacy links go there.
  useEffect(()=>{const settings=new URLSearchParams(location.search).get('settings');if(!flair.canEdit||settings===null)return;if(settings==='privacy')location.replace('/account?tab=profiles');else openEditor();},[flair.canEdit]);
  const mark=flair.showcase?.badge??earnedMarks(j).find(m=>m.id===clean.pinnedMark);
  const companion=flair.showcase?.pet??j.pets.find(p=>p.id===clean.companionPet&&p.obtained);
  const total=j.hiscores.skills.find(s=>s.name==='Overall');
  return <div className="osrs-panel char-card">
    <ProfileIdentity username={j.username} accountMode={j.accountMode} staff={flair.staff} namePrefix={flair.namePrefix} donation={flair.donation} title={title} earnedTitle={earnedTitle} verified={flair.verified}/>
    <div className="char-stage" ref={stage}>
      <LookStage appearance={clean.appearance} equipped={clean.equipped} petId={companion?.id??null} petName={companion?.name??null} petDescription={companion?companionDescription(j,companion.id,companion.name):undefined} username={j.username}/>
      <ReputationButton key={`${j.username}:${viewerKey}`} username={j.username} viewerKey={viewerKey} previewCount={reputationPreview}/>
      {mark && <div className="char-stamps"><BadgeHover className="char-stamp" info={emblemInfo(mark,achievementTitle(j,mark.id))}><AchievementEmblem mark={mark}/></BadgeHover></div>}
      {!flair.canEdit&&viewerKey!=='guest'&&<ProfileStaffControls username={j.username} viewerKey={viewerKey} identity={{username:j.username,accountMode:j.accountMode,staff:flair.staff,donation:flair.donation,title,earnedTitle}}/>}
      {flair.canEdit && <button type="button" className="portrait-settings" aria-label="Profile settings" title="Profile settings" onClick={openEditor}><img className="settings-icon" src="/icons/community/settings-icon.png" alt="" width={19} height={19}/></button>}
    </div>
    <div className="char-meta"><span><small>Combat</small><b>{combatLevel(j)??'—'}</b></span><span><small>Total</small><b>{total?num(total.level,0):'—'}</b></span></div>
    {editing && flair.canEdit && <ProfileEditor journal={j} flair={flair} portraitAspect={portraitAspect} onSave={onFlair} onClose={()=>setEditing(false)}/>}
  </div>;
}

export function SkillsPanel({journal: j, pop}: {journal: Journal; pop: PopApi}) {
  const total = j.hiscores.skills.find(s => s.name === 'Overall');
  return <div className="osrs-panel skills-tab">
    <div className="skill-grid">{SKILL_ORDER.map(name => {
      const s=j.hiscores.skills.find(skill=>skill.name===name);
      const known=!!s && s.level>0 && s.xp>=0;
      // An unranked or 0 XP skill never shows a rank tier, whatever rank a source reports.
      const tierRank=known&&s.xp>0?s.rank:-1;
      const label=known?`${name}, level ${s.level}${s.rank>0?`, Hiscores rank #${num(s.rank,0)}`:''}${rankTier(tierRank)?`, ${skillRankLabel(s.rank)}`:''}`:`${name}: not synced`;
      return <HoverTip key={name} className="skill-tip-trigger" tabIndex={-1} placement="right" outsideSelector=".skill-grid" label={label} content={<span className="skill-hover-content">
        <strong>{name}</strong>
        <span className="skill-hover-group"><span>{known?`Level ${s.level}`:'Level not synced'}</span><b>{known?num(s.xp,0)+' XP':'XP not synced'}</b></span>
        <span className="skill-hover-group"><small>OSRS Hiscores</small><b>{known?(s.rank>0?'Rank #'+num(s.rank,0):'Unranked'):'Rank not synced'}</b>{known&&rankTier(tierRank)&&<small className="skill-rank-description">{skillRankLabel(s.rank)}</small>}</span>
        {known && s.level<99 && <span className="skill-hover-group"><small>Next level · {s.level+1}</small><b>{num(Math.max(0,xpFor(s.level+1)-s.xp),0)} XP remaining</b><Meter done={Math.max(0,s.xp-xpFor(s.level))} total={xpFor(s.level+1)-xpFor(s.level)}/></span>}
      </span>}>
        <button type="button" className={`sk ${rankTier(tierRank)?'skill-rank-'+rankTier(tierRank):''} ${known?'':'skill-unknown'} ${pop.key==='skill:'+name?'sel':''}`} aria-label={label} aria-disabled={!known||!!j.restricted}
          onClick={()=>{if(known&&!j.restricted)pop.show('skill:'+name,jj=><SkillDetail journal={jj} name={name}/>);}}>
          <SkillRankIcon src={bossArtwork(name)} rank={known?tierRank:null}/><b className={known&&s.level>=99?'max':''}>{known?s.level:'—'}</b>
        </button>
      </HoverTip>;
    })}</div>
    <div className="skill-foot"><span>Total XP: <b>{total?num(total.xp,0):'—'}</b></span></div>
  </div>;
}

/** Hiscores entries listed under Activities rather than Boss ranks. */
export const isOtherActivity=(name:string)=>/points|bounty hunter|clue scrolls| - rank|zeal|rifts closed|glory|collections logged/i.test(name);
/** Every boss the hiscores rank, so the loading skeleton reserves the same grid. */
export const BOSS_RANK_COUNT=activityNames.filter(name=>!isOtherActivity(name)).length;

/** Public activity records only; hidden counts are already removed from the journal API. */
export function ActivityRanks({journal}:{journal:Journal}){
 const [group,setGroup]=useState<'bosses'|'activities'>('bosses');
 const other=isOtherActivity;
 const knownRows=journal.hiscores.activities.filter(a=>group==='activities'?other(a.name):!other(a.name));
 const unknown=knownRows.length===0;
 const rows=(unknown?activityNames.filter(name=>group==='activities'?other(name):!other(name)).map(name=>({name,rank:-1,score:-1})):knownRows).slice().sort(group==='bosses'?releaseOrder('bosses'):()=>0);
 if(journal.restricted||journal.details?.petRecords===false)return null;
 return <section className={`osrs-panel activity-ranks ${unknown?'activity-ranks-unknown':''}`} aria-label="Boss and activity hiscores"><div className="activity-rank-heading"><button type="button" aria-pressed={group==='bosses'} onClick={()=>setGroup('bosses')}>Boss ranks</button><button type="button" aria-pressed={group==='activities'} onClick={()=>setGroup('activities')}>Activities</button><span className="activity-rank-count" aria-label={unknown?`${group}: not yet synced`:`${rows.filter(a=>a.rank>0).length} of ${rows.length} ${group} ranked`} title={unknown?'Not yet synced':'Ranked on the hiscores'}><b>{unknown?'—':rows.filter(a=>a.rank>0).length}</b>/{rows.length}</span></div><div className="activity-rank-grid">{rows.map(a=>{
 const label=unknown?`${a.name} · Not yet synced`:`${a.name} · ${a.score>=0?num(a.score,0)+' '+(group==='bosses'?'KC':'score'):'Count not recorded'} · ${a.rank>0?'Hiscores rank #'+num(a.rank,0):'Unranked'}`;
 const art=bossArtwork(a.name)??(a.name.startsWith('Clue Scrolls')?bossArtwork('Clue Scrolls (all)'):'/icons/navigation/combat-achievements-icon.png');
 return <HoverTip key={a.name} className={`activity-rank-icon ${a.rank>0?'ranked':'unranked'} ${rankTier(a.rank)?'rank-glow-'+rankTier(a.rank):''}`} label={label} content={<span className="activity-rank-tip"><strong>{a.name}</strong><ReleaseStamp name={a.name} kind="bosses"/><span className="activity-hover-data">{unknown?<span>Not yet synced</span>:<><span>{a.score>=0?`${group==='bosses'?'KC':'Score'}: ${num(a.score,0)}`:'Count not recorded'}</span><span>{a.rank>0?`Hiscores rank: #${num(a.rank,0)}`:'Hiscores: unranked'}</span></>}</span>{rankTier(a.rank)&&<small>{a.rank===1?'Champion title unlocked':'Top 1,000 title unlocked'}</small>}</span>}><img src={art} alt=""/></HoverTip>;
 })}</div></section>;
}

export function SkillDetail({journal: j, name}: {journal: Journal; name: string}) {
  const [method, setMethod] = useState<string | null>(null);
  const s = j.hiscores.skills.find(x => x.name === name);
  if (!s) return <p className="muted">No hiscores data for {name}.</p>;
  const next = s.level < 99 ? xpFor(s.level + 1) : null;
  const cur = xpFor(s.level);
  const to99 = Math.max(0, xpFor(99) - s.xp);
  const pets = j.pets.filter(p => petSkill[p.name] === name);
  return <>
    <PopHead img={bossArtwork(name)} kicker="Skill" title={name} sub={<span className="y">Level {s.level}</span>}/>
    <Stats rows={[
      ['Experience', num(s.xp, 0), 'y'],
      ['Rank', s.rank > 0 ? num(s.rank, 0) : 'Unranked'],
      ...(next ? [[`XP to ${s.level + 1}`, num(next - s.xp, 0)] as [string, string]] : []),
      ...(s.level < 99 ? [['XP to 99', num(to99, 0)] as [string, string]] : []),
      ['XP to 200M', compact(Math.max(0, 2e8 - s.xp))],
    ]}/>
    {next && <div className="pop-block"><span className="kicker">Progress to {s.level + 1}</span><Meter done={s.xp - cur} total={next - cur}/></div>}
    <div className="pop-block"><span className="kicker">Progress to 99</span><Meter done={Math.min(s.xp, xpFor(99))} total={xpFor(99)}/><small className="muted">{num(Math.min(100, s.xp / xpFor(99) * 100), 1)}% of the way</small></div>
    <div className="pop-block"><span className="kicker">Progress to 200M</span><Meter done={s.xp} total={2e8}/></div>
    {pets.length > 0 && <div className="pop-block"><span className="kicker">Skilling pet</span>{pets.map(p => <div key={p.id} className="pop-pet"><img src={`/pets/${p.id}.png`} alt=""/><b>{p.name}</b><span className={p.obtained ? 'good' : 'muted'}>{p.obtained ? 'Collected' : progressAvailability(j).pets ? 'Not yet' : 'Not synced'}</span></div>)}</div>}
    <SkillMethods journal={j} level={s.level} skill={name} open={method} setOpen={setMethod}/>
    <div className="pop-links"><a className="btn ghost sm" href={wiki(name)} target="_blank" rel="noreferrer">Wiki <ExternalLink size={13}/></a><a className="btn ghost sm" href={wiki(`${name} training`)} target="_blank" rel="noreferrer">Training guide <ExternalLink size={13}/></a></div>
  </>;
}

function SkillMethods({journal: j, skill, level, open, setOpen}: {journal: Journal; skill: string; level: number; open: string | null; setOpen: (n: string | null) => void}) {
  const pack = methodsForSkill(skill);
  if (!pack) return null;
  return <div className="pop-block">
    <span className="kicker">{pack.pet} methods</span>
    <div className="pick-list methods">{pack.methods.map(m => {
      const on = open === m.name;
      const calc = atLevel(m, level);
      const act = j.hiscores.activities.find(a => a.name.toLowerCase() === m.name.toLowerCase());
      return <div key={m.name} className={on ? 'on' : ''}>
        <button type="button" onClick={() => setOpen(on ? null : m.name)}>
          <span>{m.name}</span>
          <small>{calc ? `1/${num(calc.actions, 0)}` : '—'}</small>
        </button>
        {on && <p className="method-more">
          {act ? <>Hiscores {num(act.score, 0)} · rank {act.rank > 0 ? num(act.rank, 0) : 'unranked'}. </> : <>Not on the synced hiscores. </>}
          {calc?.expectedXp != null ? <>Expected {num(calc.expectedXp, 0)} XP at level {level}. </> : <>XP per action is not in the snapshot. </>}
          <a href={methodWiki(m.link)} target="_blank" rel="noreferrer">Wiki</a>
        </p>}
      </div>;
    })}</div>
  </div>;
}

/** The Overview's progress rows, shared with the loading skeleton so both show the same labels and art. */
export const OVERVIEW_PROGRESS = [
  {k: 'Pets', img: '/brand/rocky-mascot.webp', view: 'Pets'},
  {k: 'Collection log', img: '/ui/collection-log-icon.png', view: 'Collection log'},
  {k: 'Quest points', img: '/ui/quest-point-icon.png', view: 'Quests'},
  {k: 'Diary tasks', img: '/ui/achievement-diaries-icon.png', view: 'Diaries'},
  {k: 'Combat achievements', img: '/icons/navigation/combat-achievements.png', view: 'Combat'},
] as const;

export function Overview({journal: j, go, onOpen}: {journal: Journal; go: (view: string) => void; onOpen: (p: Pet) => void}) {
  const available=progressAvailability(j);
  const owned = j.pets.filter(p => p.obtained);
  const p = j.profile;
  const quests = p?.quests ?? [];
  const qp = quests.filter(q => q.state === 'finished').reduce((s, q) => s + q.points, 0), qpAll = quests.reduce((s, q) => s + q.points, 0);
  const tiers = p?.diaries.flatMap(d => d.tiers) ?? [];
  const [pets, log, questRow, diaryRow, combatRow] = OVERVIEW_PROGRESS;
  const rows = [
    {...pets, known: available.pets, done: owned.length, all: j.pets.length},
    {...log, known: available.log, done: j.log?.obtained ?? 0, all: j.log?.total ?? 0},
    {...questRow, known: available.quests, done: qp, all: qpAll},
    {...diaryRow, known: available.diaries, done: tiers.reduce((s, t) => s + t.completed, 0), all: tiers.reduce((s, t) => s + t.total, 0)},
    {...combatRow, known: available.combat, done: p?.combat.reduce((s, c) => s + c.completed, 0) ?? 0, all: p?.combat.reduce((s, c) => s + c.total, 0) ?? 0},
  ];
  return <div className="ov">
    <div className="ov-top is-full">
      <div className="ov-prog">{rows.map(t => <button type="button" key={t.k} className="prog-row" onClick={() => go(t.view)}>
        <img src={t.img} alt=""/>
        <span className="prog-label">{t.k}</span>
        <Meter done={t.done} total={t.all} unknown={!t.known}/>
        <span className={`prog-val ${t.known?'':'is-unknown'}`}>{t.known?<><Count done={t.done} total={t.all}>{num(t.done, 0)}</Count>/{num(t.all, 0)}</>:"Not synced"}</span>
        <ChevronRight size={14}/>
      </button>)}</div>
    </div>
    <PetSummary journal={j} known={available.pets}/>
    {<div className={`ov-pets ${available.pets?'':'pets-unknown'}`}>
      <div className="sec-h"><h3>Pets collected</h3><span className="sm">{available.pets?<Count done={owned.length} total={j.pets.length}/>:"Not synced"}</span></div>
      <div className="petlog-grid">{[...j.pets].sort(releaseOrder('pets')).map(x=>{
        const collected=available.pets&&x.obtained;
        const status=!available.pets?'Not synced':collected?`Obtained${x.date?' · '+collectedDate(x.date):''}`:'Not collected yet';
        const record=petHoverLines(j,x),details=[available.pets?record.obtained:null,record.current].filter((line):line is string=>!!line);
        // Luck as in the Pet summary: expected hours minus the hours the pet took (or has taken so far).
        const luck=available.pets?petLuck(x).luck:null,luckLine=luck!==null&&luck!==0?`${luckHours(luck)} ${luck>0?'lucky':'unlucky'}`:null;
        const label=[x.name,x.category,status,...details,...(luckLine?[luckLine]:[])].join(' · ');
        return <HoverTip key={x.id} tabIndex={-1} className="overview-pet-trigger" label={label} content={<span className="overview-pet-tip">
          <strong>{x.name}</strong><small>{x.category}</small><ReleaseStamp name={x.name} kind="pets"/><b className={collected?'good':'muted'}>{status}</b>
          {(details.length>0||luckLine)&&<span className="overview-pet-record">{details.map((line,index)=><span key={index}>{line}</span>)}{luckLine&&<b className={luck!>0?'good':'bad'}>{luckLine}</b>}</span>}
        </span>}><button type="button" className={collected?'got':''} aria-label={label} onClick={()=>onOpen(x)}><img src={`/pets/${x.id}.png`} alt="" loading="lazy"/></button></HoverTip>;
      })}</div>
    </div>}
    <div className="ov-two">
      {available.attempts&&<DryMeter pets={j.pets} onOpen={onOpen} limit={3} title="Driest hunts" compact/>}
      {available.pets&&<QuickestHunts pets={j.pets} onOpen={onOpen} limit={3} compact/>}
    </div>
    {available.pets&&owned.length>0&&<div className="ov-two">
      <LuckHunts journal={j} onOpen={onOpen} limit={3} lucky/>
      <LuckHunts journal={j} onOpen={onOpen} limit={3} lucky={false}/>
    </div>}
  </div>;
}
