import {HttpError} from '@/lib/auth';
import {requestJson,RequestError} from '@/lib/request-body';
import {checkoutChoice} from '@/lib/donation-store';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
/**
 * Checks a donor's choice (any valid RuneScape name, tracked here yet or not, or nobody; signed in or anonymous). No payment provider is connected yet,
 * so a valid choice gets "not open yet". docs/supporters.md lists what connecting one needs: create a
 * donation_intents row here, pass its id to the provider, and turn it into a donation from the verified webhook.
 */
export async function POST(req:Request){
 try{
  const choice=await checkoutChoice(req,await requestJson(req,1000));
  const supports=!choice.name?'it would support the site without a name.':choice.tracked?`it would give ${choice.name} the supporter coin.`:`it would give ${choice.name} the supporter coin once the name is tracked here.`;
  return Response.json({error:'Donations open soon. Your choice is fine: '+supports,choice:{target:choice.target,tracked:choice.tracked,anonymous:choice.anonymous}},{status:503,headers});
 }catch(e){
  const known=e instanceof HttpError||e instanceof RequestError;
  return Response.json({error:known?e.message:'Donations are unavailable. Please retry.'},{status:known?e.status:503,headers});
 }
}
