import {HttpError} from '@/lib/auth';
import {requestJson,RequestError} from '@/lib/request-body';
import {requireStaff} from '@/lib/staff-store';
import {db} from '@/lib/storage';
import {donorFromName,recentDonations,recordDonation,reverseDonation} from '@/lib/donation-store';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
const fail=(e:unknown)=>Response.json({error:e instanceof HttpError||e instanceof RequestError?e.message:'Donations are unavailable. Please retry.'},{status:e instanceof HttpError||e instanceof RequestError?e.status:503,headers});
/** Money is the owner's alone: other ranks cannot read or change the ledger. */
async function owner(req:Request){const actor=await requireStaff(req);if(actor.role!=='owner')throw new HttpError(403,'Only the owner records donations.');return actor;}
async function audit(actorId:string,target:string,action:string,detail:object){
 await db().prepare('INSERT INTO staff_audit(actor_id,target_id,action,detail,created_at) VALUES(?,?,?,?,?)').bind(actorId,target,action,JSON.stringify(detail),new Date().toISOString()).run();
}
export async function GET(req:Request){try{await owner(req);return Response.json({donations:await recentDonations()},{headers});}catch(e){return fail(e);}}
/** Record a donation that arrived outside the site (for a signed-in donor's linked name, or anonymous), or mark one refunded. */
export async function POST(req:Request){
 try{
  const actor=await owner(req),body=await requestJson(req,2000);
  if(body.action==='record'){
   const anonymous=body.anonymous===true,donorId=anonymous?null:await donorFromName(body.donor);
   const made=await recordDonation({amountMinor:body.amountMinor,currency:body.currency,target:body.target,donorId,anonymous,source:'staff',createdBy:actor.id});
   // The audit keeps who, what and where; never the claim code.
   await audit(actor.id,'donation:'+made.id,'donation-record',{amountMinor:body.amountMinor,currency:body.currency,target:made.target,anonymous:made.label});
   return Response.json({recorded:made,donations:await recentDonations()},{headers});
  }
  if(body.action==='refund'||body.action==='reverse'){
   await reverseDonation(body.id,body.action==='refund'?'refunded':'reversed');
   await audit(actor.id,'donation:'+String(body.id),'donation-'+body.action,{});
   return Response.json({donations:await recentDonations()},{headers});
  }
  throw new HttpError(400,'Choose Record or Refund.');
 }catch(e){return fail(e);}
}
