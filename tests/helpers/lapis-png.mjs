import {deflateSync} from 'node:zlib';
import {crc32} from '../../cloudflare/workspace-originals/images/png.mjs';
export const pngChunk=(type,body)=>{const t=Buffer.from(type),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(body.length);crc.writeUInt32BE((crc32(Buffer.concat([t,body]))^0xffffffff)>>>0);return Buffer.concat([size,t,body,crc]);};
export function makePng({width=2,height=1,color=6,depth=8,raw=Buffer.from([0,255,0,0,255,0,255,0,0]),extra=[],suffix=Buffer.alloc(0)}={}){
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=depth;header[9]=color;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),...extra,pngChunk('IDAT',deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0)),suffix]);
}
