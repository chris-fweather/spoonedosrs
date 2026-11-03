"use client";
import {Empty, PanelHead} from "./StaffReview";
import {createContext,useContext} from "react";
import {ExternalLink,Link2,Lock,LockOpen} from "lucide-react";
import type {StaffPerson} from "@/lib/staff-people";
import {STAFF_AREAS, type StaffArea, type StaffPermissions} from "@/lib/staff-permissions";
import type {StaffRole} from "@/lib/staff-policy";
import {PersonName, StaffBadge} from "./StaffBadge";
import {DiscordMark} from "./DiscordMark";
import type {CorrectionSection, StaffTabId} from "./StaffNavigation";
type Viewer = {id: string; role: StaffRole; permissions: StaffPermissions};
export type ReviewState = "pending" | "approved" | "rejected";
export type ChangeNote = {kind:'note'|'reason';actorId:string;actorName:string|null;text:string;at:string};
export type Change = {id:number;notes?:ChangeNote[];kind:'rate'|'record';image?:string|null;target:string;payload:string;source:string;reason:string;actor_id:string;actor_name:string;state:string;created_at:string;reviewed_at:string|null;reviewer_id?:string|null;reviewer_name?:string|null;actor_role?:StaffRole|null;reviewer_role?:StaffRole|null};
/** A recent ownership request, for the overview feed. */
export type OwnershipCase = {id:string;rsn:string;action:"relink"|"unlink"|"release";state:string;created_at:string;reviewed_at:string|null;creator_id:string;creator_name:string;reviewer_id:string|null;target_id:string|null;source_id?:string|null;protected:number;creator_role?:StaffRole|null;reviewer_role?:StaffRole|null};
/** A published guide, for the overview feed. */
export type PublishedGuide = {id:string;title:string;image:string|null;published_at:string;publisher_id:string|null;publisher_role?:StaffRole|null};
/** Everyone the portal names, as the site shows them; filled from the dashboard. */
export const StaffPeople = createContext<StaffPerson[]>([]);
/** A person's site name (scimitar, rank colour), falling back to the stored name. `rankThen` colours it by the rank they held when the row happened. */
export function Person({id, fallback, role, rankThen}: {id: string | null | undefined; fallback: string; role?: StaffRole | null; rankThen?: StaffRole | null}) {
  const people = useContext(StaffPeople);
  return <PersonName person={id ? people.find((p) => p.id === id) : undefined} fallback={fallback} role={role} rankThen={rankThen} />;
}
/** A Discord account by its Discord name (not its RuneScape name), with the Discord mark; `possessive` reads "Dry Guy's". */
export function DiscordName({id, possessive = false}: {id: string | null; possessive?: boolean}) {
  const person = useContext(StaffPeople).find((p) => p.id === id);
  const name = person?.name ?? "a new owner";
  return <span className="discord-name"><DiscordMark /><b>{possessive ? name + "\u2019s" : name}</b></span>;
}
/** The in-game character head the account menu shows beside each linked RuneScape name. */
export const RS_NAME_ICON = "/portraits/male-brown-default.svg";
/** A RuneScape name, marked with the character head so it never reads as a Discord account. */
export function RsName({name}: {name: string}) {return <span className="rs-name" title="RuneScape name"><img src={RS_NAME_ICON} alt="" /><b>{name}</b></span>;}
export const REVIEW_STATES: {state: ReviewState; label: string}[] = [
  {state: "pending", label: "Awaiting review"},
  {state: "approved", label: "Approved"},
  {state: "rejected", label: "Rejected"},
];
const stateLabel = (state: string) => REVIEW_STATES.find((s) => s.state === state)?.label ?? state;
/** A coloured orb and the state in the same colour (amber, green or red), shared by corrections, history, account requests and guides. No box. */
export function StateLabel({state, label}: {state: string; label?: string}) {
  return <span className={"state-label state-" + state}><i aria-hidden="true" />{label ?? stateLabel(state)}</span>;
}
export function timeAgo(iso: string) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (!Number.isFinite(s)) return "";
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {day: "numeric", month: "short", year: s > 86400 * 300 ? "numeric" : undefined});
}
const fullDate = (iso: string) => new Date(iso).toLocaleString();
type Payload = {label?:string;planning?:boolean;rate?:number;pace?:number|null;unit?:string;averageXp?:number|null;denominator?:number;username?:string;count?:number;pet?:string};
export const payloadOf = (c: Change): Payload => {try {return JSON.parse(c.payload);} catch {return {};}};
export const changeTitle = (c: Change) => payloadOf(c).label ?? c.target;

