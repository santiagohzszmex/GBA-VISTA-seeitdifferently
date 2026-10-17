const verified=new Set();
export function verifyDisplayPng(blob,sha256,{signal}={}){
 if(signal?.aborted)return Promise.reject(new DOMException('Cancelado','AbortError'));
 if(sha256&&verified.has(sha256))return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./pngDisplay.worker.mjs',import.meta.url),{type:'module'});
  const finish=error=>{worker.terminate();signal?.removeEventListener('abort',abort);if(error)reject(error);else{if(sha256){verified.add(sha256);while(verified.size>32)verified.delete(verified.values().next().value);}resolve();}};
  const abort=()=>finish(new DOMException('Cancelado','AbortError'));
  signal?.addEventListener('abort',abort,{once:true});
  const failed=()=>finish(Error('No se pudo mostrar la imagen; descarga el original para revisarlo.'));
  worker.onerror=failed;worker.onmessage=({data})=>data.valid?finish():failed();
  worker.postMessage({blob,policy:{png_max_bytes:Math.max(18874368,blob.size),max_pixels:40000000,max_dimension:32768}});
 });
}
