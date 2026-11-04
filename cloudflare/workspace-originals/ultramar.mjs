// Workspace 1.7.5 · Pasarela de entregas de Ultramar (contrato gba.workspace.ultramar/1).
// Subida en una sola petición (límite de la política ≤ 90 MB), huella SHA-256 verificada por R2
// y validación estructural sin ejecutar ni reescribir nada. La ruta del objeto la decide el servidor.
import {inspectPngHeader} from './images/pngHeader.mjs';

const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const MIME={ultramar:'application/zip',pdf:'application/pdf',preview:'image/png'};
export const ZIP_LIMITS={maxEntries:2000,maxRatio:8,maxManifestBytes:1048576,maxPreviewSide:4096,previewMaxPixels:16777216};
// Códigos estables para Ultramar: UM03x propios de la pasarela; las RPC conservan su código UM0xx/40001.
const problem=(message,status=400,code='UM035')=>Object.assign(new Error(message),{status,code});
const hex=buffer=>buffer?[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join(''):'';
const u16=(b,o)=>b[o]|b[o+1]<<8,u32=(b,o)=>(b[o]|b[o+1]<<8|b[o+2]<<16|b[o+3]<<24)>>>0;

async function inflateRaw(bytes,limit){
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
 const reader=stream.getReader(),chunks=[];let total=0;
 for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit){await reader.cancel();throw problem('El manifiesto es demasiado grande.',422,'UM033');}chunks.push(value);}
 const out=new Uint8Array(total);let o=0;for(const c of chunks){out.set(c,o);o+=c.byteLength;}return out;
}

/** Valida un `.ultramar` V1 leyendo sólo el directorio central, `mimetype` y `manifiesto.json`.
 *  `read(offset,length)` devuelve bytes del objeto. No recalcula huellas de recursos (FORMATO.md). */
