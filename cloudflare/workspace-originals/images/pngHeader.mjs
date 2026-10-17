// Phase 3 structural verification only. No raster decode, EXIF/GPS or ICC interpretation.
export async function inspectPngHeader(file,policy){
 const fail=message=>{throw Error(`PNG inválido: ${message}`);};
 if(!file||file.size<57)fail('archivo truncado');
 if(file.size>policy.png_max_bytes)fail('tamaño fuera del límite de la política');
 const head=new Uint8Array(await file.slice(0,33).arrayBuffer()),tail=new Uint8Array(await file.slice(file.size-12,file.size).arrayBuffer());
 const v=new DataView(head.buffer,head.byteOffset,head.byteLength),text=b=>new TextDecoder().decode(b);
 if(head.length!==33||head.subarray(0,8).some((b,i)=>b!==[137,80,78,71,13,10,26,10][i])||v.getUint32(8)!==13||text(head.subarray(12,16))!=='IHDR')fail('firma o IHDR incorrecto');
 const width=v.getUint32(16),height=v.getUint32(20),depth=head[24],color_type=head[25];
 const depths={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
 if(!width||!height||width>policy.max_dimension||height>policy.max_dimension||width*height>policy.max_pixels||!depths[color_type]?.includes(depth)||head[26]!==0||head[27]!==0||head[28]>1)fail('dimensiones o codificación fuera de límites');
 if(tail.length!==12||new DataView(tail.buffer,tail.byteOffset).getUint32(0)!==0||text(tail.subarray(4,8))!=='IEND'||tail.subarray(8).some((b,i)=>b!==[174,66,96,130][i]))fail('IEND ausente o incorrecto');
 return {verification:'header',width,height,color_type,has_transparency:null,color_profile:null,raster_verified:false,size_bytes:file.size};
}
