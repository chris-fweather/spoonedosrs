import {supporterTitle} from '@/lib/staff-appearance';
import {readSession,ensureAuthTables} from '@/lib/auth';
import {db,freshJournal} from '@/lib/storage';
import {guideWriters,publicStaff} from '@/lib/staff-data';
import {shownPrefix} from '@/lib/name-prefix';
import {parseAppearance} from '@/lib/appearance';
import {menuAccount} from '@/lib/account-menu';
import {hydratePublicJournal} from '@/lib/public-journal';
import type {Journal} from '@/lib/model';
const headers={'Cache-Control':'no-store'};
type Row={display_name:string;title:string|null;title_choice:string|null;pinned_mark:string|null;show_donation:number|null;amount_minor:number|null;currency:string|null;supporter:number|null;staff_badge:string|null;staff_prefix:string|null;body:string|null;hair:string|null;skin:string|null;data:string|null};
export async function GET(request:Request){try{
 const session=await readSession(request);if(!session)return Response.json({error:'Sign in to view linked accounts.'},{status:401,headers});await ensureAuthTables();
 const [result,staff,writers]=await Promise.all([db().prepare(`SELECT c.display_name,c.pinned_mark,u.title,p.title_choice,p.show_donation,p.staff_badge,p.staff_prefix,
 pd.amount_minor,pd.currency,pd.supporter,
 a.body_type AS body,a.hair_color AS hair,o.skin,j.data
 FROM claimed_names c JOIN users u ON u.discord_id=c.discord_id
 LEFT JOIN profile_presentation p ON p.rsn=c.rsn LEFT JOIN profile_appearance a ON a.rsn=c.rsn
 LEFT JOIN profile_options o ON o.rsn=c.rsn LEFT JOIN journals j ON j.id=c.rsn
 LEFT JOIN profile_support pd ON pd.rsn=c.rsn
 WHERE c.discord_id=? ORDER BY c.display_name`).bind(session.id).all<Row>(),publicStaff(session.id),guideWriters([session.id])]);
 const accounts=result.results.map(row=>menuAccount({prefix:shownPrefix(row.staff_prefix,staff?.role,writers.has(session.id)),supporter:row.supporter===1,name:row.display_name,title:supporterTitle(row.amount_minor,row.currency),choice:row.title_choice??'auto',mark:row.pinned_mark,owner:staff?.role==='owner',role:staff?.role,appearance:parseAppearance({body:row.body??'male',hair:row.hair??'brown',skin:row.skin??'default'}),journal:row.data?hydratePublicJournal(JSON.parse(row.data) as Journal):freshJournal(row.display_name),donation:{amountMinor:row.show_donation===0?null:row.amount_minor,currency:row.currency??'USD',hidden:row.show_donation===0,badge:row.staff_badge==='gilded'?'gilded':null}}));
 return Response.json({accounts,staff},{headers});
 }catch{return Response.json({error:'Linked account details are temporarily unavailable.'},{status:503,headers});}}
