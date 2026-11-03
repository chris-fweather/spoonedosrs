"use client";
import {useState} from "react";
import {Check, Copy} from "lucide-react";
import "./donations.css";

/** The once-only confirmation of an anonymous donation: its public number (a label) and the private claim code, which
 * alone claims it. Staff see it after recording an anonymous donation, to give the code to the donor. */
export function DonationReceipt({label, claimCode, target, staff = false}: {label: string; claimCode: string; target: string | null; staff?: boolean}) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {await navigator.clipboard.writeText(claimCode); setCopied(true);} catch {/* The code stays selectable. */}
  }
  return <div className="donation-receipt" role="status">
    <div className="donation-receipt-head"><img src="/icons/community/supporters-heart.png" alt="" width={24} height={24} /><b>{label}</b><span>{target ? `Supports ${target}` : "Supports the site"}</span></div>
    <div className="donation-receipt-code"><code aria-label="Claim code">{claimCode}</code>
      <button type="button" className="btn sm" onClick={() => void copy()}>{copied ? <><Check size={14} />Copied</> : <><Copy size={14} />Copy</>}</button></div>
    <small>{staff ? "Give the donor this code. Shown once; the code alone claims the donation in Account settings → Supporter." : "Shown once. Keep it to claim this donation in Account settings → Supporter."}</small>
  </div>;
}
