import {HttpError} from '@/lib/auth';
import {publicMessage,requestJson,RequestError} from '@/lib/request-body';
import {characterAction,listCharacters} from '@/lib/plugin-store';

const headers={'Cache-Control':'private, no-store'};
function fail(e:unknown){
 const status=e instanceof HttpError||e instanceof RequestError?e.status:503;
 return Response.json({error:status===503?'Characters are unavailable. Please retry.':publicMessage(e,'Request failed.')},{status,headers});
}
export async function GET(req:Request){
 try{return Response.json({characters:await listCharacters(req)},{headers});}catch(e){return fail(e);}
}
/** Add a character the plugin has seen, or ask staff to review another account's link to it. */
export async function POST(req:Request){
 try{const {name,action}=await requestJson(req,1000);return Response.json(await characterAction(req,name,action),{headers});}catch(e){return fail(e);}
}
