import {openAsBlob} from 'node:fs';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {inspectLayered} from './validate-layered.mjs';
const [file,format]=process.argv.slice(2),before=process.memoryUsage().rss,start=performance.now();
const blob=await openAsBlob(file);let result;
if(format==='png'){
 const meta=await sharp(file,{limitInputPixels:40000000,failOn:'warning'}).metadata();
 const preview=await sharp(file,{limitInputPixels:40000000,failOn:'warning'}).resize({width:1600,height:2000,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();
 const thumbnail=await sharp(file,{limitInputPixels:40000000,failOn:'warning'}).resize({width:320,height:400,fit:'inside',withoutEnlargement:true}).webp({quality:80}).toBuffer();
 const previewMeta=await sharp(preview).metadata();const previewStats=await sharp(preview).stats();
 result={width:meta.width,height:meta.height,hasAlphaChannel:meta.hasAlpha,previewBytes:preview.length,thumbnailBytes:thumbnail.length,previewAlpha:previewMeta.hasAlpha,previewIsOpaque:previewStats.isOpaque,metadataStripped:!previewMeta.exif&&!previewMeta.xmp&&!previewMeta.iptc};
}else result=await inspectLayered(blob,format);
console.log(JSON.stringify({file:file.split('/').pop(),format,bytes:blob.size,synthetic:!process.argv.includes('--real'),elapsedMs:Number((performance.now()-start).toFixed(3)),baselineRssMiB:Math.round(before/1048576),peakProcessRssMiB:Math.round(process.resourceUsage().maxRSS/1024),...result}));
