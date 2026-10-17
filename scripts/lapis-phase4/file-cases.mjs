import fs from 'node:fs/promises';
import {makePng,pngChunk} from '../../tests/helpers/lapis-png.mjs';
const root='/private/tmp/workspace-lapis-phase3-fixtures',original=await fs.readFile(`${root}/original.png`),near=18*1048576;
await fs.writeFile(`${root}/near-limit.png`,Buffer.concat([original.subarray(0,-12),pngChunk('lpAD',Buffer.alloc(near-original.length-12)),original.subarray(-12)]));
await fs.writeFile(`${root}/corrupt-raster.png`,Buffer.concat([original.subarray(0,33),pngChunk('IDAT',Buffer.from('intentionally damaged zlib raster')),pngChunk('IEND',Buffer.alloc(0))]));
await fs.writeFile(`${root}/one-pixel.png`,makePng({width:1,height:1,raw:Buffer.from([0,255,0,0,255])}));
await fs.writeFile(`${root}/over-40MP.png`,makePng({width:8000,height:5001}));
console.log('Synthetic size/corrupt/pixel fixtures prepared; no illustrator samples.');
