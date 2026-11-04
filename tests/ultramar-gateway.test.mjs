import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {validateUltramarZip,validatePdf,validatePreview,createUltramarGateway} from '../cloudflare/workspace-originals/ultramar.mjs';

// Workspace 1.7.5 · Pasarela de Ultramar. Archivos sintéticos y R2 simulado; sin red ni producción.
let checks=0;const ok=v=>{assert.ok(v);checks++;},eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
const rejects=async(p,re)=>{await assert.rejects(p,re);checks++;};
const sha=b=>createHash('sha256').update(b).digest('hex');
const reader=bytes=>({size:bytes.length,read:async(o,l)=>bytes.subarray(o,o+l)});

// ZIP mínimo (local headers + directorio central + EOCD), suficiente para las reglas de FORMATO.md.
function zip(entries,{flags=0}={}){
 const locals=[],central=[];let offset=0;
 for(const e of entries){
  const name=Buffer.from(e.name,'latin1'),plain=Buffer.from(e.data),method=e.method??(e.deflate?8:0),data=method===8?zlib.deflateRawSync(plain):plain,crc=zlib.crc32(plain);
  const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(flags,6);lh.writeUInt16LE(method,8);lh.writeUInt32LE(crc,14);lh.writeUInt32LE(data.length,18);lh.writeUInt32LE(e.plainSize??plain.length,22);lh.writeUInt16LE(name.length,26);
  locals.push(lh,name,data);
  const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50,0);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(flags,8);ch.writeUInt16LE(method,10);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(data.length,20);ch.writeUInt32LE(e.plainSize??plain.length,24);ch.writeUInt16LE(name.length,28);ch.writeUInt32LE(offset,42);
  central.push(ch,name);offset+=30+name.length+data.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return new Uint8Array(Buffer.concat([...locals,cd,end]));
}
const resource=Buffer.from('original-bytes-sinteticos');const huella=sha(resource);
const base=(manifest={version:1,recursos:[{huella,almacenamiento:'incrustado',tamano:resource.length}]},extra=[])=>zip([
 {name:'mimetype',data:'application/vnd.ultramar'},
 {name:'manifiesto.json',data:JSON.stringify(manifest),deflate:true},
 {name:'documento.json',data:JSON.stringify({version:1,paginas:[]},null,2),deflate:true},
 {name:`recursos/${huella}`,data:resource},...extra]);

const valid=await validateUltramarZip(reader(base()));
eq([valid.ok,valid.version,valid.resources,valid.embedded],[true,1,1,1]);
await rejects(validateUltramarZip(reader(base({version:2,recursos:[]}))),/versión más nueva/);
await rejects(validateUltramarZip(reader(base({version:1,recursos:[{huella,almacenamiento:'incrustado',tamano:resource.length+1}]}))),/tamaño distinto/);
await rejects(validateUltramarZip(reader(base({version:1,recursos:[{huella,almacenamiento:'nube',tamano:1}]}))),/recurso del manifiesto/);
await rejects(validateUltramarZip(reader(zip([{name:'manifiesto.json',data:'{"version":1,"recursos":[]}',deflate:true}]))),/falta documento.json/);
await rejects(validateUltramarZip(reader(base(undefined,[{name:'../fuera.txt',data:'x'}]))),/ruta no permitida/);
await rejects(validateUltramarZip(reader(base(undefined,[{name:'/abs.txt',data:'x'}]))),/ruta no permitida/);
await rejects(validateUltramarZip(reader(base(undefined,[{name:'c:\\win.txt',data:'x'}]))),/ruta no permitida/);
await rejects(validateUltramarZip(reader(base(undefined,[{name:'documento.json',data:'{}'}]))),/duplicadas/);
await rejects(validateUltramarZip(reader(zip([{name:'mimetype',data:'application/zip'},{name:'manifiesto.json',data:'{}'},{name:'documento.json',data:'{}'}]))),/mimetype/);
await rejects(validateUltramarZip(reader(zip([{name:'manifiesto.json',data:'{}'},{name:'documento.json',data:'{}'}],{flags:1}))),/cifrado/);
await rejects(validateUltramarZip(reader(zip([{name:'manifiesto.json',data:'{}',method:12},{name:'documento.json',data:'{}'}]))),/método/);
await rejects(validateUltramarZip(reader(base(undefined,[{name:'bomba.bin',data:Buffer.alloc(4_000_000),deflate:true}]))),/compresión excesiva/);
await rejects(validateUltramarZip(reader(zip(Array.from({length:2001},(_,i)=>({name:`x/${i}`,data:''}))))),/demasiadas entradas/);
await rejects(validateUltramarZip(reader(new Uint8Array(100))),/sin directorio central/);
await rejects(validateUltramarZip(reader(zip([{name:'manifiesto.json',data:'no-json',deflate:true},{name:'documento.json',data:'{}'}]))),/ilegible/);
// Las entradas desconocidas se conservan y no invalidan el archivo.
ok((await validateUltramarZip(reader(base(undefined,[{name:'extensiones/futuro.json',data:'{}'}])))).ok);

