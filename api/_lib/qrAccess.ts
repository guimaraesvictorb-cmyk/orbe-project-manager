import {storage,type Request} from './trackingServer.js';
export const qrAccessAllowed=(profile:{is_active:boolean;role:string}|undefined,assigned:boolean)=>!!profile?.is_active&&(profile.role==='admin'||assigned);
export async function qrUser(req:Request,clientId:string){
 if(!/^[0-9a-f-]{36}$/.test(clientId))throw new Error('invalid_client');
 const auth=req.headers.authorization??'';
 if(!/^Bearer [A-Za-z0-9_.-]+$/.test(auth))throw new Error('unauthorized');
 const db=storage(),token=auth.slice(7);
 let user:{id:string};try{user=await db('auth/v1/user',{},token)}catch{throw new Error('unauthorized')}
 const [profiles,clients,assignments]=await Promise.all([
  db<{is_active:boolean;role:string}[]>(`rest/v1/profiles?id=eq.${user.id}&select=is_active,role`),
  db<{id:string}[]>(`rest/v1/clients?id=eq.${clientId}&select=id`,{},token),
  db<{user_id:string}[]>(`rest/v1/client_assignments?client_id=eq.${clientId}&user_id=eq.${user.id}&is_active=eq.true&select=user_id`),
 ]);
 if(clients.length!==1||!qrAccessAllowed(profiles[0],assignments.length===1))throw new Error('forbidden');
 return {db,user};
}