export function StaffOverview({changes, cases, guides = [], memberCount, viewer, onNavigate, onFilter}: {changes: Change[]; cases: OwnershipCase[]; guides?: PublishedGuide[]; memberCount: number | null; viewer: Viewer; onNavigate: (tab: StaffTabId, section?: CorrectionSection) => void; onFilter: (state: ReviewState) => void}) {
  const counts = Object.fromEntries(REVIEW_STATES.map(({state}) => [state, changes.filter((c) => c.state === state).length])) as Record<ReviewState, number>;
  const reviews = viewer.permissions.corrections;
  return <div className="staff-overview">
    <div className={"staff-stats" + (reviews ? "" : " is-solo")}>
      {reviews && REVIEW_STATES.map(({state, label}) => <button key={state} type="button" className={"staff-stat state-" + state} onClick={() => state === "pending" ? onNavigate("corrections", "queue") : onFilter(state)}>
        <small><i aria-hidden="true" />{label}</small><b>{counts[state]}</b><span>{state === "pending" ? "Open review queue" : `View ${label.toLowerCase()}`} →</span>
      </button>)}
      <div className="staff-stat staff-stat-role">
        <small>Your role</small><StaffBadge staff={{role: viewer.role, prefix: null}} />
        <span>{memberCount === null ? (Object.keys(STAFF_AREAS) as StaffArea[]).filter((k) => viewer.permissions[k]).map((k) => STAFF_AREAS[k]).join(" · ") || "Account requests" : `${memberCount} staff ${memberCount === 1 ? "member" : "members"}`}</span>
      </div>
    </div>
    {reviews && <ReviewActivity changes={changes} onHistory={() => onNavigate("corrections", "history")} onQueue={() => onNavigate("corrections", "queue")} />}
    <LatestActivity changes={reviews ? changes : []} cases={cases} guides={guides} onCorrections={() => onNavigate("corrections", "history")} onOwnership={() => onNavigate("ownership")} />
    <div className="staff-quick-cards">
      {viewer.permissions.guides && <button type="button" onClick={() => onNavigate("guides")}><img src="/icons/navigation/collection-log-icon.png" alt="" /><span><b>Guide workshop</b><small>Write guides, insert requirements and build equipment setups.</small></span><em>Open workshop →</em></button>}
      {viewer.permissions.planning && <button type="button" onClick={() => onNavigate("corrections", "paces")}><img src="/icons/navigation/combat-achievements-icon.png" alt="" /><span><b>Kill rates &amp; XP</b><small>Set the default pace and average XP plans start from.</small></span><em>Open corrections →</em></button>}
      <button type="button" onClick={() => onNavigate("ownership")}><img src="/items/983.png" alt="" /><span><b>Account ownership</b><small>Move, hold and release accounts, with evidence and a reviewer.</small></span><em>Open ownership →</em></button>
    </div>
  </div>;
}

