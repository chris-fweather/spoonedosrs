"use client";
import {useEffect, useState} from "react";

/** `verified`: this player's plugin proved the character; it stays theirs after unlinking until they release it. */
export type SeenCharacter = {name: string; lastSeen: number; status: "linked" | "can_add" | "claimed_elsewhere" | "review_pending"; verified: boolean};

const STATUS: Record<Exclude<SeenCharacter["status"], "linked">, string> = {
  can_add: "Not linked",
  claimed_elsewhere: "Linked to another account",
  review_pending: "Staff are reviewing",
};

/** Characters the RuneLite plugin has seen this player log in to, or null while loading. Empty when the plugin page is off. */
export function useSeenCharacters(enabled: boolean) {
  const [characters, setCharacters] = useState<SeenCharacter[] | null>(enabled ? null : []);
  useEffect(() => {
    if (!enabled) return;
    fetch("/api/plugin/characters").then(async r => (r.ok ? await r.json() : {characters: []}) as {characters: SeenCharacter[]}).then(b => setCharacters(b.characters)).catch(() => setCharacters([]));
  }, [enabled]);
  return [characters, setCharacters] as const;
}

/** One unlinked character from the plugin, shown in Profiles under "Seen by the RuneLite plugin". Nothing is linked until the player chooses Add.
 * A character this player verified before (unlinked since, or under a new name) offers Release, which lets anyone add it again. */
export function PluginCharacterRow({character, onLinked, onStatus}: {character: SeenCharacter; onLinked: (name: string) => void; onStatus: (name: string, status: SeenCharacter["status"], verified: boolean) => void}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  if (character.status === "linked") return null;
  async function act(action: "add" | "review" | "release") {
    if (action === "release" && !window.confirm(`Release ${character.name}? Another Discord account whose plugin sees it could then add it.`)) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/plugin/characters", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({name: character.name, action})});
      const b = (await r.json().catch(() => ({}))) as {status?: SeenCharacter["status"]; error?: string};
      if (!r.ok || !b.status) throw Error(b.error || "Please retry.");
      onStatus(character.name, b.status, action === "release" ? false : action === "add" || character.verified);
      if (b.status === "linked") onLinked(character.name);
    } catch (e) {setError((e as Error).message);}
    setBusy(false);
  }
  return <div className="community-panel account-seen-row">
    <img className="account-card-portrait" src="/icons/runelite/plugin-default.png" alt="" width={30} height={30} />
    <span className="account-card-name"><b>{character.name}</b><small>{character.status === "can_add" && character.verified ? "Verified by your plugin, not linked" : STATUS[character.status]}</small></span>
    {error && <span role="alert" className="account-save-notice is-error">{error}</span>}
    {character.status === "can_add" && <button type="button" className="btn primary sm" disabled={busy} onClick={() => void act("add")}>Add</button>}
    {character.status === "can_add" && character.verified && <button type="button" className="btn sm" disabled={busy} title="Let another Discord account add this character" onClick={() => void act("release")}>Release</button>}
    {character.status === "claimed_elsewhere" && <button type="button" className="btn sm" disabled={busy} onClick={() => void act("review")}>Request review</button>}
  </div>;
}
