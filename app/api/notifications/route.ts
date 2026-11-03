import {HttpError} from '@/lib/auth';
import {publicMessage,requestJson,RequestError} from '@/lib/request-body';
import {dismissNotification,listNotifications} from '@/lib/notifications';

const headers={'Cache-Control':'private, no-store'};
function fail(e:unknown){
 const status=e instanceof HttpError||e instanceof RequestError?e.status:503;
 return Response.json({error:status===503?'Notifications are unavailable. Please retry.':publicMessage(e,'Request failed.')},{status,headers});
}
export async function GET(req:Request){
 try{return Response.json({notifications:await listNotifications(req)},{headers});}catch(e){return fail(e);}
}
export async function DELETE(req:Request){
 try{const {id}=await requestJson(req,1000);await dismissNotification(req,id);return Response.json({ok:true},{headers});}catch(e){return fail(e);}
}