/** Fourteen days of submissions coloured by outcome, then the latest decisions as plain rows. */
function ReviewActivity({changes, onHistory, onQueue}: {changes: Change[]; onHistory: () => void; onQueue: () => void}) {
  const days = Array.from({length: 14}, (_, i) => {
    const d = new Date();d.setDate(d.getDate() - (13 - i));const day = d.toISOString().slice(0, 10);
    const today = changes.filter((c) => c.created_at.slice(0, 10) === day);
    return {day, label: d.toLocaleDateString(undefined, {day: "numeric", month: "short"}), total: today.length, parts: REVIEW_STATES.map(({state}) => ({state, count: today.filter((c) => c.state === state).length}))};
  });
  const max = Math.max(1, ...days.map((d) => d.total));
  return <section className="staff-card staff-activity" aria-labelledby="staff-activity-title">
    <header><div><h3 id="staff-activity-title">Review activity</h3><p>Submissions over the last 14 days, by outcome.</p></div>
      <ul className="staff-legend" aria-label="Legend">{REVIEW_STATES.map(({state, label}) => <li key={state} className={"state-" + state}><i aria-hidden="true" />{label}</li>)}</ul></header>
    {days.some((d) => d.total > 0) ? <div className="staff-activity-chart" role="img" aria-label={days.filter((d) => d.total).map((d) => `${d.label}: ${d.parts.filter((p) => p.count).map((p) => `${p.count} ${stateLabel(p.state).toLowerCase()}`).join(", ")}`).join("; ")}>
      {days.map((d, i) => <div key={d.day} title={`${d.label}: ${d.total} ${d.total === 1 ? "submission" : "submissions"}`}>
        <span className="staff-activity-bar" style={{height: `${(d.total / max) * 100}%`}}>{d.parts.filter((p) => p.count).map((p) => <i key={p.state} className={"state-" + p.state} style={{flexGrow: p.count}} />)}</span>
        <small aria-hidden="true">{i % 2 === 1 || i === 13 ? d.label : ""}</small>
      </div>)}
    </div> : <div className="staff-activity-empty"><img src="/ui/quest-list-icon.png" alt="" /><div><b>No submissions in the last 14 days</b><p>New proposals and review decisions will appear here.</p></div></div>}
    <footer><button type="button" className="btn sm ghost" onClick={onQueue}>Review queue</button><button type="button" className="link" onClick={onHistory}>Full history →</button></footer>
  </section>;
}

