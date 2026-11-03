import {HttpError} from '@/lib/auth';
import {requestJson,RequestError} from '@/lib/request-body';
import {claimDonation,moveDonation,myDonations} from '@/lib/donation-store';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
const fail=(e:unknown)=>Response.json({error:e instanceof HttpError||e instanceof RequestError?e.message:'Donations are unavailable. Please retry.'},{status:e instanceof HttpError||e instanceof RequestError?e.status:503,headers});
/** The signed-in person's donations. */
export async function GET(req:Request){try{return Response.json({donations:await myDonations(req)},{headers});}catch(e){return fail(e);}}
/** Claim an anonymous donation with its one-time claim code alone (and, if it supports no profile yet, which of your names it goes to).
 * Move is kept for the API and its checks; Account settings no longer offers it: donations stay on the name they were given to. */
export async function POST(req:Request){
 try{
  const body=await requestJson(req,1000);
  if(body.action==='move'){await moveDonation(req,body.id,body.to??null);return Response.json({donations:await myDonations(req)},{headers});}
  if(body.action==='claim'){const claimed=await claimDonation(req,body.code,body.to);return Response.json({...claimed,donations:await myDonations(req)},{headers});}
  throw new HttpError(400,'Choose Move or Claim.');
 }catch(e){return fail(e);}
}
