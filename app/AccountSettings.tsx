"use client";
import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown, ExternalLink, RefreshCw, Unlink } from "lucide-react";
import {DiscordSyncPreferences} from './DiscordSyncPreferences';
import {CreditsListing} from './CreditsListing';
import {DiscordAvatar} from './DiscordAvatar';
import {siteSession} from './site-session';
import {PluginTokens} from './PluginTokens';
import {PluginCharacterRow, useSeenCharacters} from './PluginCharacters';
import {AccountDonations, money} from './AccountDonations';
import {PLUGIN_FEATURES} from '@/lib/plugin-page';
import {ACCOUNT_SECTIONS as SECTIONS, accountSectionFrom, type AccountSection} from '@/lib/account-sections';
import {AccountNotices} from './AccountNotices';
import {VerifiedBadge} from './VerifiedBadge';
import {AccountSettingRow} from './AccountSettingRow';
import { PublicHeader } from "./Community";
import { DEFAULT_DETAILS, DETAIL_LABELS, type ProfileDetails } from "@/lib/profile-privacy";
import "./account-settings.css";
type Account = {
  name: string;
  claimedAt: number;
  linkedAt: number | null;
  visibility: "public" | "private";
  details: ProfileDetails;
  showDonation: boolean;
  /** Supporter status on this profile is shown to visitors (the recipient can hide a gift). */
  showSupporter: boolean;
  /** The profile has a donation or supporter grant. */
  supported: boolean;
  /** This profile's supporter total (donations to it, whoever gave them). */
  amountMinor: number;
  currency: string;
  portrait?: string;
  /** Linked and proven through the RuneLite plugin by this Discord account (always false while the plugin page is off). */
  verified?: boolean;
};
const DEFAULT_PORTRAIT = "/portraits/male-brown-default.svg";
function date(value: number | null) {
  return value
    ? new Date(value < 1e12 ? value * 1000 : value).toLocaleDateString(
        undefined,
        { year: "numeric", month: "short", day: "numeric" },
      )
    : "Not recorded";
}
function SectionTabs({active, onSelect}: {active: AccountSection; onSelect: (id: AccountSection) => void}) {
  const tabs = SECTIONS.filter((s) => s.id !== "runelite" || PLUGIN_FEATURES);
  function keys(e: KeyboardEvent) {
    const index = tabs.findIndex((t) => t.id === active), next = e.key === "ArrowRight" ? index + 1 : e.key === "ArrowLeft" ? index - 1 : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    const tab = tabs[(next + tabs.length) % tabs.length];
    onSelect(tab.id);
    document.getElementById("account-tab-" + tab.id)?.focus();
  }
  return <div className="account-tabs" role="tablist" aria-label="Account settings sections" onKeyDown={keys}>
    {tabs.map((t) => <button key={t.id} id={"account-tab-" + t.id} type="button" role="tab" aria-selected={active === t.id} aria-controls={"account-panel-" + t.id} tabIndex={active === t.id ? 0 : -1} onClick={() => onSelect(t.id)}><img src={t.icon} alt="" /><span>{t.label}</span></button>)}
  </div>;
}
export function AccountSettings() {
  const [data, setData] = useState<{
      user: { name: string; username: string; avatarUrl?: string };
      accounts: Account[];
    } | null>(null),
    [error, setError] = useState("");
  // Server render opens Account; the address picks the section once the page loads.
  const [section, setSection] = useState<AccountSection>("account");
  useEffect(() => setSection(accountSectionFrom(window.location.search, window.location.hash)), []);
  function select(next: AccountSection) {
    setSection(next);
    const url = new URL(window.location.href);
    url.hash = "";
    if (next === "account") url.searchParams.delete("tab"); else url.searchParams.set("tab", next);
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }
  // The plugin is not released yet: its characters and connection section show only where the plugin page does (dev).
  const [seen, setSeen] = useSeenCharacters(PLUGIN_FEATURES);
  const linked = new Set(data?.accounts.map((a) => a.name.toLowerCase()));
  const unlinked = (seen ?? []).filter((c) => c.status !== "linked" && !linked.has(c.name.toLowerCase()));
  const pluginSynced = new Set((seen ?? []).filter((c) => c.status === "linked").map((c) => c.name.toLowerCase()));
  function addLinked(name: string) {
    // A character added from the plugin becomes a linked profile with default privacy.
    setData((d) => d && !d.accounts.some((a) => a.name.toLowerCase() === name.toLowerCase()) ? {...d, accounts: [...d.accounts, {name, claimedAt: Date.now(), linkedAt: Date.now(), visibility: "public", details: DEFAULT_DETAILS, showDonation: true, showSupporter: true, supported: false, amountMinor: 0, currency: "USD"}]} : d);
  }
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/account-settings", { signal: controller.signal })
      .then(async (r) => {
        const b = (await r.json()) as {
          user: { name: string; username: string; avatarUrl?: string };
          accounts: Account[];
          error?: string;
        };
        if (!r.ok) throw Error(b.error);
        setData(b);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [reload]);
  /** A saved privacy change updates the page's copy, so Supporter shows what each profile now displays. */
  function saved(name: string, privacy: Privacy) {
    setData((d) => d && {...d, accounts: d.accounts.map((a) => a.name === name ? {...a, ...privacy} : a)});
  }
  /** An unlinked name leaves the list; its progress stays reserved to this Discord account. */
  function removeProfile(name: string) {
    setData((d) => d && {...d, accounts: d.accounts.filter((a) => a.name !== name)});
  }
  /** Opens one profile's privacy card in Profiles, at its Supporter controls. */
  function openProfile(name: string) {
    select("profiles");
    requestAnimationFrame(() => {
      const card = document.getElementById("account-profile-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-")) as HTMLDetailsElement | null;
      if (!card) return;
      card.open = true;
      (card.querySelector(".account-support-controls") ?? card).scrollIntoView({block: "center", behavior: "smooth"});
    });
  }
  const panel = (id: AccountSection, body: ReactNode) => {
    const meta = SECTIONS.find((s) => s.id === id)!;
    // Every section stays mounted so unsaved privacy changes and open forms survive switching tabs.
    return <section key={id} id={"account-panel-" + id} className="account-window-body" role="tabpanel" aria-labelledby={"account-tab-" + id} hidden={section !== id}>
      <header className="account-area-heading"><h2>{meta.title}</h2><p>{meta.description}</p></header>
      {body}
    </section>;
  };
  const count = data?.accounts.length ?? 0;
  return (
    <div className="site">
      <PublicHeader onError={setError} />
      <main className="community-page account-settings-page">
        <div>
          <span className="kicker">Your Spooned account</span>
          <h1>
            <img className="account-title-icon" src="/icons/community/settings-icon.png" alt="" width={23} height={23} /> Account settings
          </h1>
        </div>
        {error && (
          <p role="alert" className="community-notice">
            {error}
          </p>
        )}
        {!data && !error && <p role="status">Loading your accounts…</p>}
        {data && (
          <>
            <AccountNotices />
            <div className="account-window">
              <SectionTabs active={section} onSelect={select} />
              {panel("account", <>
                <div className="community-panel account-group">
                  <div className="account-summary">
                    <DiscordAvatar src={data.user.avatarUrl} name={data.user.name} className="account-summary-avatar" />
                    <div>
                      <b>{data.user.name}</b>
                      <span>Discord · {data.user.username}</span>
                    </div>
                    <div className="account-setting-control"><button type="button" className="btn" onClick={() => select("profiles")}>{count} linked {count === 1 ? "profile" : "profiles"}</button></div>
                  </div>
                  <DiscordSyncPreferences />
                  <CreditsListing />
                  <SignOutEverywhere />
                </div>
              </>)}
              {panel("profiles", <>
                <div className="account-settings-list">
                  {data.accounts.map((a, i) => (
                    <AccountPrivacy key={a.name} initial={a} support={a} open={i === 0} plugin={pluginSynced.has(a.name.toLowerCase())} onSaved={saved} onUnlinked={removeProfile} />
                  ))}
                  {!data.accounts.length && (
                    <p className="community-panel account-empty">No linked profiles yet. Use the account menu above to link your RuneScape name.</p>
                  )}
                </div>
                {unlinked.length > 0 && <div className="account-subgroup">
                  <h3 className="account-subgroup-title">Seen by the RuneLite plugin</h3>
                  <div className="account-settings-list">
                    {unlinked.map((c) => (
                      <PluginCharacterRow key={c.name} character={c} onLinked={addLinked} onStatus={(name, status, verified) => setSeen((list) => (list ?? []).map((x) => x.name === name ? {...x, status, verified} : x))} />
                    ))}
                  </div>
                </div>}
              </>)}
              {panel("supporter", <>
                <AccountDonations profiles={data.accounts} onOpenProfile={openProfile} onClaimed={() => setReload((n) => n + 1)} />
              </>)}
              {PLUGIN_FEATURES && panel("runelite", <PluginTokens />)}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
/** Log out everywhere: ends every signed-in session for this Discord account, on all devices including this one. */
function SignOutEverywhere() {
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function run() {
    setBusy(true);setError("");
    try {
      const r = await fetch("/api/auth/logout-everywhere", {method: "POST"});
      if (!r.ok) throw Error(((await r.json().catch(() => ({}))) as {error?: string}).error || "Could not log out everywhere.");
      siteSession.clear();
      window.location.assign("/");
    } catch (e) {setError((e as Error).message);setBusy(false);}
  }
  return <AccountSettingRow title="Log out everywhere" description="Ends every session on every device, this one included."
    status={error && <p role="alert" className="account-setting-status is-error">{error}</p>}>
    {confirming ? <><button type="button" className="btn ghost" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button><button type="button" className="btn danger" disabled={busy} onClick={() => void run()}>Log out on every device</button></>
      : <button type="button" className="btn danger" onClick={() => setConfirming(true)}>Log out everywhere</button>}
  </AccountSettingRow>;
}
type Privacy = Pick<Account, "visibility" | "details" | "showDonation" | "showSupporter">;
function samePrivacy(a: Privacy, b: Privacy) {
  return a.visibility === b.visibility && a.showDonation === b.showDonation && a.showSupporter === b.showSupporter && (Object.keys(DETAIL_LABELS) as (keyof ProfileDetails)[]).every((key) => a.details[key] === b.details[key]);
}
function AccountPrivacy({ initial, support, open, plugin, onSaved, onUnlinked }: { initial: Account; support: Pick<Account, "supported" | "amountMinor" | "currency">; open: boolean; plugin: boolean; onSaved: (name: string, privacy: Privacy) => void; onUnlinked: (name: string) => void }) {
  const [account, setAccount] = useState(initial),
    [saved, setSaved] = useState<Privacy>(initial),
    [justSaved, setJustSaved] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [failed, setFailed] = useState(false),
    [confirmUnlink, setConfirmUnlink] = useState(false);
  const shareId = useId(), supportId = useId();
  const dirty = !samePrivacy(account, saved);
  async function save() {
    const sent: Privacy = { visibility: account.visibility, details: account.details, showDonation: account.showDonation, showSupporter: account.showSupporter };
    setBusy(true);
    setNotice("");
    setFailed(false);
    try {
      const r = await fetch("/api/account-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: account.name,
          visibility: account.visibility,
          details: account.details,
          showDonation: account.showDonation,
          showSupporter: account.showSupporter,
        }),
      });
      const b = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(b.error);
      setSaved(sent);
      onSaved(account.name, sent);
      setJustSaved(true);
      setNotice("Privacy saved for " + account.name + ".");
    } catch (e) {
      setFailed(true);
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function unlink() {
    setBusy(true);
    setNotice("");
    setFailed(false);
    try {
      const r = await fetch("/api/accounts", {method: "DELETE", headers: {"Content-Type": "application/json"}, body: JSON.stringify({username: account.name})});
      const b = (await r.json().catch(() => ({}))) as {error?: string};
      if (!r.ok) throw Error(b.error || "Could not unlink that name.");
      onUnlinked(account.name);
    } catch (e) {
      setFailed(true);
      setNotice((e as Error).message);
      setConfirmUnlink(false);
      setBusy(false);
    }
  }
  const update = (change: Partial<Privacy>) => {
    setAccount((a) => ({ ...a, ...change }));
    setJustSaved(false);
    setNotice("");
  };
  const isPrivate = account.visibility === "private";
  return (
    <details id={"account-profile-" + account.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")} className="community-panel account-privacy-card" open={open}>
      <summary>
        <img className="account-card-portrait" src={account.portrait ?? DEFAULT_PORTRAIT} alt="" width={30} height={35} />
        <span className="account-card-name">
          <b>{account.name}{PLUGIN_FEATURES && account.verified && <VerifiedBadge size={14}/>}</b>
          <small>
            <span className={"account-visibility-dot" + (saved.visibility === "private" ? " is-private" : "")} aria-hidden="true" />
            {saved.visibility === "public"
              ? "Public profile"
              : "Private collection"}
            {support.supported && saved.showSupporter && <> · Supporter</>}
            {plugin && <> · RuneLite</>}
          </small>
        </span>
        <span className="account-disclosure"><span>Privacy &amp; details</span><ChevronDown size={16} aria-hidden="true" /></span>
      </summary>
      <fieldset className="account-privacy-body" disabled={busy}>
        <legend className="sr-only">Privacy for {account.name}</legend>
        <div className="account-privacy-top">
          <div className="account-visibility" role="radiogroup" aria-label={`Profile visibility for ${account.name}`}>
            <span className="account-field-label" aria-hidden="true">Visibility</span>
            {(["public", "private"] as const).map((value) => (
              <label key={value} className="account-choice">
                <input
                  type="radio"
                  name={"visibility-" + account.name}
                  value={value}
                  checked={account.visibility === value}
                  onChange={() => update({ visibility: value })}
                />
                {value === "public" ? "Public" : "Private"}
              </label>
            ))}
          </div>
          <div className="account-details">
            <span>
              First linked <b>{date(account.linkedAt)}</b>
            </span>
            <span>
              Current link <b>{date(account.claimedAt)}</b>
            </span>
            <a
              className="btn ghost sm"
              href={
                "/player/" +
                encodeURIComponent(account.name) +
                "?settings=profile"
              }
            >
              Profile settings <ExternalLink size={13} />
            </a>
            <button type="button" className="btn ghost sm" aria-expanded={confirmUnlink} onClick={() => setConfirmUnlink(true)}>
              <Unlink size={13} aria-hidden="true" /> Unlink
            </button>
          </div>
        </div>
        {confirmUnlink && <div className="account-unlink-confirm" role="group" aria-label={`Confirm unlinking ${account.name}`}>
          <span><b>Unlink {account.name}?</b> Its progress and privacy stay reserved to your Discord account, so you can relink it later.</span>
          <button type="button" className="btn ghost sm" onClick={() => setConfirmUnlink(false)}>Cancel</button>
          <button type="button" className="btn danger sm" onClick={() => void unlink()}><Unlink size={13} aria-hidden="true" /> Unlink</button>
        </div>}
        <div className="account-share">
          <span className="account-field-label" id={shareId}>Shown on your profile</span>
          <div className="account-privacy-toggles" role="group" aria-labelledby={shareId}>
            {(Object.entries(DETAIL_LABELS) as [keyof ProfileDetails, string][]).map(([key, label]) => (
              <label key={key} className="account-choice">
                <input
                  type="checkbox"
                  checked={isPrivate && key !== "skills" ? false : account.details[key]}
                  disabled={isPrivate && key !== "skills"}
                  onChange={(e) => update({ details: { ...account.details, [key]: e.target.checked } })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        {support.supported && (
          <div className="account-share account-support-controls">
            <span className="account-field-label" id={supportId}>Supporter · {support.amountMinor > 0 ? money(support.amountMinor, support.currency) + " to this profile" : "granted"}</span>
            <div className="account-privacy-toggles" role="group" aria-labelledby={supportId}>
              <label className="account-choice">
                <input type="checkbox" checked={account.showSupporter} onChange={(e) => update({ showSupporter: e.target.checked })} />
                Show supporter status
              </label>
              {support.amountMinor > 0 && <label className="account-choice">
                <input type="checkbox" checked={account.showSupporter && account.showDonation} disabled={!account.showSupporter} onChange={(e) => update({ showDonation: e.target.checked })} />
                Show donation amount
              </label>}
            </div>
          </div>
        )}
        <div className="account-privacy-footer">
          <p className="fine">
            Private collections keep your character visible. Skills remain
            visible only if enabled. Notes and personal planning stay private.
          </p>
          <span className={"account-save-notice" + (failed ? " is-error" : dirty ? " is-dirty" : "")} role="status">
            {notice || (dirty ? "Unsaved changes" : "")}
          </span>
          <button type="button" className={"btn primary save-button" + (justSaved && !dirty ? " is-saved" : "")} onClick={() => void save()}>
            {busy ? <RefreshCw size={15} className="spin" aria-hidden="true" /> : justSaved && !dirty ? <Check size={15} aria-hidden="true" /> : null}
            {busy ? "Saving…" : justSaved && !dirty ? "Saved" : "Save privacy"}
          </button>
        </div>
      </fieldset>
    </details>
  );
}