const KIND_ICON = {rate: "/ui/collection-log-icon.png", planning: "/icons/navigation/combat-achievements-icon.png", record: "/icons/skills/firemaking.png"};
const CASE_ICON = {relink: <Link2 size={16} />, unlink: <Lock size={16} />, release: <LockOpen size={16} />};
/** Per hour, in words: "32 kills per hour", "95,000 XP per hour". */
const perHour = (n: number, unit?: string) => `${n.toLocaleString()} ${unit === "XP" ? "XP" : unit ?? "kills"} per hour`;
/** What a correction changes, as a short title: "Kraken tentacle drop rate: 1/400", "Vorkath kill rate: 32 kills per hour". */
function proposal(c: Change) {
  const p = payloadOf(c), parts = [...new Set(changeTitle(c).split(" · "))], item = parts.at(-1)!;
  const where = parts.slice(0, -1).filter((w) => w !== item);
  const place = where.length ? <span className="activity-where"> · {where.join(" · ")}</span> : null;
  if (p.planning) {
    const at = parts.slice(1).join(" · ") || parts[0];
    return <><b>{at}</b> {p.pace != null ? <>kill rate: <b className="activity-value">{perHour(p.pace, p.unit)}</b></> : null}{p.pace != null && p.rate ? ", " : null}{p.rate ? <>pet rate{p.pace == null ? ":" : ""} <b className="activity-value">1/{p.rate.toLocaleString()}</b></> : null}</>;
  }
  if (c.kind === "record") return <>Dry-streak record: <b>{p.username}</b>, <b className="activity-value">{p.count?.toLocaleString()} {p.unit}</b> without <b>{item}</b></>;
  return <><b>{item}</b> drop rate: <b className="activity-value">1/{p.denominator?.toLocaleString()}</b>{place}</>;
}
const isHold = (id: string | null | undefined) => !!id?.startsWith("moderation-hold:");
/** An ownership request as a short title: "Move Lucky Lad to Dry Guy's Discord account", "Hold Dry Streaker". */
function caseTitle(c: OwnershipCase) {
  const rsn = <RsName name={c.rsn} />;
  if (c.action === "unlink") return <>Hold on {rsn}</>;
  if (c.action === "release") return <>Release the hold on {rsn}</>;
  return <>{isHold(c.source_id) ? "Link" : "Move"} {rsn} to <DiscordName id={c.target_id} possessive /> Discord account</>;
}
/** Who asked and who decided: "Requested by Tansy Iron · Approved by Mira Vale", or "Held by Bramble Pk" when a hold took effect at once. */
function byLine(first: string, who: React.ReactNode, c: {reviewed_at?: string | null; state: string}, reviewer: React.ReactNode) {
  const asked = <span className="ws-by-part">{first} by {who}</span>;
  if (!c.reviewed_at) return asked;
  return <>{asked}<span className="ws-by-sep" aria-hidden="true">·</span><span className="ws-by-part">{c.state === "approved" ? "Approved" : "Rejected"} by {reviewer}</span></>;
}
function caseBy(c: OwnershipCase) {
  const creator = <Person id={c.creator_id} fallback={c.creator_name} rankThen={c.creator_role} />;
  if (c.action === "unlink" && c.reviewed_at && c.state === "approved" && c.reviewer_id === c.creator_id) return <>Held by {creator}</>;
  return byLine("Requested", creator, c, <Person id={c.reviewer_id} fallback="a reviewer" rankThen={c.reviewer_role} />);
}
/** Everything staff proposed, decided or published lately, newest first: what changed on the first line, who on the second. */
function LatestActivity({changes, cases, guides, onCorrections, onOwnership}: {changes: Change[]; cases: OwnershipCase[]; guides: PublishedGuide[]; onCorrections: () => void; onOwnership: () => void}) {
  type Row = {key: string; when: string; state: string; label?: string; icon: React.ReactNode; title: React.ReactNode; by: React.ReactNode; open?: () => void; href?: string};
  const rows: Row[] = [
    ...changes.map((c): Row => ({key: "c" + c.id, when: c.reviewed_at ?? c.created_at, state: c.state, open: onCorrections, icon: <img src={c.image ?? KIND_ICON[correctionKind(c)]} alt="" />,
      title: proposal(c), by: byLine("Proposed", <Person id={c.actor_id} fallback={c.actor_name} rankThen={c.actor_role} />, c, <Person id={c.reviewer_id} fallback={c.reviewer_name ?? "a reviewer"} rankThen={c.reviewer_role} />)})),
    ...cases.map((c): Row => ({key: "o" + c.id, when: c.reviewed_at ?? c.created_at, state: c.state, open: onOwnership, icon: <span className={"case-icon is-" + c.action}>{CASE_ICON[c.action]}</span>, title: caseTitle(c), by: caseBy(c)})),
    ...guides.map((g): Row => ({key: "g" + g.id, when: g.published_at, state: "approved", label: "Published", href: "/guides?guide=" + encodeURIComponent(g.id), icon: <img src={g.image ?? "/icons/navigation/collection-log-icon.png"} alt="" />,
      title: <>Guide: <b>{g.title}</b></>, by: <>Published by <Person id={g.publisher_id} fallback="a staff member" rankThen={g.publisher_role} /></>})),
  ].sort((a, b) => b.when.localeCompare(a.when)).slice(0, 8);
  // The same rows as Access history: icon, what changed, who, then the state and time. A published guide opens the guide.
  const body = (r: Row) => <>
    <span className="ws-row-icon" aria-hidden="true">{r.icon}</span>
    <span className="ws-row-main"><span className="ws-feed-title">{r.title}</span><span className="ws-feed-by">{r.by}</span></span>
    <span className="ws-row-side"><StateLabel state={r.state} label={r.label} /><time dateTime={r.when} title={fullDate(r.when)}>{timeAgo(r.when)}</time></span>
  </>;
  return <section className="staff-card staff-feed" aria-label="Latest activity">
    <PanelHead icon="/ui/quest-list-icon.png" title="Latest activity" text="Corrections, ownership requests and published guides, newest first." />
    {rows.length ? <ol className="ws-list ws-feed">{rows.map((r) => <li key={r.key} className={"ws-row state-" + r.state}>
      {r.href ? <a className="ws-row-head" href={r.href}>{body(r)}</a> : <button type="button" className="ws-row-head" onClick={r.open}>{body(r)}</button>}
    </li>)}</ol> : <Empty icon="/ui/quest-list-icon.png" title="Nothing yet" text="Proposals, decisions, ownership requests and published guides will appear here." />}
  </section>;
}

