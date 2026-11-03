import {HttpError,readSession} from './auth';
import {db,sameOrigin} from './storage';

/** Kinds of notice; the Account page turns each into a sentence about the named profile. */
export type NotificationKind='link_review_requested'|'link_review_opened'|'link_review_approved'|'link_review_rejected';
export type NotificationView={id:string;kind:NotificationKind;rsn:string;name:string;createdAt:number};

/** Statement adding a notice, for callers that batch it with their own writes. Moderation holds are not people and get none. */
export function notificationStatement(discordId:string,kind:NotificationKind,rsn:string,caseId:string|null){
 return db().prepare('INSERT INTO notifications(id,discord_id,kind,rsn,case_id,created_at) SELECT ?,?,?,?,?,? WHERE ? NOT LIKE \'moderation-hold:%\'')
  .bind(crypto.randomUUID(),discordId,kind,rsn.toLowerCase(),caseId,Date.now(),discordId);
}

async function owner(request:Request){
 if(request.method!=='GET'){
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new HttpError(403,'Use your Account page.');
  sameOrigin(request);
 }
 const session=await readSession(request);
 if(!session)throw new HttpError(401,'Log in with Discord to see notifications.');
 return session.discordId;
}

/** Unread notices, newest first, with each profile's display name. */
export async function listNotifications(request:Request):Promise<NotificationView[]>{
 const discordId=await owner(request);
 const rows=await db().prepare(`SELECT n.id,n.kind,n.rsn,n.created_at,COALESCE(c.display_name,j.name,n.rsn) AS name FROM notifications n
  LEFT JOIN claimed_names c ON c.rsn=n.rsn LEFT JOIN journal_summaries j ON j.rsn=n.rsn
  WHERE n.discord_id=? AND n.read_at IS NULL ORDER BY n.created_at DESC LIMIT 50`).bind(discordId)
  .all<{id:string;kind:NotificationKind;rsn:string;created_at:number;name:string}>();
 return rows.results.map(r=>({id:r.id,kind:r.kind,rsn:r.rsn,name:r.name,createdAt:r.created_at}));
}

export async function dismissNotification(request:Request,id:unknown){
 const discordId=await owner(request);
 if(typeof id!=='string'||id.length>64)throw new HttpError(400,'Choose a notification.');
 await db().prepare('UPDATE notifications SET read_at=? WHERE id=? AND discord_id=? AND read_at IS NULL').bind(Date.now(),id,discordId).run();
}
