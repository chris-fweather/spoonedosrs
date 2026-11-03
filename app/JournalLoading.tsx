import {ChevronRight} from 'lucide-react';
import {BOSS_RANK_COUNT, OVERVIEW_PROGRESS} from './Profile';
import {PET_SUMMARY_LABELS} from './PetSummary';
import {ProfileChat} from './Community';
import seed from '@/lib/catalogue.json';
import {OWNER_TABS, PROFILE_TABS} from './profile-tabs';
import "./journal-loading.css";
const blanks = (count:number, className:string) => Array.from({length:count}, (_, i) => <span key={i} className={className}/>);
/** Three hunt rows, as the Overview's compact lists show them. */
const huntList = (key:string) => <section key={key} className="sec"><div className="sec-h"><h3><span className="skeleton-line inline skeleton-heading"/></h3></div><div className="dry">{Array.from({length:3}, (_, i) => <span key={i} className="dry-row"><span className="skeleton-dot skeleton-icon"/><span className="dry-name"><span className="skeleton-line"/><span className="skeleton-line short"/></span><span className="dry-track"/><span className="dry-val"><span className="skeleton-line short"/></span></span>)}</div></section>;
/** The loaded profile, section by section, with the same classes: name and title lines, portrait, skills, boss ranks,
 * tabs, progress rows, pet summary, pet catalogue, hunt lists and the join banner. Every block keeps its loaded size,
 * so nothing moves when the journal arrives. */
export function JournalLoading({username, failed, owner=false}: {username: string; failed: boolean;
  /** The viewer's own linked name: the owner's tabs show too. */
  owner?: boolean}) {
  const tabs = owner ? PROFILE_TABS : PROFILE_TABS.filter(t => !OWNER_TABS.includes(t.n));
  return <main className="journal-loading" aria-busy={!failed}>
    <p className="sr-only" role="status">{failed ? "Journal unavailable" : `Opening ${username}’s journal`}</p>
    {failed ? <section className="osrs-panel journal-failed"><h2>Journal unavailable</h2><p>Use Retry above to try again.</p></section> :
    <div className="frame has-pop profile-banner-layout journal-skeleton">
      <aside className="col-left" aria-hidden="true" inert>
        <div className="osrs-panel char-card">
          <div className={`char-name ${username.length>9?'long-name':''}`}><div className="profile-identity"><div className="profile-name-lines"><b><span>{username}</span></b><span className="achievement-title"><span className="skeleton-line skeleton-title"/></span></div></div></div>
          <div className="char-stage skeleton-stage"><span className="loading-spinner"/></div>
          <div className="char-meta"><span><small>Combat</small><b>—</b></span><span><small>Total</small><b>—</b></span></div>
        </div>
        <div className="osrs-panel skills-tab"><div className="skill-grid">{blanks(24, 'sk skeleton-block')}</div><div className="skill-foot"><span>Total XP: <b>—</b></span></div></div>
        <section className="osrs-panel activity-ranks activity-ranks-unknown"><div className="activity-rank-heading"><button type="button" tabIndex={-1} aria-pressed="true">Boss ranks</button><button type="button" tabIndex={-1} aria-pressed="false">Activities</button><span className="activity-rank-count"><b>—</b>/{BOSS_RANK_COUNT}</span></div><div className="activity-rank-grid">{blanks(BOSS_RANK_COUNT, 'activity-rank-icon skeleton-rank')}</div></section>
      </aside>
      <section className="window osrs-panel" aria-hidden="true" inert>
        <nav className="wtabs">{tabs.map(({n,img}, i) => <button key={n} type="button" tabIndex={-1} aria-selected={i===0}><img src={img} alt=""/><span>{n}</span></button>)}</nav>
        <div className="wbody overview-body"><div className="ov">
          <div className="ov-top is-full">
            <div className="ov-prog">{OVERVIEW_PROGRESS.map(({k,img}) => <span key={k} className="prog-row"><img src={img} alt=""/><span className="prog-label">{k}</span><span className="meter unknown"><b/></span><span className="prog-val"><span className="skeleton-line inline"/></span><ChevronRight size={14}/></span>)}</div>
          </div>
          <section className="pet-summary"><div className="pet-summary-grid">{PET_SUMMARY_LABELS.map(k => <div key={k}><span>{k}</span><b>—</b><small><span className="skeleton-line inline"/></small></div>)}</div></section>
          <div className="ov-pets pets-unknown"><div className="sec-h"><h3>Pets collected</h3><span className="sm"><span className="skeleton-line inline"/></span></div><div className="petlog-grid">{Array.from({length:seed.pets.length}, (_, i) => <span key={i} className="overview-pet-trigger"><span className="skeleton-dot"/></span>)}</div></div>
          <div className="ov-two">{['quickest','driest'].map(huntList)}</div>
          <div className="ov-two">{['lucky','unlucky'].map(huntList)}</div>
        </div></div>
      </section>
      {/* The banner is static, so it renders for real and stays usable while the journal loads. */}
      <div className="profile-join-slot"><ProfileChat embedded/></div>
      <aside className="pop osrs-panel pop-placeholder" aria-hidden="true"/>
    </div>}
  </main>;
}
