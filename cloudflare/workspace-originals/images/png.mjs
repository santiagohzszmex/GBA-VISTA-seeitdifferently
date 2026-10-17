// Streaming PNG validation/decoding. Memory is bounded by chunks and two rows,
// never by the full raster. No SVG, external resources or metadata execution.
const signature=[137,80,78,71,13,10,26,10];
const table=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32(bytes,crc=0xffffffff){for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return crc>>>0;}
const view=b=>new DataView(b.buffer,b.byteOffset,b.byteLength);
function fail(reason){throw Error(`PNG inválido: ${reason}`);}
class Reader{
 constructor(stream){this.reader=stream.getReader();this.chunk=new Uint8Array();this.offset=0;}
 async piece(max){if(this.offset===this.chunk.length){const next=await this.reader.read();if(next.done)return null;this.chunk=next.value;this.offset=0;}const part=this.chunk.subarray(this.offset,Math.min(this.chunk.length,this.offset+max));this.offset+=part.length;return part;}
 async take(length){const out=new Uint8Array(length);let at=0;while(at<length){const part=await this.piece(length-at);if(!part)fail('archivo truncado');out.set(part,at);at+=part.length;}return out;}
 async end(){if(await this.piece(1))fail('datos después de IEND');}
 async cancel(){await this.reader.cancel().catch(()=>{});}
}
function paeth(a,b,c){const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;}
const passes=[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]];
export async function inspectPng(stream,policy){
 const r=new Reader(stream);let inflater,writer,source,decoding,decodeError,metadata={},header,palette=null,transparency=null,profile=null,total=0,idat=false,endedIdat=false,hasTransparent=false,seen=new Set();
 try{
  if((await r.take(8)).some((v,i)=>v!==signature[i]))fail('firma incorrecta');total=8;
  while(true){
   const prefix=await r.take(8);const size=view(prefix).getUint32(0),type=new TextDecoder().decode(prefix.subarray(4));total+=12+size;
   if(size>policy.png_max_bytes||total>policy.png_max_bytes||!/^[A-Za-z]{4}$/.test(type)||type[2]!==type[2].toUpperCase())fail('chunk fuera de límites');
   if(!header && type!=='IHDR')fail('IHDR debe ser primero');
   if(['IHDR','PLTE','tRNS','iCCP','sRGB','IEND'].includes(type)&&seen.has(type))fail('chunk duplicado');
   seen.add(type);if(type!=='IDAT'&&idat)endedIdat=true;
   let crc=crc32(prefix.subarray(4)),bytes;
   if(type==='IDAT'){
    if(endedIdat)fail('IDAT no contiguo');
    if(header.color===3&&!palette)fail('paleta ausente');
    if(!idat){
     inflater=new DecompressionStream('deflate');writer=inflater.writable.getWriter();
     decoding=(async()=>{
      source=new Reader(inflater.readable);const channels={0:1,2:3,3:1,4:2,6:4}[header.color],depth=header.depth,bpp=Math.max(1,Math.ceil(channels*depth/8));
      for(const [x,y,dx,dy] of header.interlace?passes:[[0,0,1,1]]){
       const width=Math.max(0,Math.ceil((header.width-x)/dx)),height=Math.max(0,Math.ceil((header.height-y)/dy));if(!width||!height)continue;
       const rowBytes=Math.ceil(width*channels*depth/8);let prev=new Uint8Array(rowBytes);
       for(let row=0;row<height;row++){
        const filter=(await source.take(1))[0];if(filter>4)fail('filtro inválido');const line=await source.take(rowBytes);
        for(let i=0;i<line.length;i++){
         const a=i>=bpp?line[i-bpp]:0,b=prev[i],c=i>=bpp?prev[i-bpp]:0;
         if(filter===1)line[i]+=a;else if(filter===2)line[i]+=b;else if(filter===3)line[i]+=Math.floor((a+b)/2);else if(filter===4)line[i]+=paeth(a,b,c);
        }
        for(let pixel=0;pixel<width;pixel++){
         const sample=c=>{const n=pixel*channels+c;if(depth===16)return(line[n*2]<<8)|line[n*2+1];if(depth===8)return line[n];return(line[Math.floor(n*depth/8)]>>>(8-depth-(n*depth)%8))&((1<<depth)-1);};
         if(header.color===3){const index=sample(0);if(index>=palette.length/3)fail('índice de paleta inválido');if(transparency&&index<transparency.length&&transparency[index]<255)hasTransparent=true;}
         else if(header.color===4||header.color===6){if(sample(channels-1)<(depth===16?65535:255))hasTransparent=true;}
         else if(transparency){if(header.color===0){if(sample(0)===view(transparency).getUint16(0))hasTransparent=true;}else if(sample(0)===view(transparency).getUint16(0)&&sample(1)===view(transparency).getUint16(2)&&sample(2)===view(transparency).getUint16(4))hasTransparent=true;}
        }
        prev=line;
       }
      }
      await source.end();
     })().catch(async error=>{decodeError=error;await source.cancel();writer.abort(error).catch(()=>{});});
    }
    idat=true;let left=size;while(left){const part=await r.piece(Math.min(left,4096));if(!part)fail('IDAT truncado');crc=crc32(part,crc);left-=part.length;if(decodeError)throw decodeError;await writer.write(part);}
   }else if(['IHDR','PLTE','tRNS','iCCP','sRGB','acTL'].includes(type)){
    if(size>262144)fail('metadatos excesivos');bytes=await r.take(size);crc=crc32(bytes,crc);
   }else{
    if(type[0]===type[0].toUpperCase()&&type!=='IEND')fail('chunk crítico desconocido');
    let left=size;while(left){const part=await r.piece(Math.min(left,65536));if(!part)fail('chunk truncado');crc=crc32(part,crc);left-=part.length;}
   }
   if(((crc^0xffffffff)>>>0)!==view(await r.take(4)).getUint32(0))fail('CRC incorrecto');
   if(type==='IHDR'){
    if(size!==13)fail('IHDR inválido');const v=view(bytes);header={width:v.getUint32(0),height:v.getUint32(4),depth:bytes[8],color:bytes[9],interlace:bytes[12]};
    const depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
    if(!header.width||!header.height||header.width>policy.max_dimension||header.height>policy.max_dimension||header.width*header.height>policy.max_pixels||!depths[header.color]?.includes(header.depth)||bytes[10]!==0||bytes[11]!==0||header.interlace>1)fail('dimensiones o codificación fuera de límites');
   }else if(type==='PLTE'){
    if(idat||!size||size%3||size>768||[0,4].includes(header.color)||(header.color===3&&size/3>2**header.depth))fail('paleta inválida');palette=bytes;
   }else if(type==='tRNS'){
    if(idat||(header.color===0&&size!==2)||(header.color===2&&size!==6)||(header.color===3&&(!palette||size>palette.length/3))||[4,6].includes(header.color))fail('transparencia inválida');transparency=bytes;
   }else if(type==='iCCP'){
    if(idat||seen.has('sRGB'))fail('perfil duplicado o fuera de orden');const zero=bytes.indexOf(0);if(zero<1||zero>79||bytes[zero+1]!==0)fail('perfil inválido');
    let offset=zero+2;const input=new ReadableStream({pull(c){if(offset===bytes.length){c.close();return;}const end=Math.min(bytes.length,offset+4096);c.enqueue(bytes.subarray(offset,end));offset=end;}}).pipeThrough(new DecompressionStream('deflate')),reader=input.getReader();let size=0;
    try{while(true){const n=await reader.read();if(n.done)break;size+=n.value.length;if(size>262144)fail('perfil excesivo');}}finally{await reader.cancel().catch(()=>{});}
    profile=new TextDecoder().decode(bytes.subarray(0,zero));
   }else if(type==='sRGB'){if(size!==1||bytes[0]>3||seen.has('iCCP')||idat)fail('sRGB inválido');profile='sRGB';}
   else if(type==='acTL')metadata.animated=true;
   if(type==='IEND'){
    if(size!==0||!idat)fail('IEND inválido o imagen vacía');await writer.close();await decoding;if(decodeError)throw decodeError;await r.end();break;
   }
  }
  // Ancillary animation is not executed. Only the standard PNG default raster is decoded.
  return{verification:'decoded',animation:metadata.animated?'unverified':'none',width:header.width,height:header.height,has_transparency:hasTransparent,color_profile:profile||'sRGB (asumido)',size_bytes:total};
 }catch(error){await source?.cancel();await writer?.abort(error).catch(()=>{});await r.cancel();if(decoding)await decoding;throw decodeError||error;}
}
