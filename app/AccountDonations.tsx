"use client";
import {useEffect, useState} from "react";
import {normalizeClaimCode} from "@/lib/donation-rules";
import "./donations.css";

/** A linked profile's supporter total and what visitors see of it (set per profile in Profiles). */
export type ProfileSupport = {name: string; amountMinor: number; currency: string; supported: boolean; showSupporter: boolean; showDonation: boolean};

export function money(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {style: "currency", currency, maximumFractionDigits: amountMinor % 100 ? 2 : 0}).format(amountMinor / 100);
}
/** Sums per currency: "$40", or "$40 + €5" when profiles hold different currencies. */
export function totalText(profiles: readonly Pick<ProfileSupport, "amountMinor" | "currency">[]) {
  const sums = new Map<string, number>();
  for (const p of profiles) if (p.amountMinor > 0) sums.set(p.currency, (sums.get(p.currency) ?? 0) + p.amountMinor);
  return sums.size ? [...sums].sort((a, b) => b[1] - a[1]).map(([c, n]) => money(n, c)).join(" + ") : money(0, "USD");
}
function shown(p: ProfileSupport) {
  return !p.showSupporter ? "Hidden" : !p.showDonation ? "Amount hidden" : "Shown";
}

/**
 * Supporter section. Every donation supports the profile it was given to, and stays there. The total is the sum of the
 * donations to every name linked to this Discord account, whoever gave them. What each profile shows is set in Profiles.
 * Anonymous donations are claimed with their one-time claim code alone (the code is tied to one donation). ?claim opens
 * this section; ?claim=<code> also fills in the code when it is one, and anything else (such as an old number link) is ignored.
 */
export function AccountDonations({profiles, onOpenProfile, onClaimed}: {profiles: ProfileSupport[]; onOpenProfile: (name: string) => void; onClaimed: () => void}) {
  const [code, setCode] = useState(""), [to, setTo] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState<{text: string; error: boolean} | null>(null);
  useEffect(() => {
    const claim = new URLSearchParams(window.location.search).get("claim");
    if (claim && normalizeClaimCode(claim)) setCode(claim.trim().toUpperCase());
  }, []);
  const names = profiles.map(p => p.name);
  const target = names.includes(to) ? to : names[0] ?? "";
  async function claim() {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/account-settings/donations", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "claim", code, to: target || null})});
      const b = (await r.json().catch(() => ({}))) as {label?: string; supports?: string | null; error?: string};
      if (!r.ok || !b.label) throw Error(b.error || "Please retry.");
      setCode("");
      setNotice({text: `${b.label} is now yours${b.supports ? ` and supports ${b.supports}` : ""}.`, error: false});
      onClaimed();
    } catch (e) {setNotice({text: (e as Error).message, error: true});}
    setBusy(false);
  }
  const supported = profiles.filter(p => p.supported);
  return <>
    <section className="community-panel account-card account-support-total" aria-labelledby="account-support-total">
      <div className="account-card-head">
        <h3 id="account-support-total">Your total</h3>
        {supported.length > 0 && <span className="account-support-sum"><b>{totalText(supported)}</b><small>across {supported.length} {supported.length === 1 ? "profile" : "profiles"}</small></span>}
      </div>
      {supported.length > 0 ? <ul className="account-support-list">
        {supported.map(p => <li key={p.name}>
          <b className="account-support-name">{p.name}</b>
          <span className="account-support-amount">{p.amountMinor > 0 ? money(p.amountMinor, p.currency) : "Supporter"}</span>
          <span className={"account-support-shown" + (shown(p) === "Shown" ? " is-shown" : "")}>{shown(p)}</span>
          <button type="button" className="btn ghost sm" onClick={() => onOpenProfile(p.name)}>Change</button>
        </li>)}
      </ul> : <div className="account-support-empty"><img src="/icons/community/sponsor-coin.png" alt="" width={28} height={28}/><span><b>No donations yet</b><small>Donations to your linked profiles add up here.</small></span><a className="btn" href="/support">Support the site</a></div>}
    </section>
    <section className="community-panel account-card" aria-labelledby="account-claim-title">
      <div className="account-setting-copy">
        <h3 id="account-claim-title">Claim a donation</h3>
        <p>Donated anonymously? Enter the claim code from your receipt to add the donation to one of your profiles.</p>
      </div>
      <form className="account-donation-claim" onSubmit={e => {e.preventDefault(); void claim();}}>
        <label className="account-claim-field is-code"><span>Claim code</span>
          <input placeholder="CLM-XXXX-XXXX-XXXX-XXXX" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={40} value={code} onChange={e => setCode(e.target.value)} />
        </label>
        {names.length > 0 && <label className="account-claim-field is-target"><span>Add to</span>
          <select value={target} disabled={busy} onChange={e => setTo(e.target.value)}>{names.map(n => <option key={n} value={n}>{n}</option>)}</select>
        </label>}
        <button type="submit" className="btn primary" disabled={busy || !code.trim()}>Claim</button>
      </form>
      {notice && <p role={notice.error ? "alert" : "status"} className={"account-setting-status" + (notice.error ? " is-error" : " is-done")}>{notice.text}</p>}
    </section>
  </>;
}
