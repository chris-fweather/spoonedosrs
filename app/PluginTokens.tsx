"use client";
import {useEffect, useState} from "react";
import {Check, Copy} from "lucide-react";

type Token = {id: string; label: string; createdAt: number; lastUsedAt: number | null; lastSyncAt: number | null; lastSyncName: string | null; pluginVersion: string | null};

function day(value: number) {
  return new Date(value).toLocaleDateString(undefined, {year: "numeric", month: "short", day: "numeric"});
}
/** "5 min ago", "3 h ago", "2 days ago", then a date. */
export function ago(value: number, now = Date.now()) {
  const s = Math.max(0, (now - value) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " h ago";
  if (s < 86400 * 14) return Math.round(s / 86400) + (Math.round(s / 86400) === 1 ? " day ago" : " days ago");
  return day(value);
}
async function call<T>(method: string, body?: unknown): Promise<T> {
  const r = await fetch("/api/plugin/tokens", {method, headers: body ? {"Content-Type": "application/json"} : undefined, body: body ? JSON.stringify(body) : undefined});
  const json = (await r.json().catch(() => ({}))) as T & {error?: string};
  if (!r.ok) throw Error(json.error || "Plugin tokens are unavailable. Please retry.");
  return json;
}

/** The RuneLite plugin's connections: one token per computer, named by the player. A new token is shown once; only its hash is kept. */
export function PluginTokens() {
  const [tokens, setTokens] = useState<Token[] | null>(null), [label, setLabel] = useState(""), [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [copied, setCopied] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    call<{tokens: Token[]}>("GET").then(b => setTokens(b.tokens)).catch(e => setError((e as Error).message));
  }, []);
  async function create() {
    setBusy(true); setError(""); setCopied(false);
    try {
      const made = await call<Token & {token: string}>("POST", {label});
      setTokens(t => [{...made}, ...(t ?? [])]);
      setFresh(made.token); setLabel("");
    } catch (e) {setError((e as Error).message);}
    setBusy(false);
  }
  async function remove(id: string) {
    setBusy(true); setError("");
    try {await call("DELETE", {id}); setTokens(t => (t ?? []).filter(x => x.id !== id));}
    catch (e) {setError((e as Error).message);}
    setBusy(false);
  }
  async function copy() {
    if (!fresh) return;
    try {await navigator.clipboard.writeText(fresh); setCopied(true);} catch {setError("Copy the token by selecting it.");}
  }
  const connected = tokens?.filter(t => t.lastUsedAt).length ?? 0;
  return <section className="community-panel account-card account-plugin" aria-labelledby="account-plugin-title">
    <div className="account-card-head">
      <h3 id="account-plugin-title">Devices</h3>
      {tokens && <span className={"account-plugin-state" + (connected ? " is-connected" : "")}><span className="account-visibility-dot" aria-hidden="true" />{connected ? `Connected on ${connected} ${connected === 1 ? "device" : "devices"}` : "Not connected"}</span>}
    </div>
    {error && <p role="alert" className="community-notice">{error}</p>}
    {fresh && <div className="plugin-token-fresh">
      <code aria-label="New plugin token">{fresh}</code>
      <button type="button" className="btn" onClick={() => void copy()}>{copied ? <><Check size={15}/> Copied</> : <><Copy size={15}/> Copy</>}</button>
      <small>Paste it into the plugin settings. Shown once.</small>
    </div>}
    {tokens && tokens.length > 0 && <ul className="plugin-token-list">
      {tokens.map(t => <li key={t.id}>
        <span className={"account-visibility-dot" + (t.lastUsedAt ? "" : " is-waiting")} aria-hidden="true" />
        <div>
          <span className="plugin-token-name"><b>{t.label}</b><em className={t.lastUsedAt ? "is-connected" : "is-waiting"}>{t.lastUsedAt ? "Connected" : "Waiting for plugin"}</em></span>
          <span className="plugin-token-meta">
            <span>Added {day(t.createdAt)}</span>
            {t.lastSyncAt ? <span>Synced {ago(t.lastSyncAt)}{t.lastSyncName ? ` · ${t.lastSyncName}` : ""}</span> : t.lastUsedAt ? <span>Seen {ago(t.lastUsedAt)}</span> : null}
            {t.pluginVersion && <span>v{t.pluginVersion}</span>}
          </span>
        </div>
        <button type="button" className="btn ghost sm" disabled={busy} onClick={() => void remove(t.id)}>Remove</button>
      </li>)}
    </ul>}
    <form className="plugin-token-create" onSubmit={e => {e.preventDefault(); void create();}}>
      <input aria-label="Device name" placeholder="Device name, e.g. Gaming PC" maxLength={40} value={label} onChange={e => setLabel(e.target.value)}/>
      <button type="submit" className="btn primary" disabled={busy || tokens === null}>Connect a device</button>
    </form>
  </section>;
}
