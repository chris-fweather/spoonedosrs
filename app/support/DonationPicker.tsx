'use client';
import {useEffect,useState} from 'react';
import {validSupportName} from '@/lib/donation-rules';
import '../account-settings.css';
import '../donations.css';

const PRESETS=['5','10','25'] as const;
/** Who a donation supports, chosen before paying: one RuneScape name, or none. Any valid name works, tracked here yet
 * or not; signed-in donors get their linked names as suggestions. Logged-out donors are anonymous and get a claim
 * code afterwards (docs/supporters.md). */
export function DonationPicker(){
 const [names,setNames]=useState<string[]|null>(null),[name,setName]=useState('');
 const [amount,setAmount]=useState('10'),[custom,setCustom]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState<{text:string;error:boolean}|null>(null);
 useEffect(()=>{fetch('/api/account-settings').then(async r=>r.ok?((await r.json()) as {accounts:{name:string}[]}).accounts.map(a=>a.name):[]).then(setNames).catch(()=>setNames([]));},[]);
 const signedIn=!!names?.length;
 const value=Number(amount),trimmed=name.trim(),badName=trimmed!==''&&!validSupportName(trimmed);
 async function go(){
  setBusy(true);setMessage(null);
  try{
   const r=await fetch('/api/donations/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({target:trimmed||null,amountMinor:Math.round(value*100)})});
   const b=(await r.json().catch(()=>({}))) as {error?:string};
   setMessage({text:b.error??'Continue to payment.',error:r.status!==503});
  }catch{setMessage({text:'Please retry.',error:true});}
  setBusy(false);
 }
 return <section className="community-panel donation-picker" aria-labelledby="donation-picker-title"><h2 id="donation-picker-title">Who it supports</h2>
  <p className="donation-help">The name you enter gets the supporter coin. Leave it blank to support the site without a name.</p>
  <form className="donation-fields" onSubmit={e=>{e.preventDefault();if(!busy&&value>0&&!badName)void go();}}>
   <label className="donation-field"><span>RuneScape name</span>
    <input value={name} maxLength={12} onChange={e=>setName(e.target.value)} placeholder="RuneScape name (optional)" autoComplete="off" spellCheck={false}
     list={signedIn?'donation-names':undefined} aria-invalid={badName||undefined} aria-describedby={badName?'donation-name-error':undefined}/>
    {signedIn&&<datalist id="donation-names">{names!.map(n=><option key={n} value={n}/>)}</datalist>}
   </label>
   <div className="donation-field"><span id="donation-amount">Amount (USD)</span>
    <div className="donation-amounts" role="group" aria-labelledby="donation-amount">
     {PRESETS.map(p=><button key={p} type="button" aria-pressed={!custom&&amount===p} onClick={()=>{setCustom(false);setAmount(p);}}>${p}</button>)}
     {custom?<label className="donation-custom"><span aria-hidden="true">$</span><input aria-label="Custom amount in US dollars" inputMode="decimal" autoFocus value={amount} onChange={e=>setAmount(e.target.value.replace(/[^\d.]/g,''))}/></label>
      :<button type="button" aria-pressed={false} onClick={()=>{setCustom(true);setAmount('');}}>Other</button>}
    </div>
   </div>
   <button type="submit" className="btn primary donation-go" disabled={busy||!(value>0)||badName}>Continue to payment</button>
  </form>
  {badName&&<p id="donation-name-error" role="alert" className="account-save-notice is-error">Use up to 12 letters, numbers, spaces, hyphens or underscores.</p>}
  {!signedIn&&names&&<p className="fine">Not signed in: you get a claim code to add the donation to an account later.</p>}
  {message&&<p role={message.error?'alert':'status'} className={'account-save-notice'+(message.error?' is-error':' is-dirty')}>{message.text}</p>}
 </section>;
}