export async function validateUltramarZip({size,read}){
 const fail=m=>{throw problem(`Archivo .ultramar inválido: ${m}`,422,'UM033');};
 if(size<22)fail('truncado');
 const tailLength=Math.min(size,65557),tail=await read(size-tailLength,tailLength);
 let eocd=-1;for(let i=tail.length-22;i>=0;i--){if(u32(tail,i)===0x06054b50){eocd=i;break;}}
 if(eocd<0)fail('sin directorio central');
 const entries=u16(tail,eocd+10),cdSize=u32(tail,eocd+12),cdOffset=u32(tail,eocd+16);
 if(u16(tail,eocd+4)!==0||u16(tail,eocd+6)!==0||u16(tail,eocd+8)!==entries)fail('ZIP en varios volúmenes');
 if(entries===0xffff||cdSize===0xffffffff||cdOffset===0xffffffff)fail('ZIP64 no compatible');
 if(entries>ZIP_LIMITS.maxEntries)fail('demasiadas entradas');
 if(cdOffset+cdSize>size-(tailLength-eocd))fail('directorio central fuera del archivo');
 const cd=await read(cdOffset,cdSize),names=new Map();let p=0,uncompressed=0;
 for(let n=0;n<entries;n++){
  if(p+46>cd.length||u32(cd,p)!==0x02014b50)fail('directorio central dañado');
  const flags=u16(cd,p+8),method=u16(cd,p+10),compressed=u32(cd,p+20),plain=u32(cd,p+24),nameLength=u16(cd,p+28),extra=u16(cd,p+30),comment=u16(cd,p+32),local=u32(cd,p+42);
  if(p+46+nameLength>cd.length)fail('directorio central dañado');
  const raw=cd.subarray(p+46,p+46+nameLength);
  if(flags&1)fail('cifrado no permitido');
  if(![0,8].includes(method))fail('método de compresión no compatible');
  if(raw.some(b=>b<0x20||b>0x7e))fail('nombre no ASCII');
  const name=new TextDecoder().decode(raw);
  if(!name||name.startsWith('/')||name.includes('\\')||name.includes(':')||name.split('/').some(s=>s==='..'||s==='.'))fail(`ruta no permitida (${name.slice(0,60)})`);
  if(names.has(name))fail('entradas duplicadas');
  if(local+30>cdOffset)fail('entrada fuera del archivo');
  uncompressed+=plain;names.set(name,{method,compressed,plain,local,flags});
  p+=46+nameLength+extra+comment;
 }
 if(uncompressed>size*ZIP_LIMITS.maxRatio)fail('compresión excesiva');
 const body=async name=>{
  const e=names.get(name),h=await read(e.local,30);
  if(u32(h,0)!==0x04034b50)fail(`cabecera local dañada (${name})`);
  const start=e.local+30+u16(h,26)+u16(h,28);if(start+e.compressed>cdOffset)fail(`entrada fuera del archivo (${name})`);
  const data=await read(start,e.compressed);
  return e.method===0?data:await inflateRaw(data,ZIP_LIMITS.maxManifestBytes);
 };
 if(names.has('mimetype')){const m=names.get('mimetype');if(m.method!==0||new TextDecoder().decode(await body('mimetype'))!=='application/vnd.ultramar')fail('mimetype incorrecto');}
 for(const required of ['manifiesto.json','documento.json'])if(!names.has(required))fail(`falta ${required}`);
 if(names.get('manifiesto.json').plain>ZIP_LIMITS.maxManifestBytes)fail('manifiesto demasiado grande');
 let manifest;try{manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await body('manifiesto.json')));}catch(error){if(error.status)throw error;fail('manifiesto ilegible');}
 if(!manifest||typeof manifest!=='object'||!Number.isInteger(manifest.version)||manifest.version<1)fail('versión del manifiesto inválida');
 if(manifest.version>1)fail('escrito por una versión más nueva de Ultramar');
 if(!Array.isArray(manifest.recursos))fail('manifiesto sin recursos');
 const seen=new Set();let embedded=0;
 for(const r of manifest.recursos){
  if(!r||!/^[a-f0-9]{64}$/.test(r.huella||'')||!Number.isSafeInteger(r.tamano)||r.tamano<0||!['incrustado','externo'].includes(r.almacenamiento))fail('recurso del manifiesto inválido');
  if(seen.has(r.huella))fail('recurso repetido');seen.add(r.huella);
  if(r.almacenamiento==='incrustado'){const e=names.get(`recursos/${r.huella}`);if(!e||e.plain!==r.tamano)fail(`recurso faltante o de tamaño distinto (${r.huella.slice(0,12)}…)`);embedded++;}
 }
 return {ok:true,format:'ultramar',version:manifest.version,entries,resources:manifest.recursos.length,embedded,uncompressed_bytes:uncompressed};
}

export async function validatePdf({size,read}){
 if(size<64)throw problem('PDF inválido: truncado',422,'UM033');
 const head=new TextDecoder().decode(await read(0,8)),tail=new TextDecoder().decode(await read(Math.max(0,size-2048),Math.min(size,2048)));
 if(!head.startsWith('%PDF-'))throw problem('PDF inválido: firma',422,'UM033');
 if(!tail.includes('%%EOF'))throw problem('PDF inválido: sin final de archivo',422,'UM033');
 return {ok:true,format:'pdf',version:head.slice(5,8)};
}

export async function validatePreview({size,read}){
 const file={size,slice:(a,b)=>({arrayBuffer:async()=>{const bytes=await read(a,b-a);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);}})};
 try{const info=await inspectPngHeader(file,{png_max_bytes:size,max_dimension:ZIP_LIMITS.maxPreviewSide,max_pixels:ZIP_LIMITS.previewMaxPixels});return {ok:true,format:'png',width:info.width,height:info.height};}
 catch(error){throw problem(`Vista previa inválida: ${error.message.replace(/^PNG inválido: /,'')}`,422,'UM033');}
}
const VALIDATORS={ultramar:validateUltramarZip,pdf:validatePdf,preview:validatePreview};

