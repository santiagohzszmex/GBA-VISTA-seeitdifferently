import fs from 'node:fs/promises';
import path from 'node:path';
import {deflateSync} from 'node:zlib';
import {pngChunk} from '../tests/helpers/lapis-png.mjs';
const root=process.env.LAPIS_FIXTURE_DIR;
if(!root)throw Error('Set LAPIS_FIXTURE_DIR to a dedicated synthetic test directory.');
await fs.mkdir(root,{recursive:true});
const width=4000,height=5000,row=width*4+1,raw=Buffer.alloc(row*height),header=Buffer.alloc(13);
header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
let seed=42,values=new Uint8Array(width/2);
for(let y=0;y<height;y++){
 if(y%2===0)for(let x=0;x<values.length;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;values[x]=seed>>>24;}
 for(let x=0;x<width;x++){const at=y*row+1+x*4,n=values[x>>1];raw[at]=n;raw[at+1]=(n+64)&255;raw[at+2]=(n+128)&255;raw[at+3]=x<50||y<50?0:255;}
}
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',header),pngChunk('IDAT',deflateSync(raw)),pngChunk('IEND',Buffer.alloc(0))]);
await fs.writeFile(path.join(root,'original.png'),png);
await fs.writeFile(path.join(root,'SYNTHETIC.afphoto'),Buffer.concat([Buffer.from('SYNTHETIC OPAQUE ATTACHMENT\n'),Buffer.alloc(8388608)]));
await fs.writeFile(path.join(root,'corrupt-raster.png'),Buffer.concat([png.subarray(0,33),pngChunk('IDAT',Buffer.from('not zlib')),pngChunk('IEND',Buffer.alloc(0))]));
await fs.writeFile(path.join(root,'unsupported.svg'),'<svg xmlns="http://www.w3.org/2000/svg"/>');
await fs.writeFile(path.join(root,'corrupt.png'),'not a PNG');
await fs.writeFile(path.join(root,'too-large.png'),Buffer.alloc(19000000));
console.log(`Generated synthetic 4000 × 5000 RGBA PNG: ${png.length} bytes. No illustrator files or production data.`);
