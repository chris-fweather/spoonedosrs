"use client";
import {useEffect,useState} from 'react';
import {AccountSettingRow} from './AccountSettingRow';
/** Guide writers and current or former staff choose whether the Credits page lists them. Hidden for everyone else. */
export function CreditsListing(){
 const [listed,setListed]=useState<boolean|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{const c=new AbortController();fetch('/api/account-settings/credits',{signal:c.signal}).then(r=>r.ok?r.json() as Promise<{eligible?:boolean;listed?:boolean}>:null).then(b=>{if(b?.eligible)setListed(b.listed!==false);}).catch(()=>{});return()=>c.abort();},[]);
 async function change(next:boolean){
  setBusy(true);setMessage('');setListed(next);
  try{const r=await fetch('/api/account-settings/credits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({listed:next})});const b=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw Error(b.error||'Could not save.');}
  catch(e){setListed(!next);setMessage((e as Error).message);}
  finally{setBusy(false);}
 }
 if(listed===null)return null;
 return <AccountSettingRow title="Show me on Credits" description={<>Guide writers and staff are thanked on the <a className="link" href="/credits#people">Credits page</a>.</>}
  status={message&&<p role="alert" className="account-setting-status is-error">{message}</p>}>
  <label className="account-choice"><input type="checkbox" checked={listed} disabled={busy} onChange={e=>void change(e.target.checked)}/>Listed</label>
 </AccountSettingRow>;
}
