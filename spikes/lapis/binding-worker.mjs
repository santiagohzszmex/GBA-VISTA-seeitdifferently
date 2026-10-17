import {cleanWebP} from '../../cloudflare/workspace-originals/images/previews.mjs';
// Isolated experiment. No production bindings, storage, identity or secrets.
export default {async fetch(request,env){
 const start=performance.now();
 if(request.method!=='POST' || new URL(request.url).pathname!=='/binding')return new Response('Synthetic/local spike only',{status:404});
 try {
  const transformed=await env.IMAGES.input(request.body).transform({width:800,height:1000,fit:'contain'}).output({format:'image/webp'});
  const response=transformed.response();const blob=await response.blob();
  const raw=new URL(request.url).searchParams.get('raw');if(raw)return new Response(raw==='clean'?cleanWebP(await blob.arrayBuffer()).body:blob,{headers:{'Content-Type':'image/webp'}});
  return Response.json({ok:true,elapsedMs:performance.now()-start,size:blob.size,type:blob.type,engine:'Cloudflare Images remote binding'});
 }catch(error){return Response.json({ok:false,elapsedMs:performance.now()-start,error:String(error.message).slice(0,500)},{status:422});}
}};
