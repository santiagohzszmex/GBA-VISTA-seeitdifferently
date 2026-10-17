// Replaceable processor contract. No original is ever published or overwritten.
// Output metadata is stripped independently of the provider's defaults.
const bytes=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
export function cleanWebP(input){
 const data=new Uint8Array(input),text=(start,n)=>new TextDecoder().decode(data.subarray(start,start+n));
 if(data.length<20||text(0,4)!=='RIFF'||text(8,4)!=='WEBP'||bytes(data).getUint32(4,true)+8!==data.length)throw Error('Invalid preview WebP');
 const chunks=[];let length=4,width,height;
 for(let at=12;at<data.length;){
  if(at+8>data.length)throw Error('Truncated preview');const type=text(at,4),size=bytes(data).getUint32(at+4,true),end=at+8+size+(size%2);if(end>data.length)throw Error('Truncated preview chunk');
  if(!['EXIF','XMP '].includes(type)){
   const part=data.slice(at,end);if(type==='VP8X'){
    if(size!==10)throw Error('Invalid VP8X');part[8]&=~(0x08|0x04);width=1+part[12]+(part[13]<<8)+(part[14]<<16);height=1+part[15]+(part[16]<<8)+(part[17]<<16);
   }else if(type==='VP8 '){if(size<10||data[at+11]!==0x9d||data[at+12]!==1||data[at+13]!==0x2a)throw Error('Invalid VP8');width=bytes(data).getUint16(at+14,true)&0x3fff;height=bytes(data).getUint16(at+16,true)&0x3fff;}
   else if(type==='VP8L'){if(size<5||data[at+8]!==0x2f)throw Error('Invalid VP8L');const bits=bytes(data).getUint32(at+9,true);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
   chunks.push(part);length+=part.length;
  }
  at=end;
 }
 if(!width||!height)throw Error('Preview has no raster');const result=new Uint8Array(length+8);result.set(new TextEncoder().encode('RIFF'),0);bytes(result).setUint32(4,length,true);result.set(new TextEncoder().encode('WEBP'),8);let at=12;for(const part of chunks){result.set(part,at);at+=part.length;}
 return {body:result,width,height,metadata_stripped:true};
}
export function cloudflareProcessor(images){return {
 id:'cf-images-webp-v1',
 async generate({source,policy,asset}){
  if(asset?.metadata?.animation==='unverified')throw Object.assign(Error('Animation preview not verified'),{code:'animation_unverified'});
  if(!images)throw Object.assign(Error('Preview processor unavailable'),{code:'processor_unavailable'});
  const results=[];
  for(const [kind,width,height]of [['thumbnail',320,400],['preview',1600,2000]]){
   const output=await images.input(await source()).transform({width,height,fit:'contain'}).output({format:'image/webp',quality:85,anim:false});
   const response=output.response(),reader=response.body.getReader(),parts=[];let size=0;
   try{while(true){const n=await reader.read();if(n.done)break;size+=n.value.length;if(size>policy.derivative_max_bytes)throw Error('Preview exceeds configured size');parts.push(n.value);}}finally{await reader.cancel().catch(()=>{});}
   const encoded=new Uint8Array(size);let at=0;for(const part of parts){encoded.set(part,at);at+=part.length;}
   const clean=cleanWebP(encoded);
   // Do not silently rotate/crop a preview: note coordinates use the original raster.
   if(asset&&Math.abs(clean.width*asset.height-clean.height*asset.width)>Math.max(asset.width,asset.height)*2)throw Error('Preview aspect ratio changed');
   results.push({kind,...clean});
  }
  return results;
 }
};}
