import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import sharp from 'sharp';
import {createImageGateway} from '../cloudflare/workspace-originals/images/gateway.mjs';
import {createImageUploader} from '../src/workspace/imageUploadClient.mjs';
import {makePng} from './helpers/lapis-png.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function digestFactory(){let resolve,reject;const hash=createHash('sha256'),stream=new WritableStream({write(bytes){hash.update(bytes);},close(){resolve(hash.digest());},abort(error){reject(error);}});stream.digest=new Promise((a,b)=>{resolve=a;reject=b;});return stream;}
class Bucket{
 objects=new Map();uploads=new Map();created=0;written=0;failDelete=false;failPut=false;
 obj(key,bytes,metadata={}){return {key,size:bytes.length,body:new Blob([bytes]).stream(),checksums:{sha256:Buffer.from(sha(bytes),'hex')},...metadata,arrayBuffer:async()=>Uint8Array.from(bytes).buffer};}
 async put(key,body,opts={}){if(this.failPut)throw Error('R2 transient write failure');if(opts.onlyIf&&this.objects.has(key))return null;const bytes=Buffer.from(await new Response(body).arrayBuffer());this.objects.set(key,bytes);return this.obj(key,bytes);}
 async head(key){const b=this.objects.get(key);return b?this.obj(key,b):null;}
 async get(key,opts={}){let b=this.objects.get(key);if(!b)return null;const full=b;if(opts.range)b=b.subarray(opts.range.offset,opts.range.offset+opts.range.length);return this.obj(key,b,{size:full.length,checksums:{sha256:Buffer.from(sha(full),'hex')}});}
 async delete(key){if(this.failDelete)throw Error('R2 unavailable');this.objects.delete(key);}
 async createMultipartUpload(key){const id=webcrypto.randomUUID();this.created++;this.uploads.set(id,{key,parts:new Map()});return this.resumeMultipartUpload(key,id);}
 resumeMultipartUpload(key,id){const get=()=>{const value=this.uploads.get(id);if(!value||value.key!==key)throw Object.assign(Error('NoSuchUpload'),{code:'NoSuchUpload'});return value;};return {uploadId:id,
  uploadPart:async(n,body)=>{const value=get(),bytes=Buffer.from(await new Response(body).arrayBuffer()),etag=sha(bytes);value.parts.set(n,{bytes,etag});this.written++;return {partNumber:n,etag};},
  complete:async parts=>{const value=get();const bytes=Buffer.concat(parts.map(p=>{const part=value.parts.get(p.partNumber);assert.equal(part.etag,p.etag);return part.bytes;}));this.objects.set(key,bytes);this.uploads.delete(id);return this.obj(key,bytes);},
  abort:async()=>{get();this.uploads.delete(id);}
 };}
}
export async function runLapisGatewayAcceptance(db){
 let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;},bad=async(fn,re)=>{await assert.rejects(fn,re);checks++;};
 const scalar=async(q,p=[])=>Object.values((await db.query(q,p)).rows[0])[0];
 const admin=async(q,p=[])=>{await db.exec('reset role');return db.query(q,p);};
 const id=n=>`84000000-0000-4000-8000-${String(n).padStart(12,'0')}`,sid=n=>`85000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
 const actor=async n=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(n?{sub:id(n),session_id:sid(n)}:{})]);await db.exec(`set role ${n?'authenticated':'anon'}`);};
 const secret='local-phase2-only',cmd=(action,data,revision=null)=>scalar('select public.workspace_command($1,$2,$3)',[action,data,revision]);
 await admin('select 1');await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261016194802_workspace_lapis_multipart_gateway.sql',import.meta.url),'utf8'));
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261016203609_workspace_lapis_image_interface.sql',import.meta.url),'utf8'));
 await db.exec(fs.readFileSync(new URL('../supabase/migrations/20261017021526_workspace_lapis_retained_read.sql',import.meta.url),'utf8'));
 eq(await scalar('select derivatives_enabled from workspace_private.upload_policy where singleton'),false);
 await admin('update workspace_private.upload_policy set derivatives_enabled=true where singleton');
 const unit=await scalar("select id from public.workspace_units where slug='gimg'");
 await admin("update workspace_private.original_limits set enabled=true,capacity_bytes=10000000000,gateway_key_hash=encode(extensions.digest($1,'sha256'),'hex') where singleton",[secret]);
 for(let n=1;n<=5;n++){
  await db.query('insert into auth.users(id,email) values($1,$2)',[id(n),`phase2-${n}@example.invalid`]);await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[sid(n),id(n)]);
  await db.query("insert into public.usuarios(id,rol,nombre,nombre_publico) values($1,'Usuario',$2,$2)",[id(n),`phase2-${n}`]);await db.query("insert into public.workspace_unit_memberships(unit_id,user_id,membership_status) values($1,$2,'active')",[unit,id(n)]);
 }
 await db.query("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,reason) values($1,'gimg_direction',$2,'unit',$2,'Local Phase 2')",[id(1),unit]);
 await actor(1);const project=await cmd('project.create',{unit_id:unit,title:'Synthetic Phase2 Día de Muertos'}),other=await cmd('project.create',{unit_id:unit,title:'Synthetic Phase2 Halloween'});
 const area=await scalar("select id from public.workspace_areas where project_id=$1 and specialty='art'",[project.id]),area2=await scalar("select id from public.workspace_areas where project_id=$1 and specialty='art'",[other.id]);
 for(const [n,a,role,p]of [[2,area,'gimg_contributor',project.id],[3,area2,'gimg_contributor',other.id],[4,area,'gimg_viewer',project.id],[5,area,'gimg_area_lead',project.id]]){
  await admin("insert into public.workspace_access_grants(user_id,access_role,unit_id,scope_type,scope_id,reason) values($1,$2,$3,'area',$4,'Local Phase2')",[id(n),role,unit,a]);await db.query("insert into public.workspace_assignments(user_id,assignment_role,unit_id,project_id,area_id,assigned_by) values($1,'contributor',$2,$3,$4,$5)",[id(n),unit,p,a,id(1)]);
 }
 await actor(1);let task=await cmd('task.create',{unit_id:unit,project_id:project.id,area_id:area,title:'Synthetic image upload',responsible_id:id(2)});
 await scalar("select public.workspace_image_command('spec.save',$1,'{}',$2)",[task.id,task.revision]);
 const bucket=new Bucket(),env={ORIGINALS:bucket,GATEWAY_KEY:secret,SUPABASE_URL:'https://database.invalid',SUPABASE_PUBLISHABLE_KEY:'test',ALLOWED_ORIGINS:'https://workspace.invalid'};
 let queue=Promise.resolve(),clock=Date.now();
 const fetcher=(url,options)=>{const run=queue.then(async()=>{const n=Number(options.headers.Authorization?.replace('Bearer local-',''))||0;await actor(n);const body=JSON.parse(options.body),name=url.split('/').at(-1);
  try{const value=await scalar(`select public.${name}(${name==='workspace_image_file'?'$1,$2':'$1,$2,$3'})`,name==='workspace_image_file'?[body.p_data,body.p_gateway_key]:[body.p_action,body.p_data,body.p_gateway_key]);return Response.json(value);}
  catch(error){return Response.json({message:error.message,code:error.code},{status:error.code==='42501'?403:400});}});queue=run.catch(()=>{});return run;};
 const gateway=createImageGateway({fetcher,logger:{error(){}},processorFactory:()=>({id:'test-failure',async generate(){throw Error('9402 input oversized');}}),digestFactory,fixedLength:()=>new TransformStream(),now:()=>clock});
 const request=(path,{n=2,method='GET',body}={})=>gateway.fetch(new Request(new URL(path,'https://gateway.invalid'),{method,headers:n?{Authorization:`Bearer local-${n}`}:undefined,...(body!==undefined?{body:typeof body==='object'&&!(body instanceof Uint8Array)?JSON.stringify(body):body}:{}),duplex:'half'}),env);
 const call=async(path,options={},expected=200)=>{const r=await request(path,options);eq(r.status,expected);return r.json();};
 const open=async(bytes,format='png',fields={})=>call('/images/uploads',{method:'POST',body:{request_id:webcrypto.randomUUID(),deliverable_id:task.id,file_name:`synthetic.${format}`,role:format==='png'?'png':'layered',format,size_bytes:bytes.length,sha256:sha(bytes),...fields}},201);
 const original=makePng(),baseline=await admin('select allocated_bytes::text as value from workspace_private.original_limits where singleton').then(x=>BigInt(x.rows[0].value));
 let s=await open(original);eq(s.part_bytes,8388608);eq(s.parts,[]);eq(JSON.stringify(s).includes('object_key'),false);eq(new Date(s.expires_at)-clock>23.9*3600000,true);
 const reqId=await admin('select request_id from workspace_private.image_upload_sessions where id=$1',[s.id]).then(x=>x.rows[0].request_id);
 const twice=await open(original,'png',{request_id:reqId});eq(twice.id,s.id);eq(bucket.created,1);
 eq(await admin('select allocated_bytes::text as value from workspace_private.original_limits where singleton').then(x=>BigInt(x.rows[0].value)),baseline+BigInt(original.length));
 await call(`/images/uploads/${s.id}/complete`,{method:'POST'},400); // Must not strand state=validating.
 await call(`/images/uploads/${s.id}/parts/1`,{method:'PUT',body:original.subarray(0,2)},400);
 s=await call(`/images/uploads/${s.id}/parts/1`,{method:'PUT',body:original});eq(s.received_bytes,original.length);
 s=await call(`/images/uploads/${s.id}/complete`,{method:'POST'});eq(s.state,'ready');eq(s.verification,'header');eq(s.preview_state,'unavailable');eq(s.message,'Vista previa no disponible; descarga el original');
 eq(await admin('select status from workspace_private.image_assets where id=$1',[s.asset_id]).then(x=>x.rows[0].status),'validated');
 await call(`/images/uploads/${s.id}`,{method:'DELETE'},409);
 // Working copies cannot be read even by Direction until submitted.
 await call(`/images/files/${s.asset_id}/original/link`,{method:'POST',n:1},403);
 const missing=await call(`/images/files/${s.asset_id}/preview/link`,{method:'POST'});eq(missing.available,false);eq(missing.can_download,true);
 const link=await call(`/images/files/${s.asset_id}/original/link`,{method:'POST'});eq(JSON.stringify(link).includes('images/'),false);eq(new Date(link.expires_at)-clock<=300000,true);
 const dl=await request(link.url,{n:0});eq(dl.status,200);eq(sha(Buffer.from(await dl.arrayBuffer())),sha(original));eq(dl.headers.get('Content-Disposition').startsWith('attachment'),true);
 await call(new URL(link.url).pathname+new URL(link.url).search.replace(/.$/,'x'),{n:0},403);
 await call(link.url.replace('/original?','/preview?'),{n:0},403);
 clock+=300001;await call(link.url,{n:0},403);clock=Date.now();
 // Publish the already stored asset to an immutable version without reserving twice.
 await actor(2);const before=await admin('select allocated_bytes::text as value from workspace_private.original_limits where singleton').then(x=>x.rows[0].value);await actor(2);
 const v=await scalar("select public.workspace_image_command('version.submit',$1,$2,0)",[task.id,{base_version:0,png_asset_id:s.asset_id,has_layers:false}]);eq(v.kind,'image');
 eq(await admin('select allocated_bytes::text as value from workspace_private.original_limits where singleton').then(x=>x.rows[0].value),before);
 await call(`/images/files/${s.asset_id}/original/link`,{method:'POST',n:1});await call(`/images/files/${s.asset_id}/original/link`,{method:'POST',n:3},403);await call(`/images/files/${s.asset_id}/original/link`,{method:'POST',n:4},403);
 // Redeemed links recheck membership and session rather than trusting issuance.
 const fresh=await call(`/images/files/${s.asset_id}/original/link`,{method:'POST'});
 await admin("update public.workspace_unit_memberships set membership_status='suspended' where unit_id=$1 and user_id=$2",[unit,id(2)]);await call(fresh.url,{n:0},403);await admin("update public.workspace_unit_memberships set membership_status='active' where unit_id=$1 and user_id=$2",[unit,id(2)]);
 await admin('delete from auth.sessions where id=$1',[sid(2)]);await call(fresh.url,{n:0},403);await admin('insert into auth.sessions(id,user_id) values($1,$2)',[sid(2),id(2)]);
 // New revision keeps the existing editorial chain intact.
 await actor(5);task=await cmd('review.changes',{unit_id:unit,project_id:project.id,deliverable_id:task.id,body:'Local second revision'},await scalar('select revision from public.workspace_deliverables where id=$1',[task.id]));
 // SDK reopens a persisted manifest, skips acknowledged 8 MiB part and preserves hash.
 const bytes=Buffer.alloc(8388608+101,7),file=new File([bytes],'synthetic.afphoto');let saved,progress=[],cut=true;
 const sdk=createImageUploader({gateway:'https://gateway.invalid',authorization:async()=>'Bearer local-2',hashFile:async f=>sha(Buffer.from(await f.arrayBuffer())),persist:async p=>{saved=p;},onProgress:p=>progress.push(p),fetcher:async(url,options)=>{const r=await gateway.fetch(new Request(url,options),env);if(cut&&String(url).endsWith('/parts/1')){cut=false;throw Error('synthetic connection lost after server acknowledgement');}return r;}});
 const plan=await sdk.prepare(file,{ownerId:id(2),deliverableId:task.id,role:'layered',format:'afphoto'});await bad(sdk.upload(plan,file,{ownerId:id(2)}),/connection lost/);eq(Boolean(saved.session_id),true);
 const written=bucket.written;const resumed=await sdk.upload(saved,file,{ownerId:id(2)});eq(resumed.state,'ready');eq(resumed.verification,'unverified');eq(bucket.written-written,1);eq(progress.some(p=>p.received===8388608),true);
 await bad(sdk.upload(saved,file,{ownerId:id(3)}),/otra cuenta/);
 // Deterministic corruption deletes bytes and releases its single reservation.
 const corrupt=await open(original,'png',{sha256:'0'.repeat(64)});await call(`/images/uploads/${corrupt.id}/parts/1`,{method:'PUT',body:original});await call(`/images/uploads/${corrupt.id}/complete`,{method:'POST'},400);
 eq(await admin('select quota_released from workspace_private.image_assets where id=$1',[corrupt.asset_id]).then(x=>x.rows[0].quota_released),true);
 const malformed=await open(Buffer.from('not-PNG'));await call(`/images/uploads/${malformed.id}/parts/1`,{method:'PUT',body:Buffer.from('not-PNG')});await call(`/images/uploads/${malformed.id}/complete`,{method:'POST'},400);
 // A cancelled/expired upload retains quota until abort+delete+HEAD confirmation.
 const cancel=await open(original);bucket.failDelete=true;await call(`/images/uploads/${cancel.id}`,{method:'DELETE'},502);
 eq(await admin('select quota_released from workspace_private.image_assets where id=$1',[cancel.asset_id]).then(x=>x.rows[0].quota_released),false);
 bucket.failDelete=false;await admin("update workspace_private.image_upload_sessions set lease_until=now()-interval '1 second' where id=$1",[cancel.id]);await gateway.scheduled({},env);
 eq(await admin('select quota_released from workspace_private.image_assets where id=$1',[cancel.asset_id]).then(x=>x.rows[0].quota_released),true);
 const quota=await admin('select allocated_bytes::text value from workspace_private.original_limits where singleton').then(x=>x.rows[0].value);await gateway.scheduled({},env);eq(await admin('select allocated_bytes::text value from workspace_private.original_limits where singleton').then(x=>x.rows[0].value),quota);
 const expired=await open(original);await call(`/images/uploads/${expired.id}/parts/1`,{method:'PUT',body:original});await admin("update workspace_private.image_upload_sessions set created_at=now()-interval '25 hours',expires_at=now()-interval '1 second' where id=$1",[expired.id]);await admin('delete from auth.sessions where id=$1',[sid(2)]);await gateway.scheduled({},env);
 eq(await admin('select quota_released from workspace_private.image_assets where id=$1',[expired.asset_id]).then(x=>x.rows[0].quota_released),true);await admin('insert into auth.sessions(id,user_id) values($1,$2)',[sid(2),id(2)]);
 // Successful processor; reservations precede writes and derived files are immutable.
 const webp=await sharp(makePng()).webp().toBuffer(),variants=['thumbnail','preview'].map(kind=>({kind,body:webp,width:2,height:1,metadata_stripped:true}));
 const good=createImageGateway({fetcher,logger:{error(){}},processorFactory:()=>({id:'test-success',async generate(){return variants;}}),digestFactory,fixedLength:()=>new TransformStream()});
 const preview=await open(original);await call(`/images/uploads/${preview.id}/parts/1`,{method:'PUT',body:original});const result=await good.fetch(new Request(`https://gateway.invalid/images/uploads/${preview.id}/complete`,{method:'POST',headers:{Authorization:'Bearer local-2'}}),env);eq(result.status,200);eq((await result.json()).preview_state,'ready');
 const plink=await call(`/images/files/${preview.asset_id}/preview/link`,{method:'POST'});eq((await request(plink.url,{n:0})).headers.get('Content-Type'),'image/webp');
 const d=await admin('select count(*)::int n from workspace_private.image_derivatives where asset_id=$1',[preview.asset_id]);eq(d.rows[0].n,2);
 // A failed R2 derivative write cannot reject the original or release an unconfirmed reservation.
 const orphan=await open(original);await call(`/images/uploads/${orphan.id}/parts/1`,{method:'PUT',body:original});bucket.failPut=true;
 const failedPreview=await good.fetch(new Request(`https://gateway.invalid/images/uploads/${orphan.id}/complete`,{method:'POST',headers:{Authorization:'Bearer local-2'}}),env);eq(failedPreview.status,200);eq((await failedPreview.json()).preview_state,'unavailable');
 eq(await admin('select status from workspace_private.image_assets where id=$1',[orphan.asset_id]).then(x=>x.rows[0].status),'validated');
 const reserved=await admin("select id,size_bytes::text from workspace_private.image_derived_reservations where asset_id=$1 and state='reserved'",[orphan.asset_id]);eq(reserved.rows.length,1);
 bucket.failPut=false;bucket.failDelete=true;await bad(gateway.scheduled({},env),/R2 unavailable/);
 eq(await admin('select state from workspace_private.image_derived_reservations where id=$1',[reserved.rows[0].id]).then(x=>x.rows[0].state),'reserved');
 bucket.failDelete=false;await admin("update workspace_private.image_derived_reservations set cleanup_until=now()-interval '1 second' where id=$1",[reserved.rows[0].id]);await gateway.scheduled({},env);
 eq(await admin('select state from workspace_private.image_derived_reservations where id=$1',[reserved.rows[0].id]).then(x=>x.rows[0].state),'cleaned');
 eq(await scalar("select count(*)::int from workspace_private.image_storage_audit where asset_id=$1 and action='image.derivative.cleaned' and actor_id is null",[orphan.asset_id]),1);
 eq(await scalar("select count(*)::int from workspace_private.image_storage_audit where asset_id=$1 and action='image.upload.cleaned' and actor_id is null",[expired.asset_id]),1);
 // A live lease excludes concurrent writers and blocks cleanup even after expiry.
 const busy=await open(original);await actor(2);const held=await scalar("select public.workspace_image_storage('lock',$1,$2)",[{session_id:busy.id,operation:'part'},secret]);
 await call(`/images/uploads/${busy.id}/parts/1`,{method:'PUT',body:original},409);
 await admin("update workspace_private.image_upload_sessions set created_at=now()-interval '25 hours',expires_at=now()-interval '1 second' where id=$1",[busy.id]);await gateway.scheduled({},env);
 eq(await admin('select quota_released from workspace_private.image_assets where id=$1',[busy.asset_id]).then(x=>x.rows[0].quota_released),false);
 await admin("update workspace_private.image_upload_sessions set lease_until=now()-interval '1 second' where id=$1",[busy.id]);await gateway.scheduled({},env);
 eq(await admin('select quota_released from workspace_private.image_assets where id=$1',[busy.asset_id]).then(x=>x.rows[0].quota_released),true);
 // Quota warnings are current-Direction-only and deduplicated per crossing.
 await admin('update workspace_private.original_limits set allocated_bytes=8000000000 where singleton');
 const warned=await scalar("select count(*)::int from workspace_private.notifications where event_type='storage.warning' and recipient_id=$1",[id(1)]);eq(warned,1);
 eq(await scalar("select count(*)::int from workspace_private.notifications where event_type='storage.warning' and recipient_id in($1,$2,$3,$4)",[id(2),id(3),id(4),id(5)]),0);
 await admin('update workspace_private.original_limits set allocated_bytes=8100000000 where singleton');eq(await scalar("select count(*)::int from workspace_private.notifications where event_type='storage.warning' and recipient_id=$1",[id(1)]),1);
 await admin('update workspace_private.original_limits set allocated_bytes=10000000000 where singleton');const full=await call('/images/uploads',{method:'POST',body:{request_id:webcrypto.randomUUID(),deliverable_id:task.id,file_name:'synthetic.png',role:'png',format:'png',size_bytes:original.length,sha256:sha(original)}},400);eq(full.error,'No hay espacio disponible en Workspace; avisa a Dirección');
 await actor(0);await bad(scalar("select public.workspace_image_maintenance('cleanup.claim','{}','wrong')"),/Pasarela/);await bad(scalar("select public.workspace_image_file('{}','wrong')"),/Pasarela/);
 await admin('update workspace_private.upload_policy set images_enabled=false,derivatives_enabled=false where singleton');eq(await scalar('select images_enabled from workspace_private.upload_policy where singleton'),false);
 console.log(`PASS: ${checks} Phase 2 gateway/database/SDK assertions; isolated local database and fake R2.`);await db.exec('reset role');return checks;
}
