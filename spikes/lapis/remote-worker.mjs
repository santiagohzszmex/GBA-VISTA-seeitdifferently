// Ephemeral remote-dev experiment. Only synthetic fixture origins are allowed.
export default {async fetch(request){
 if(request.method!=='POST')return new Response('Synthetic spike only',{status:404});
 const {url}=await request.json();
 if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com\/SYNTHETIC-[\w.-]+\.png$/.test(url))return new Response('Synthetic test origin required',{status:400});
 const start=performance.now();
 try {
  const response=await fetch(url,{cf:{image:{width:800,height:1000,fit:'contain',format:'webp'}}});
  const bytes=await response.arrayBuffer();
  return Response.json({engine:'Cloudflare remote transform (remote dev)',status:response.status,type:response.headers.get('content-type'),bytes:bytes.byteLength,elapsedMs:performance.now()-start,cfResized:response.headers.get('cf-resized'),error:response.ok?null:new TextDecoder().decode(bytes.slice(0,600))});
 }catch(error){return Response.json({error:String(error.message),elapsedMs:performance.now()-start});}
}};
