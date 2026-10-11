const MAX_BYTES = 25 * 1024 * 1024;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export function detectMime(bytes) {
  const text = String.fromCharCode(...bytes.subarray(0, 32));
  if (text.startsWith('%PDF-')) return 'application/pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10') return 'image/png';
  if (/^GIF8[79]a/.test(text)) return 'image/gif';
  if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') return 'image/webp';
  if (text.startsWith('II*\0') || text.startsWith('MM\0*')) return 'image/tiff';
  if (text.slice(4, 8) === 'ftyp') {
    const brand = text.slice(8, 12);
    if (['avif', 'avis'].includes(brand)) return 'image/avif';
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
    if (['mif1', 'msf1'].includes(brand)) return 'image/heif';
  }
  return null;
}
function problem(message, status = 400) { return Object.assign(new Error(message), { status }); }
async function peekAndStream(request, expectedSize) {
  const reader = request.body?.getReader();
  if (!reader) throw problem('Selecciona un archivo.');
  const leading = []; let readBytes = 0, done = false;
  try {
    while (readBytes < 32 && !done) {
      const next = await reader.read(); done = next.done;
      if (next.value) { readBytes += next.value.byteLength; if (readBytes > expectedSize) throw problem('El tamaño del original no coincide.',413); leading.push(next.value); }
    }
  } catch (failure) { await reader.cancel(); reader.releaseLock(); throw failure; }
  const head = new Uint8Array(Math.min(readBytes,32)); let headOffset = 0;
  for (const chunk of leading) { const part = chunk.subarray(0,head.byteLength-headOffset); head.set(part,headOffset); headOffset += part.byteLength; }
  let delivered = 0;
  return {head,stream:new ReadableStream({
    async pull(controller) {
      try {
        const next = leading.length ? {value:leading.shift(),done:false} : done ? {done:true} : await reader.read();
        if (next.done) { done=true;if(delivered!==expectedSize)throw problem('El tamaño del original no coincide.',413);reader.releaseLock();controller.close();return; }
        delivered += next.value.byteLength;
        if (delivered > expectedSize) throw problem('El tamaño del original no coincide.',413);
        controller.enqueue(next.value);
      } catch (failure) { await reader.cancel().catch(()=>{}); try { reader.releaseLock(); } catch {} controller.error(failure); }
    },
    async cancel(reason) { await reader.cancel(reason).catch(()=>{});try { reader.releaseLock(); } catch {} }
  })};
}
const hex = buffer => buffer ? [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2,'0')).join('') : '';
export function createGateway(fetcher = fetch, logger = console, fixedLength = length => new FixedLengthStream(length)) {
  return {
    async fetch(request, env) {
      const origin = request.headers.get('origin');
      const origins = (env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim());
      const cors = origin && origins.includes(origin) ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-File-Name, X-File-Size, X-File-Sha256', 'Access-Control-Expose-Headers': 'X-Original-Sha256', 'Access-Control-Max-Age': '600' } : {};
      const headers = { ...cors, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox" };
      const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
      if (origin && !origins.includes(origin)) return json({error:'Origen no autorizado.'},403);
      if (request.method === 'OPTIONS') return new Response(null, {status:204,headers});
      if (!env.ORIGINALS || !env.GATEWAY_KEY || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return json({error:'Almacenamiento privado pendiente de conexión.'},503);
      const bearer = request.headers.get('authorization');
      if (!bearer?.startsWith('Bearer ')) return json({error:'Inicia sesión para acceder a los archivos.'},401);
      async function rpc(name, args) {
        const result = await fetcher(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {method:'POST', headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:bearer,'Content-Type':'application/json'},body:JSON.stringify({...args,p_gateway_key:env.GATEWAY_KEY})});
        const body = await result.json();
        if (!result.ok) throw problem(body.message || 'No se pudo autorizar el archivo.', result.status === 401 || result.status === 403 ? 403 : 400);
        return body;
      }
      let incoming;
      try {
        const url = new URL(request.url);
        const upload = url.pathname.match(new RegExp(`^/references/(${UUID})$`, 'i'));
        const read = url.pathname.match(new RegExp(`^/originals/(${UUID})$`, 'i'));
        if (upload && request.method === 'POST') {
          const p_reference_id = upload[1];
          const gate = await rpc('workspace_original_gate',{p_reference_id});
          const size = Number(request.headers.get('x-file-size'));
          const sha256 = request.headers.get('x-file-sha256') || '';
          const declared = Number(request.headers.get('content-length'));
          if (!Number.isInteger(size) || size < 1 || size > Math.min(MAX_BYTES,gate.limit) || declared > MAX_BYTES) throw problem('El archivo supera los 25 MB o no declara su tamaño.',413);
          if (!/^[a-f0-9]{64}$/.test(sha256)) throw problem('Falta la huella de integridad del original.');
          incoming = await peekAndStream(request,size);
          const mime = detectMime(incoming.head);
          if (!mime || (mime === 'application/pdf' && gate.kind !== 'moodboard')) throw problem('PDF sólo para moodboards; el archivo debe ser una imagen original.');
          const requestedMime = request.headers.get('content-type')?.split(';')[0];
          if (requestedMime !== mime && !(['image/heic','image/heif'].includes(requestedMime) && ['image/heic','image/heif'].includes(mime))) throw problem('El contenido no coincide con el formato declarado.');
          let name; try { name = decodeURIComponent(request.headers.get('x-file-name') || ''); } catch { throw problem('Nombre de archivo inválido.'); }
          if (!name || name.length > 240) throw problem('Usa un nombre de archivo de hasta 240 caracteres.');
          const digest = Uint8Array.from(sha256.match(/.{2}/g),value => parseInt(value,16)).buffer;
          const reservation = await rpc('workspace_original_begin',{p_reference_id,p_name:name,p_mime:mime,p_size:size,p_sha256:sha256});
          let written = false, pumping;const abort = new AbortController();
          try {
            const fixed = fixedLength(size);
            pumping = incoming.stream.pipeTo(fixed.writable,{signal:abort.signal});
            const storing = env.ORIGINALS.put(reservation.object_key,fixed.readable,{httpMetadata:{contentType:mime},customMetadata:{sha256},sha256:digest,onlyIf:new Headers({'If-None-Match':'*'}),storageClass:'Standard'});
            const [,object] = await Promise.all([pumping,storing]);
            if (!object || object.size !== size || hex(object.checksums?.sha256) !== sha256) throw problem('No se pudo verificar la escritura del original.',502);
            written = true;
            await rpc('workspace_original_finish',{p_id:reservation.id,p_success:true});
            return json({id:reservation.id,verified:true,sha256,size_bytes:size},201);
          } catch (failure) {
            abort.abort();await pumping?.catch(()=>{});
            // A failed commit is quarantined and continues to count towards capacity.
            // Only confirmed deletion can release a reservation; never reuse its key.
            if (!written) {
              try { await env.ORIGINALS.delete(reservation.object_key); await rpc('workspace_original_finish',{p_id:reservation.id,p_success:false}); } catch {}
            }
            throw failure;
          }
        }
        if (read && request.method === 'GET') {
          const download = url.searchParams.get('download') === '1';
          const asset = await rpc('workspace_original_access',{p_id:read[1],p_download:download});
          const object = await env.ORIGINALS.get(asset.object_key);
          if (!object?.body) throw problem('No se encontró el original.',404);
          if (object.size !== asset.size_bytes || hex(object.checksums?.sha256) !== asset.sha256) throw problem('La integridad del original no coincide.',502);
          return new Response(object.body,{headers:{...headers,'Content-Type':asset.mime_type,'Content-Length':String(asset.size_bytes),'X-Original-Sha256':asset.sha256,'Content-Disposition':`${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(asset.file_name)}`}});
        }
        return json({error:'Ruta no disponible.'},404);
      } catch (failure) { if (incoming && !incoming.stream.locked) await incoming.stream.cancel().catch(()=>{}); logger.error(JSON.stringify({message:'Original gateway request failed',status:failure.status || 502})); return json({error:failure.status ? failure.message : 'No se pudo guardar o abrir el archivo. Inténtalo de nuevo.'},failure.status || 502); }
    }
  };
}
export default createGateway();
