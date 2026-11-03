import {HttpError} from '@/lib/auth';
import {publicMessage,requestJson,RequestError} from '@/lib/request-body';
import {createPluginToken,listPluginTokens,revokePluginToken} from '@/lib/plugin-store';

const headers={'Cache-Control':'private, no-store'};
function fail(e:unknown){
 const status=e instanceof HttpError||e instanceof RequestError?e.status:503;
 return Response.json({error:status===503?'Plugin tokens are unavailable. Please retry.':publicMessage(e,'Request failed.')},{status,headers});
}

export async function GET(req:Request){
 try{return Response.json({tokens:await listPluginTokens(req)},{headers});}catch(e){return fail(e);}
}

/** Creates a token. The token itself is only ever shown in this response. */
export async function POST(req:Request){
 try{const {label}=await requestJson(req,1000);return Response.json(await createPluginToken(req,label),{headers});}catch(e){return fail(e);}
}

export async function DELETE(req:Request){
 try{const {id}=await requestJson(req,1000);await revokePluginToken(req,id);return Response.json({ok:true},{headers});}catch(e){return fail(e);}
}