const pdf=new Uint8Array(Buffer.from('%PDF-1.7\n'+'x'.repeat(100)+'\n%%EOF\n'));
eq((await validatePdf(reader(pdf))).format,'pdf');
await rejects(validatePdf(reader(new Uint8Array(Buffer.from('<html>'+'x'.repeat(100))))),/firma/);
await rejects(validatePdf(reader(new Uint8Array(Buffer.from('%PDF-1.7\n'+'x'.repeat(100))))),/final de archivo/);

function png(width,height){const chunk=(type,data)=>{const b=Buffer.alloc(12+data.length);b.writeUInt32BE(data.length,0);b.write(type,4,'latin1');data.copy(b,8);b.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type,'latin1'),data])),8+data.length);return b;};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.alloc(5))),chunk('IEND',Buffer.alloc(0))]));}
eq((await validatePreview(reader(png(1200,800)))).width,1200);
await rejects(validatePreview(reader(png(5000,800))),/Vista previa inválida/);

// Recorrido de la pasarela con R2 y RPC simulados.
function fakeR2(){const store=new Map();return {store,
 async head(k){const o=store.get(k);return o?{size:o.bytes.length,checksums:{sha256:Buffer.from(o.sha,'hex')}}:null;},
 async put(k,stream,opts){if(store.has(k)&&opts.onlyIf)return null;const bytes=new Uint8Array(await new Response(stream).arrayBuffer());store.set(k,{bytes,sha:sha(bytes)});return this.head(k);},
 async get(k,opts){const o=store.get(k);if(!o)return null;const b=opts?.range?o.bytes.subarray(opts.range.offset,opts.range.offset+opts.range.length):o.bytes;return {body:new Blob([b]).stream(),size:o.bytes.length,checksums:{sha256:Buffer.from(o.sha,'hex')},arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)};},
 async delete(k){store.delete(k);}};}
const reservation='11111111-2222-4333-8444-555555555555',version='66666666-7777-4888-8999-000000000000';
const files={ultramar:base(),pdf,preview:png(800,600)};
const calls=[];
const fetcher=async(url,init)=>{const name=url.split('/rpc/')[1],args=JSON.parse(init.body);calls.push({name,args,auth:init.headers.Authorization});
 if(args.p_gateway_key!=='gw-secret')return new Response(JSON.stringify({message:'Almacenamiento privado no disponible'}),{status:403});
 if(args.p_reservation_id==='99999999-2222-4333-8444-555555555555')return new Response(JSON.stringify({message:'Envío fuera de tu acceso',code:'UM016'}),{status:400});
 if(name==='workspace_ultramar_upload_gate'){const b=files[args.p_role];return Response.json({object_key:`ultramar/${args.p_reservation_id}/${args.p_role}`,size_bytes:b.length,sha256:sha(b),file_name:'x'});}
 if(name==='workspace_ultramar_file_verified')return Response.json({rol:args.p_role,verificado:true});
 if(name==='workspace_ultramar_file_access'){const b=files[args.p_role];return Response.json({object_key:`ultramar/${reservation}/${args.p_role}`,size_bytes:b.length,sha256:sha(b),file_name:'portada.pdf',mime_type:'application/pdf'});}
 return new Response('{}',{status:404});};
