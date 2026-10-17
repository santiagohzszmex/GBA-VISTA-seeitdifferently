import {inspectPngHeader} from '../../../cloudflare/workspace-originals/images/pngHeader.mjs';
export const LAYER_FORMATS={psd:'PSD',tiff:'TIFF',kra:'KRA',procreate:'PROCREATE',afphoto:'AFPHOTO',clip:'CLIP'};
export const emptyNote=()=>({type:'doc',attrs:{schemaVersion:2},content:[{type:'paragraph'}]});
export const fileSize=n=>n>=1048576?`${(n/1048576).toLocaleString('es-MX',{maximumFractionDigits:1})} MiB`:`${Math.ceil((n||0)/1024)} KiB`;
export function layerFormat(name){const ext=name.toLowerCase().split('.').pop();return ext==='tif'?'tiff':ext;}
export function validateSelection(file,role,policy,spec={}){
 if(!policy?.images_enabled)throw Error('Las entregas de imagen todavía no están habilitadas.');
 const limit=role==='png'?policy.png_max_bytes:policy.layered_max_bytes;
 if(!Number.isSafeInteger(limit)||!file?.size)throw Error('No se pudo consultar el límite o el archivo está vacío.');
 if(file.size>limit)throw Error(`El archivo supera el límite de ${fileSize(limit)} de la política.`);
 if(role==='png'&&!/\.png$/i.test(file.name))throw Error('Formato no admitido. Elige un PNG final.');
 const format=role==='png'?'png':layerFormat(file.name);
 if(role!=='png'&&!(spec.layer_formats||Object.keys(LAYER_FORMATS)).includes(format))throw Error('Formato no admitido por la ficha de esta asignación.');
 return format;
}
const hashes=new WeakMap();
export async function hashFile(file,{signal,onProgress=()=>{}}={}){
 if(hashes.has(file))return hashes.get(file);
 const value=await new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./hash.worker.js',import.meta.url),{type:'module'});
  const finish=(callback,value)=>{worker.terminate();signal?.removeEventListener('abort',cancel);callback(value);};
  const cancel=()=>finish(reject,new DOMException('Operación pausada','AbortError'));
  if(signal?.aborted){cancel();return;}signal?.addEventListener('abort',cancel,{once:true});
  worker.onmessage=({data})=>{if(data.error)finish(reject,Error(data.error));else if(data.sha256)finish(resolve,data.sha256);else onProgress(data);};worker.onerror=()=>finish(reject,Error('No se pudo calcular la huella del original.'));worker.postMessage({file});
 });hashes.set(file,value);return value;
}
export async function inspectClientPng(file,policy){
 const header=await inspectPngHeader(file,policy);let decoded=false,has_transparency=null,color_profile='sin perfil declarado',url;
 // Only recognize the presence/type of a color declaration; never read EXIF/GPS.
 for(let at=33,count=0;at+8<file.size&&count++<1024;){const b=new Uint8Array(await file.slice(at,at+8).arrayBuffer()),v=new DataView(b.buffer),type=new TextDecoder().decode(b.subarray(4));if(['IDAT','IEND'].includes(type))break;if(type==='sRGB')color_profile='sRGB';if(type==='iCCP')color_profile='perfil incorporado (sin interpretar)';const size=v.getUint32(0);if(size>file.size-at-12)break;at+=12+size;}
 try{
  url=URL.createObjectURL(file);const image=new Image();image.src=url;await new Promise((yes,no)=>{image.onload=yes;image.onerror=no;});
  if(image.naturalWidth!==header.width||image.naturalHeight!==header.height)throw Error('Dimensiones locales distintas');
  const canvas=document.createElement('canvas');canvas.width=header.width;canvas.height=Math.min(128,header.height);const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('Canvas no disponible');has_transparency=false;
  for(let y=0;y<header.height;y+=canvas.height){const rows=Math.min(canvas.height,header.height-y);context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,y,header.width,rows,0,0,header.width,rows);const rgba=context.getImageData(0,0,header.width,rows).data;for(let i=3;i<rgba.length;i+=4)if(rgba[i]<255){has_transparency=true;break;}if(has_transparency)break;await new Promise(resolve=>setTimeout(resolve,0));}
  canvas.width=canvas.height=0;decoded=true;
 }catch{has_transparency=null;}finally{if(url)URL.revokeObjectURL(url);}
 return {...header,decoded,has_transparency,color_profile};
}
export function qualityChecks(asset,spec,client){
 const checks=[
  {key:'png',label:'Cabecera PNG y huella del original',passed:asset?.status==='validated'},
  {key:'decode',label:'Decodificación local',passed:client?.decoded===true},
  {key:'dimensions',label:'Tamaño mínimo de la ficha',passed:!!asset&&(!spec.min_width||asset.width>=spec.min_width)&&(!spec.min_height||asset.height>=spec.min_height)},
  {key:'background',label:'Fondo solicitado',passed:spec.background==='any'||!!client?.decoded&&(spec.background==='transparent'?client.has_transparency===true:client.has_transparency===false)},
  {key:'profile',label:'Perfil declarado sRGB',passed:client?.color_profile==='sRGB'}];
 return {checks,all_passed:checks.every(x=>x.passed),client_reported:true};
}
export function canSendImage({editable,png,layered,spec,hasLayers,uploading}){
 if(!editable)return 'Esta entrega está en revisión o en solo lectura.';
 if(uploading)return 'Espera a que terminen las subidas antes de enviar.';
 if(png?.status!=='validated')return 'Añade y termina de subir el PNG final.';
 if((spec.layer_policy==='always'||spec.layer_policy==='if_present'&&hasLayers)&&layered?.status!=='validated')return 'Falta el archivo con capas requerido por la ficha.';
 return '';
}
export function uploadError(error){
 const text=error?.message||'No se pudo subir el archivo.';
 if(error?.name==='AbortError')return 'Subida pausada. Puedes reanudarla con el mismo archivo.';
 if(/venc|caduc|sesión terminó/i.test(text))return 'La sesión de subida caducó. Selecciona el archivo para iniciar una nueva subida.';
 if(/fetch|network|conexión|connection|internet/i.test(text)||globalThis.navigator?.onLine===false)return 'Sin conexión. Tu progreso se conserva; reanuda cuando vuelvas a tener conexión.';
 return text;
}
