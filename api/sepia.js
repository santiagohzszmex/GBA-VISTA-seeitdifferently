import {createSepiaHandler} from '../server/sepia/service.mjs';
// One Vercel function preserves the public API paths within the existing hosting limit.
const routes=Object.fromEntries(['native','config','offline-keys','admin-session','admin'].map(route=>[route,createSepiaHandler(route)]));
export default function handler(request,response){
 const route=request.query?.route||'native';
 if(typeof route!=='string'||!Object.hasOwn(routes,route)){
  response.setHeader('Cache-Control','no-store');
  return response.status(404).json({error:{code:'invalid_request',message:'Ruta no disponible.',retryable:false}});
 }
 return routes[route](request,response);
}
