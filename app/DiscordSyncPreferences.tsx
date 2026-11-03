"use client";
import {useEffect,useState} from 'react';
import {Check,RefreshCw} from 'lucide-react';
import {AccountSettingRow} from './AccountSettingRow';
/** Records the member's consent for the role bridge, which polls and applies website staff and supporter roles in the Discord server. Nicknames are never changed. */
export function DiscordSyncPreferences(){
 const [configured,setConfigured]=useState<boolean|null>(null),[message,setMessage]=useState(''),[state,setState]=useState<'idle'|'busy'|'done'|'error'>('idle');
 useEffect(()=>{const c=new AbortController();fetch('/api/account-discord',{signal:c.signal}).then(async r=>{if(!r.ok)throw Error('Discord role syncing is unavailable right now.');setConfigured(((await r.json()) as {configured?:boolean}).configured===true);}).catch(e=>{if(!c.signal.aborted){setState('error');setMessage(e.message);}});return()=>c.abort();},[]);
 async function sync(){setState('busy');setMessage('');try{const r=await fetch('/api/account-discord',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname:null,supporterRole:true})});const b=await r.json().catch(()=>({})) as {error?:string};if(!r.ok)throw Error(b.error||'Could not sync your Discord roles. Try again.');setState('done');setMessage(configured===false?'Saved. Role syncing turns on once the server bot is running.':'Done. Your roles will update in the server within a few minutes.');}catch(e){setState('error');setMessage((e as Error).message);}}
 return <AccountSettingRow title="Discord server roles" description="Your staff and supporter roles, applied in the SpoonedOSRS server."
  status={<p className={'account-setting-status'+(state==='error'?' is-error':state==='done'?' is-done':'')} role="status">{message}</p>}>
  <button type="button" className="btn" disabled={state==='busy'||configured===null&&state!=='error'} onClick={()=>void sync()}>{state==='busy'?<RefreshCw size={15} className="spin" aria-hidden="true"/>:state==='done'?<Check size={15} aria-hidden="true"/>:<RefreshCw size={15} aria-hidden="true"/>}{state==='busy'?'Syncing…':'Sync roles'}</button>
 </AccountSettingRow>;
}
