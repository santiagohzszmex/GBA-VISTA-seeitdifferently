import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createGateway, detectMime } from '../cloudflare/workspace-originals/worker.mjs';
import { validateOriginal, parsePalette, validatePalette, canManageReference } from '../src/workspace/referenceModel.js';
const referenceId='11111111-1111-4111-8111-111111111111';
const assetId='22222222-2222-4222-8222-222222222222';
const originalBytes=new Uint8Array([137,80,78,71,13,10,26,10,0,1,2,3,4,5,6,255]);
const pdfBytes=new TextEncoder().encode('%PDF-1.7\nprivate moodboard');
const mimeTests=[[originalBytes,'image/png'],[pdfBytes,'application/pdf'],[new Uint8Array([255,216,255,0]),'image/jpeg'],[new TextEncoder().encode('GIF89a'),'image/gif'],[new TextEncoder().encode('RIFFabcdWEBP'),'image/webp'],[new TextEncoder().encode('II*\0'),'image/tiff'],[new TextEncoder().encode('abcdftypavif'),'image/avif'],[new TextEncoder().encode('abcdftypheic'),'image/heic'],[new TextEncoder().encode('<svg>'),'invalid']];
for(const [bytes,mime] of mimeTests) assert.equal(detectMime(bytes),mime==='invalid'?null:mime);
assert.deepEqual(parsePalette('#673ab7, #F4ECE0 #673AB7'),['#673AB7','#F4ECE0']);
assert.equal(validatePalette(['#673AB7']),true);assert.equal(validatePalette(['javascript:alert(1)']),false);
assert.throws(()=>validateOriginal({size:5,type:'application/pdf'},'concept'),/moodboards/);
assert.throws(()=>validateOriginal({size:26214401,type:'image/png'},'moodboard'),/25 MB/);
assert.equal(canManageReference('concept',null,{}),false);
assert.equal(canManageReference('instructions','art',{}, {art:{'reference.manage_instructions':true}}),true);
function fixture({kind='moodboard',denied=false,putFailure=false,finishFailure=false,deleteFailure=false,wrongSize=false,wrongHash=false}={}) {
 const calls=[],objects=new Map();let reservation;
 const fetcher=async(url,options)=>{
  const name=url.split('/').pop(),args=JSON.parse(options.body);calls.push({name,args});
  assert.equal(args.p_gateway_key,'private-gateway-fixture');
  assert.equal(options.headers.Authorization,'Bearer user-fixture');
  if(denied) return Response.json({message:'Sin permiso para esta edición'},{status:403});
  if(name==='workspace_original_gate') return Response.json({kind,limit:26214400});
  if(name==='workspace_original_begin') {reservation={id:assetId,object_key:`${referenceId}/${assetId}`,mime_type:args.p_mime,size_bytes:args.p_size,sha256:args.p_sha256,file_name:args.p_name};return Response.json(reservation);}
  if(name==='workspace_original_finish') {if(finishFailure && args.p_success)return Response.json({message:'Sesión revocada'},{status:403}); return Response.json({id:assetId});}
  if(name==='workspace_original_access') return Response.json(reservation);
  throw Error(`Unexpected RPC: ${name}`);
 };
 const bucket={
  async put(key,stream,options){calls.push({name:'r2.put'});if(putFailure){await stream.cancel();throw Error('Unavailable');}const bytes=new Uint8Array(await new Response(stream).arrayBuffer());assert.equal(options.storageClass,'Standard');assert.equal(options.onlyIf.get('If-None-Match'),'*');assert.equal(Buffer.from(options.sha256).toString('hex'),createHash('sha256').update(bytes).digest('hex'));objects.set(key,{body:new Uint8Array(bytes),size:wrongSize?1:bytes.byteLength,customMetadata:{sha256:options.customMetadata.sha256},checksums:{sha256:wrongHash?new Uint8Array(32).buffer:options.sha256}});return {size:bytes.byteLength,checksums:{sha256:options.sha256}};},
  async get(key){calls.push({name:'r2.get'});return objects.get(key);},
  async delete(key){calls.push({name:'r2.delete'});if(deleteFailure)throw Error('Unavailable');objects.delete(key);}
 };
 const env={ORIGINALS:bucket,GATEWAY_KEY:'private-gateway-fixture',SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public-fixture',ALLOWED_ORIGINS:'https://gba.software,http://tauri.localhost'};
 const gateway=createGateway(fetcher,{error:()=>{}},()=>new TransformStream());
 const request=(body=originalBytes, mime='image/png',extra={})=>new Request(`https://workspace-originals.test.workers.dev/references/${referenceId}`,{method:'POST',headers:{Authorization:'Bearer user-fixture',Origin:'https://gba.software','Content-Type':mime,'X-File-Size':String(body.byteLength),'X-File-Sha256':createHash('sha256').update(body).digest('hex'),'X-File-Name':encodeURIComponent('Prisma original ñ.png'),...extra},body});
 return {calls,objects,env,request,run:request=>gateway.fetch(request,env),asset:()=>reservation};
}
let f=fixture();let response=await f.run(f.request());assert.equal(response.status,201);let receipt=await response.json();assert.equal(receipt.sha256,createHash('sha256').update(originalBytes).digest('hex'));assert.deepEqual(f.objects.get(f.asset().object_key).body,originalBytes);
response=await f.run(new Request(`https://workspace-originals.test.workers.dev/originals/${assetId}?download=1`,{headers:{Authorization:'Bearer user-fixture',Origin:'http://tauri.localhost'}}));assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),originalBytes);assert.match(response.headers.get('Content-Disposition'),/^attachment/);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'http://tauri.localhost');assert.equal(f.calls.at(-2).args.p_download,true);assert.match(response.headers.get('Cache-Control'),/no-store/);
f=fixture();response=await f.run(f.request(pdfBytes,'application/pdf'));assert.equal(response.status,201);assert.deepEqual(f.objects.get(f.asset().object_key).body,pdfBytes);
f=fixture({kind:'concept'});assert.equal((await f.run(f.request(pdfBytes,'application/pdf'))).status,400);assert.equal(f.calls.some(call=>call.name==='r2.put'),false);
f=fixture();assert.equal((await f.run(f.request(new TextEncoder().encode('<script>alert(1)</script>'),'image/png'))).status,400);assert.equal(f.calls.some(call=>call.name==='r2.put'),false);
f=fixture();assert.equal((await f.run(f.request(originalBytes,'application/pdf'))).status,400);
f=fixture();assert.equal((await f.run(f.request(originalBytes,'image/png',{'content-length':'26214401'}))).status,413);assert.equal(f.calls.some(call=>call.name==='workspace_original_begin'),false);
f=fixture({denied:true});assert.equal((await f.run(f.request())).status,403);assert.equal(f.calls.length,1);
f=fixture();assert.equal((await f.run(f.request(originalBytes,'image/png',{Origin:'https://other.example'}))).status,403);assert.equal(f.calls.length,0);
f=fixture();assert.equal((await f.run(new Request('https://worker.test/originals/'+assetId))).status,401);assert.equal(f.calls.length,0);
f=fixture({putFailure:true});assert.equal((await f.run(f.request())).status,502);assert.equal(f.calls.at(-1).args.p_success,false);
f=fixture({putFailure:true,deleteFailure:true});await f.run(f.request());assert.equal(f.calls.some(call=>call.name==='workspace_original_finish'),false);
f=fixture({finishFailure:true});assert.equal((await f.run(f.request())).status,403);assert.equal(f.calls.some(call=>call.name==='r2.delete'),false);assert.equal(f.objects.size,1); // Quarantined, still charged to quota.
for(const options of [{wrongSize:true},{wrongHash:true}]){f=fixture(options);await f.run(f.request());assert.equal((await f.run(new Request(`https://worker.test/originals/${assetId}`,{headers:{Authorization:'Bearer user-fixture'}}))).status,502);}
console.log('PASS: R2 originals preserve exact image/PDF bytes, verify SHA-256, deny unauthorized scopes and origins, enforce file limits, and retain failed reservations until confirmed cleanup.');
