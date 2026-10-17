import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {crc32} from '../cloudflare/workspace-originals/images/png.mjs';
import {inspectLayered} from '../cloudflare/workspace-originals/images/layered.mjs';
let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++;};
function zip(entries){const locals=[],central=[];let offset=0;for(const entry of entries){const name=Buffer.from(entry.name),data=Buffer.from(entry.data||''),method=entry.method||0,compressed=method===8?deflateRawSync(data):data,crc=(crc32(data)^0xffffffff)>>>0;
 const l=Buffer.alloc(30);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(method,8);l.writeUInt32LE(crc,14);l.writeUInt32LE(compressed.length,18);l.writeUInt32LE(data.length,22);l.writeUInt16LE(name.length,26);locals.push(l,name,compressed);
 const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(method,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(compressed.length,20);c.writeUInt32LE(entry.plain??data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=l.length+name.length+compressed.length;}
 const dir=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(dir.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,dir,end]);}
const manifest={name:'maindoc.xml',data:'<?xml version="1.0"?><DOC><IMAGE name="SYNTHETIC"/></DOC>',method:8};
const base=[{name:'mimetype',data:'application/x-krita'},manifest,{name:'mergedimage.png',data:'synthetic placeholder: not rendered'}];
const inspect=entries=>inspectLayered(new Blob([zip(entries)]),'kra',{layered_max_bytes:262144000});
eq((await inspect(base)).verification,'zip_manifest');
for(const [entries,re]of [
 [[...base,{name:'nested.zip',data:'nested'}],/anidado/],
 [[...base,{name:'payload',data:'x',plain:4000000000}],/desproporcionado/],
 [[...base,{name:'../escape',data:'x'}],/inseguro/],
 [[...base,{name:'mimetype',data:'duplicate'}],/duplicado/],
 [[base[0],{...manifest,data:'<DOC><IMAGE/>'},base[2]],/malformado/],
 [[base[0],{...manifest,data:'<!ENTITY x SYSTEM "file:///secret"><DOC><IMAGE/></DOC>'},base[2]],/malformado/],
 [[{...base[0],data:'not-krita'},...base.slice(1)],/KRA/],
 [[base[0],{...manifest,data:'<DOC><IMAGE/>'+' '.repeat(300000)+'</DOC>'},base[2]],/excesivo/]
]){await assert.rejects(inspect(entries),re);checks++;}
const broken=zip(base);broken[0]^=1;await assert.rejects(inspectLayered(new Blob([broken]),'kra'),/inválida/);checks++;
const truncated=zip(base).subarray(0,-1);await assert.rejects(inspectLayered(new Blob([truncated]),'kra'),/incompleto/);checks++;
console.log(`PASS: ${checks} bounded KRA/ZIP assertions (synthetic manifests, nested ZIP, expansion ratio, malformed XML, CRC/header and unsafe names).`);
