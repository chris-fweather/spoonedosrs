import {db,accountName} from '@/lib/storage';
import {readSession} from '@/lib/auth';
import {pendingSources} from '@/lib/sync-queue';

const headers={'Cache-Control':'no-store'};
/** Which queued sources are still on their way for a name (lib/sync-queue.ts), so a profile can show "Sync queued" and
 * reload when data lands. Never a queue position. A claimed name answers only its owner; a private or reserved name
 * answers nobody else; everyone else gets an empty list. */
export async function GET(request:Request){
 let name:string;
 try{const value=new URL(request.url).searchParams.get('username');if(!value)throw Error();name=accountName(value);}catch{return Response.json({error:'Enter a RuneScape name.'},{status:400,headers});}
 const rsn=name.toLowerCase();
 const row=await db().prepare(`SELECT c.discord_id AS owner,r.discord_id AS reserved,v.visibility FROM (SELECT ? AS rsn) n
  LEFT JOIN claimed_names c ON c.rsn=n.rsn LEFT JOIN profile_link_owners r ON r.rsn=n.rsn LEFT JOIN profile_visibility v ON v.rsn=n.rsn`).bind(rsn)
  .first<{owner:string|null;reserved:string|null;visibility:string|null}>();
 let visible=!row?.owner&&!row?.reserved&&row?.visibility!=='private';
 if(row?.owner){const session=await readSession(request);visible=session?.id===row.owner;}
 return Response.json({pending:visible?await pendingSources(db(),rsn):[]},{headers});
}