/** What a submission changes: a drop rate, a default kill rate or a dry-streak record. */
export const correctionKind = (c: Change) => payloadOf(c).planning ? "planning" : c.kind === "record" ? "record" : "rate";
const KIND_LABEL = {planning: "Kill rate", record: "Record", rate: "Drop rate"};
/** The proposed value, large, with its unit. */
export function ProposedValue({change: c, compact = false}: {change: Change; compact?: boolean}) {
  const p = payloadOf(c);
  if (compact) return <b className="ws-value">{p.planning ? <>{p.pace != null && <>{p.pace.toLocaleString()} <span>{p.unit}/h</span></>}{p.pace != null && p.rate ? <span> · </span> : null}{p.rate ? <>1/{p.rate.toLocaleString()}</> : null}</> : c.kind === "record" ? <>{p.count?.toLocaleString()} <span>{p.unit} dry</span></> : <>1/{p.denominator?.toLocaleString()}</>}</b>;
  if (p.planning) return <div className="correction-value"><small>{p.pace != null ? "Proposed pace" : "Proposed pet rate"}</small><b>{p.pace != null ? <>{p.pace.toLocaleString()} <span>{p.unit}/hour</span></> : <>1/{p.rate?.toLocaleString()}</>}</b>{p.averageXp ? <small>~{p.averageXp.toLocaleString()} XP per pet</small> : null}</div>;
  if (c.kind === "record") return <div className="correction-value"><small>Proposed record</small><b>{p.count?.toLocaleString()} <span>{p.unit}</span></b><small>{p.username}</small></div>;
  return <div className="correction-value"><small>Proposed rate</small><b>1/{p.denominator?.toLocaleString()}</b></div>;
}

export function CorrectionCard({change: c, review = false, busy = false, onDecision}: {change: Change; review?: boolean; busy?: boolean; onDecision?: (d: "approved" | "rejected") => void}) {
  return <article className={"correction state-" + c.state}>
    <header><span className="activity-kind">{KIND_LABEL[correctionKind(c)]}</span><StateLabel state={c.state} /><time dateTime={c.created_at} title={fullDate(c.created_at)}>{timeAgo(c.created_at)}</time></header>
    <div className="correction-main"><h3>{changeTitle(c)}</h3><ProposedValue change={c} /></div>
    <p className="correction-reason">{c.reason}</p>
    <footer><span>Proposed by <Person id={c.actor_id} fallback={c.actor_name} role={c.actor_role}/></span>{c.reviewed_at && <span>{c.state === "approved" ? "Approved" : "Rejected"} by <Person id={c.reviewer_id} fallback={c.reviewer_name ?? "a reviewer"} role={c.reviewer_role}/> · {timeAgo(c.reviewed_at)}</span>}<a className="link" href={c.source} target="_blank" rel="noreferrer">Evidence <ExternalLink size={13} /></a></footer>
    {review && <div className="correction-actions"><button className="btn sm danger" disabled={busy} onClick={() => onDecision?.("rejected")}>Reject</button><button className="btn sm primary" disabled={busy} onClick={() => onDecision?.("approved")}>Approve &amp; publish</button></div>}
  </article>;
}
