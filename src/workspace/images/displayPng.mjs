const verified=new Map();
export function verifyDisplayPng(blob,sha256,{signal}={}){
 if(signal?.aborted)return Promise.reject(new DOMException('Cancelado','AbortError'));
 if(sha256&&verified.has(sha256))return Promise.resolve(verified.get(sha256));
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./pngDisplay.worker.mjs',import.meta.url),{type:'module'});
  const finish=(error,info={})=>{worker.terminate();signal?.removeEventListener('abort',abort);if(error)reject(error);else{if(sha256){verified.set(sha256,info);while(verified.size>32)verified.delete(verified.keys().next().value);}resolve(info);}};
  const abort=()=>finish(new DOMException('Cancelado','AbortError'));
  signal?.addEventListener('abort',abort,{once:true});
  const failed=()=>finish(Error('No se pudo mostrar la imagen; descarga el original para revisarlo.'));
  worker.onerror=failed;worker.onmessage=({data})=>data.valid?finish(null,data.info):failed();
  worker.postMessage({blob,policy:{png_max_bytes:Math.max(18874368,blob.size),max_pixels:40000000,max_dimension:32768}});
 });
}

// ImageBitmap selects the default (first) animation frame. The original stays untouched.
export async function firstPngFrame(blob){
 const bitmap=await createImageBitmap(blob);let canvas;
 try{canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);return await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('No se pudo mostrar el primer cuadro.')),'image/png'));}
 finally{bitmap.close();if(canvas)canvas.width=canvas.height=0;}
}
