// Bounded container identification only. Never renders or extracts layer pixels.
const text=b=>new TextDecoder().decode(b);
const read=async(blob,start,size)=>new Uint8Array(await blob.slice(start,start+size).arrayBuffer());
function invalid(message){throw Error(message);}
export async function inspectLayered(blob,format){
 const head=await read(blob,0,26),view=new DataView(head.buffer,head.byteOffset,head.byteLength);
 if(format==='psd'){
  if(head.length<26 || text(head.slice(0,4))!=='8BPS' || view.getUint16(4)!==1 || head.slice(6,12).some(Boolean))invalid('Cabecera PSD inválida o PSB no soportado');
  const channels=view.getUint16(12),height=view.getUint32(14),width=view.getUint32(18),depth=view.getUint16(22),mode=view.getUint16(24);
  if(channels<1||channels>56||!width||!height||width>30000||height>30000||![1,8,16,32].includes(depth)||mode>9)invalid('Campos PSD inválidos');
  return {verification:'header',format,width,height,channels,depth,layers:'author_declared',bytesRead:26};
 }
 if(format==='tiff'){
  const little=text(head.slice(0,2))==='II',big=text(head.slice(0,2))==='MM';
  if(head.length<8||(!little&&!big)||view.getUint16(2,little)!==42)invalid('TIFF clásico inválido; BigTIFF requiere soporte explícito');
  const offset=view.getUint32(4,little);
  if(offset<8||offset+2>blob.size)invalid('Directorio TIFF fuera del archivo');
  const countBytes=await read(blob,offset,2),count=new DataView(countBytes.buffer).getUint16(0,little);
  if(!count || offset+2+count*12+4>blob.size)invalid('Directorio TIFF truncado');
  return {verification:'header',format,entries:count,layers:'author_declared',bytesRead:28};
 }
 if(format==='kra'){
  // Central directory <=256KiB, <=2000 entries; only the <=128 byte mimetype is read.
  const tail=await read(blob,Math.max(0,blob.size-65557),65557);let end=-1;
  for(let i=tail.length-22;i>=0;i--)if(new DataView(tail.buffer).getUint32(i,true)===0x06054b50 && i+22+new DataView(tail.buffer).getUint16(i+20,true)===tail.length){end=i;break;}
  if(end<0)invalid('ZIP KRA incompleto');
  const e=new DataView(tail.buffer),entries=e.getUint16(end+10,true),size=e.getUint32(end+12,true),offset=e.getUint32(end+16,true);
  if(e.getUint16(end+4,true)||e.getUint16(end+6,true)||e.getUint16(end+8,true)!==entries||!entries||entries>2000||size>262144||offset+size>blob.size-tail.length+end)invalid('ZIP multidisco, ZIP64 o directorio excesivo no soportado');
  const dir=await read(blob,offset,size),dv=new DataView(dir.buffer);let cursor=0,meta,names=new Set();
  for(let i=0;i<entries;i++){
   if(cursor+46>size||dv.getUint32(cursor,true)!==0x02014b50)invalid('Directorio ZIP inválido');
   const flags=dv.getUint16(cursor+8,true),method=dv.getUint16(cursor+10,true),compressed=dv.getUint32(cursor+20,true),plain=dv.getUint32(cursor+24,true),length=dv.getUint16(cursor+28,true),extra=dv.getUint16(cursor+30,true),comment=dv.getUint16(cursor+32,true),local=dv.getUint32(cursor+42,true);
   if(cursor+46+length+extra+comment>size||local+30>offset||flags&1)invalid('Entrada ZIP inválida o cifrada');
   const name=text(dir.slice(cursor+46,cursor+46+length));
   if(!name||names.has(name)||name.startsWith('/')||name.includes('\\')||name.includes('\0')||name.split('/').includes('..'))invalid('Nombre ZIP inseguro o duplicado');
   names.add(name);if(name==='mimetype')meta={method,compressed,plain,local};cursor+=46+length+extra+comment;
  }
  if(cursor!==size||!names.has('maindoc.xml')||!names.has('mergedimage.png')||!meta||meta.method!==0||meta.plain>128||meta.compressed!==meta.plain)invalid('Manifiesto KRA no reconocido (no basta con un ZIP)');
  const lh=await read(blob,meta.local,30),lv=new DataView(lh.buffer);
  if(lv.getUint32(0,true)!==0x04034b50||lv.getUint16(8,true)!==0)invalid('Entrada mimetype inválida');
  const len=lv.getUint16(26,true),extra=lv.getUint16(28,true),begin=meta.local+30+len+extra;
  if(begin+meta.plain>offset||text(await read(blob,meta.local+30,len))!=='mimetype'||text(await read(blob,begin,meta.plain))!=='application/x-krita')invalid('No es un contenedor KRA reconocido');
  return {verification:'zip_manifest',format,entries,layers:'author_declared',bytesRead:tail.length+size+30+len+meta.plain};
 }
 if(['procreate','afphoto','clip'].includes(format))return {verification:'unverified',format,layers:'author_declared',bytesRead:head.length};
 invalid('Formato de capas no admitido');
}