const r2=fakeR2(),env={ORIGINALS:r2,GATEWAY_KEY:'gw-secret',SUPABASE_URL:'https://x.supabase.co',SUPABASE_PUBLISHABLE_KEY:'pk'};
const gateway=createUltramarGateway({fetcher,logger:{error(){}},fixedLength:()=>new TransformStream()});
const send=(role,bytes,{hash=sha(bytes),size=bytes.length,auth='Bearer jwt'}={})=>gateway.fetch(new Request(`https://g.local/ultramar/uploads/${reservation}/${role}`,{method:'POST',headers:{Authorization:auth,'X-File-Size':String(size),'X-File-Sha256':hash},body:bytes,duplex:'half'}),env,{});

{const r=await send('pdf',pdf,{auth:''});eq([r.status,(await r.json()).code],[401,'UM030']);}
{const r=await send('pdf',pdf,{hash:'f'.repeat(64)});eq([r.status,(await r.json()).code],[409,'UM032']);}
{const r=await send('pdf',pdf,{size:pdf.length+1});eq([r.status,(await r.json()).code],[413,'UM031']);}
const accepted=await send('ultramar',files.ultramar);eq(accepted.status,201);
eq((await accepted.json()).validacion.embedded,1);
const verified=calls.filter(c=>c.name==='workspace_ultramar_file_verified');
eq([verified.length,verified[0].args.p_validation.format,verified[0].auth],[1,'ultramar','Bearer jwt']);
ok(r2.store.has(`ultramar/${reservation}/ultramar`));
// Reintento: los mismos bytes ya guardados se reutilizan y vuelven a validarse.
eq((await send('ultramar',files.ultramar)).status,201);
// Un archivo inválido se borra y no se marca verificado.
files.pdf=new Uint8Array(Buffer.from('<html>'+'x'.repeat(100)));
const before=calls.filter(c=>c.name==='workspace_ultramar_file_verified').length;
const refused=await send('pdf',files.pdf);eq([refused.status,(await refused.json()).code],[422,'UM033']);
eq([r2.store.has(`ultramar/${reservation}/pdf`),calls.filter(c=>c.name==='workspace_ultramar_file_verified').length],[false,before]);
files.pdf=pdf;eq((await send('pdf',pdf)).status,201);
// Descarga para revisión con integridad verificada.
const got=await gateway.fetch(new Request(`https://g.local/ultramar/files/${version}/pdf`,{headers:{Authorization:'Bearer reviewer'}}),env,{});
eq([got.status,got.headers.get('content-type'),new Uint8Array(await got.arrayBuffer()).length],[200,'application/pdf',pdf.length]);
r2.store.get(`ultramar/${reservation}/pdf`).sha='0'.repeat(64);
eq((await gateway.fetch(new Request(`https://g.local/ultramar/files/${version}/pdf`,{headers:{Authorization:'Bearer reviewer'}}),env,{})).status,502);
// Sin clave de pasarela correcta, nada pasa.
{const r=await gateway.fetch(new Request(`https://g.local/ultramar/uploads/${reservation}/pdf`,{method:'POST',headers:{Authorization:'Bearer jwt','X-File-Size':String(pdf.length),'X-File-Sha256':sha(pdf)},body:pdf,duplex:'half'}),{...env,GATEWAY_KEY:'otra'},{});eq([r.status,(await r.json()).code],[403,'UM035']);}
{const r=await gateway.fetch(new Request('https://g.local/ultramar/uploads/99999999-2222-4333-8444-555555555555/pdf',{method:'POST',headers:{Authorization:'Bearer jwt','X-File-Size':'1','X-File-Sha256':'a'.repeat(64)},body:new Uint8Array(1),duplex:'half'}),env,{});eq([r.status,(await r.json()).code],[400,'UM016']);}
console.log(`PASS: ${checks} Ultramar gateway checks: V1 container rules, path/encryption/ZIP64/bomb/entry limits, unknown entries kept, PDF and PNG structure, hash/size binding, retry, invalid deletion and verified downloads.`);
