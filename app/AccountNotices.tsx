"use client";
import {useEffect, useState} from "react";
import {X} from "lucide-react";

type Notice = {id: string; kind: "link_review_requested" | "link_review_opened" | "link_review_approved" | "link_review_rejected"; name: string; createdAt: number};

function text(n: Notice) {
  switch (n.kind) {
    case "link_review_requested": return `Someone who logs in to ${n.name} in game asked staff to review your link. You keep it while staff review.`;
    case "link_review_opened": return `Staff are reviewing your request for ${n.name}.`;
    case "link_review_approved": return `Staff approved the review of ${n.name}. It now belongs to the player who logs in to it.`;
    case "link_review_rejected": return `Staff reviewed ${n.name} and kept it with its current owner.`;
  }
}

/** Unread notices about this account's profiles. Shows nothing when there are none. */
export function AccountNotices() {
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    fetch("/api/notifications").then(async r => (r.ok ? await r.json() : {notifications: []}) as {notifications: Notice[]}).then(b => setNotices(b.notifications)).catch(() => {});
  }, []);
  async function dismiss(id: string) {
    setNotices(list => list.filter(n => n.id !== id));
    await fetch("/api/notifications", {method: "DELETE", headers: {"Content-Type": "application/json"}, body: JSON.stringify({id})}).catch(() => {});
  }
  if (!notices.length) return null;
  return <section className="community-panel account-notices" aria-label="Notifications">
    <h2>Notifications</h2>
    <ul>
      {notices.map(n => <li key={n.id}>
        <span>{text(n)}</span>
        <button type="button" className="btn ghost" aria-label="Dismiss" onClick={() => void dismiss(n.id)}><X size={15}/></button>
      </li>)}
    </ul>
  </section>;
}