export function createUltramarGateway({fetcher=fetch,logger=console,fixedLength=length=>new FixedLengthStream(length)}={}){
 return {async fetch(request,env,headers){
  const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json'}});
  const bearer=request.headers.get('authorization');
  if(!bearer?.startsWith('Bearer ')||/^Bearer wsc_/.test(bearer))return json({error:'Inicia sesión en Ultramar con tu GBA ID.',code:'UM030'},401);
  async function rpc(name,args){
   const result=await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`,{method:'POST',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:bearer,'Content-Type':'application/json'},body:JSON.stringify({...args,p_gateway_key:env.GATEWAY_KEY})});
   const body=await result.json().catch(()=>({}));
   if(!result.ok)throw problem(body.message||'No se pudo autorizar el archivo.',result.status===401||result.status===403?403:result.status===409?409:400,typeof body.code==='string'&&/^(UM\d{3}|40001|42501)$/.test(body.code)?body.code:'UM035');
   return body;
  }
  const url=new URL(request.url);
  const upload=url.pathname.match(new RegExp(`^/ultramar/uploads/(${UUID})/(ultramar|pdf|preview)$`,'i'));
  const download=url.pathname.match(new RegExp(`^/ultramar/files/(${UUID})/(ultramar|pdf|preview)$`,'i'));
  let key=null,stored=false;
  try{
   if(upload&&request.method==='POST'){
    const [,reservation,role]=upload,gate=await rpc('workspace_ultramar_upload_gate',{p_reservation_id:reservation,p_role:role});
    const size=Number(request.headers.get('x-file-size')),sha256=(request.headers.get('x-file-sha256')||'').toLowerCase(),declared=request.headers.get('content-length');
    if(size!==gate.size_bytes||(declared!==null&&Number(declared)!==size))throw problem('El tamaño no coincide con la reserva.',413,'UM031');
    if(sha256!==gate.sha256)throw problem('La huella no coincide con la reserva.',409,'UM032');
    if(!request.body)throw problem('Falta el archivo.',400,'UM031');
    key=gate.object_key;
    // Reintento: si un intento anterior ya guardó exactamente estos bytes, se reutilizan.
    const existing=await env.ORIGINALS.head(key);
    if(existing&&existing.size===size&&hex(existing.checksums?.sha256)===sha256){await request.body.cancel();}
    else{
     if(existing)await env.ORIGINALS.delete(key);
     const fixed=fixedLength(size),digest=Uint8Array.from(sha256.match(/.{2}/g),b=>parseInt(b,16)).buffer;
     const [,object]=await Promise.all([request.body.pipeTo(fixed.writable),env.ORIGINALS.put(key,fixed.readable,{httpMetadata:{contentType:MIME[role]},customMetadata:{sha256,role},sha256:digest,onlyIf:new Headers({'If-None-Match':'*'})})]);
     if(!object||object.size!==size||hex(object.checksums?.sha256)!==sha256)throw problem('No se pudo verificar la escritura.',502,'UM034');
    }
    stored=true;
    const read=async(offset,length)=>{const part=await env.ORIGINALS.get(key,{range:{offset,length}});if(!part?.body)throw problem('No se pudo leer el archivo guardado.',502,'UM034');return new Uint8Array(await part.arrayBuffer());};
    const validation=await VALIDATORS[role]({size,read});
    await rpc('workspace_ultramar_file_verified',{p_reservation_id:reservation,p_role:role,p_validation:validation});
    return json({rol:role,verificado:true,validacion:validation},201);
   }
   if(download&&request.method==='GET'){
    const [,version,role]=download,asset=await rpc('workspace_ultramar_file_access',{p_version_id:version,p_role:role});
    const object=await env.ORIGINALS.get(asset.object_key);
    if(!object?.body)throw problem('No se encontró el archivo.',404,'UM020');
    if(object.size!==asset.size_bytes||hex(object.checksums?.sha256)!==asset.sha256)throw problem('La integridad del archivo no coincide.',502,'UM034');
    return new Response(object.body,{headers:{...headers,'Content-Type':asset.mime_type,'Content-Length':String(asset.size_bytes),'X-Original-Sha256':asset.sha256,'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(asset.file_name)}`}});
   }
   return json({error:'Ruta no disponible.',code:'UM035'},404);
  }catch(failure){
   // Un archivo que no pasó la validación no se conserva; la reserva sigue abierta para reintentar.
   if(key&&stored&&failure.status===422)await env.ORIGINALS.delete(key).catch(()=>{});
   logger.error(JSON.stringify({message:'Ultramar gateway request failed',status:failure.status||502}));
   return json({error:failure.status?failure.message:'No se pudo completar la operación.',code:failure.code||'UM035'},failure.status||502);
  }
 }};
}
