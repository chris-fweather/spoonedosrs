"use client";
import {useEffect,useState} from 'react';
import {PanelHead} from './StaffReview';
import {DonationReceipt} from './DonationReceipt';
import {money} from './AccountDonations';
import './account-settings.css';
import './donations.css';

type Entry={id:string;amountMinor:number;currency:string;target:string|null;donor:string|null;label:string|null;kind:string;status:string;source:string;createdAt:number};
type Recorded={id:string;anonymousNumber:number|null;label:string|null;claimCode:string|null;target:string|null};
async function call(method:'GET'|'POST',body?:object){
 const r=await fetch('/api/staff/donations',{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 const b=(await r.json().catch(()=>({}))) as {donations?:Entry[];recorded?:Recorded;error?:string};
 if(!r.ok||!b.donations)throw Error(b.error||'Donations are unavailable. Please retry.');
 return b;
}
const day=(t:number)=>t?new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'Before Oct 2026';

/** Owner only: record a donation that arrived outside the site, choosing the profile it supports, and refund one.
 * An anonymous donation gets its public number and a claim code, shown once: give the donor the code, which alone claims it. */
export function StaffDonations(){
 const [list,setList]=useState<Entry[]|null>(null),[amount,setAmount]=useState(''),[currency,setCurrency]=useState('USD'),[target,setTarget]=useState('');
 const [donor,setDonor]=useState(''),[anonymous,setAnonymous]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[recorded,setRecorded]=useState<Recorded|null>(null);
 useEffect(()=>{call('GET').then(b=>setList(b.donations!)).catch(e=>setError((e as Error).message));},[]);
 async function record(){
  setBusy(true);setError('');setRecorded(null);
  try{
   const minor=Math.round(Number(amount)*100);
   const b=await call('POST',{action:'record',amountMinor:minor,currency,target:target.trim()||null,donor:anonymous?null:donor.trim(),anonymous});
   setList(b.donations!);setRecorded(b.recorded!);setAmount('');setTarget('');setDonor('');
  }catch(e){setError((e as Error).message);}
  setBusy(false);
 }
 async function refund(id:string){
  if(!window.confirm('Mark this donation refunded? It stops counting toward the profile it supports.'))return;
  setBusy(true);setError('');
  try{setList((await call('POST',{action:'refund',id})).donations!);}catch(e){setError((e as Error).message);}
  setBusy(false);
 }
 return <section className="community-panel staff-donations"><PanelHead icon="/icons/community/supporters-heart.png" title="Donations" badge={list?String(list.length):undefined} text="Record a donation and the profile it supports. Anonymous ones get a public number and a one-time claim code for the donor."/>
  <form className="staff-donation-form" onSubmit={e=>{e.preventDefault();void record();}}>
   <label><span>Amount</span><input inputMode="decimal" required value={amount} onChange={e=>setAmount(e.target.value)} placeholder="10.00"/></label>
   <label><span>Currency</span><select value={currency} onChange={e=>setCurrency(e.target.value)}>{['USD','EUR','GBP','AUD','CAD'].map(c=><option key={c}>{c}</option>)}</select></label>
   <label><span>Supports</span><input value={target} maxLength={12} onChange={e=>setTarget(e.target.value)} placeholder="RuneScape name, or empty"/></label>
   <label><span>Donor</span><input value={donor} maxLength={12} disabled={anonymous} onChange={e=>setDonor(e.target.value)} placeholder="Donor's linked name"/></label>
   <label className="account-choice"><input type="checkbox" checked={anonymous} onChange={e=>setAnonymous(e.target.checked)}/>Anonymous</label>
   <button type="submit" className="btn primary" disabled={busy||!amount}>Record</button>
  </form>
  {error&&<p role="alert" className="community-notice">{error}</p>}
  {recorded&&(recorded.claimCode&&recorded.label?<DonationReceipt label={recorded.label} claimCode={recorded.claimCode} target={recorded.target} staff/>:<p role="status" className="fine">Recorded{recorded.target?` for ${recorded.target}`:''}.</p>)}
  {list&&list.length>0&&<ul className="staff-donation-list">{list.map(d=><li key={d.id} className={d.status!=='completed'?'is-void':undefined}>
   <b>{d.kind==='grant'?'Grant':money(d.amountMinor,d.currency)}</b>
   <span>{d.target??'No profile'}</span>
   <span>{d.donor??d.label??'Unknown donor'}</span>
   <span>{day(d.createdAt)} · {d.status==='completed'?d.source:d.status}</span>
   {d.status==='completed'&&d.kind==='payment'?<button type="button" className="btn ghost sm" disabled={busy} onClick={()=>void refund(d.id)}>Refund</button>:<span/>}
  </li>)}</ul>}
 </section>;
}
