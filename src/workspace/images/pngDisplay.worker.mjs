import {inspectPng} from '../../../cloudflare/workspace-originals/images/png.mjs';
// Some browser decoders report onload for a damaged raster and paint it blank.
// Verify the bounded PNG stream away from the UI thread before displaying it.
self.onmessage=async({data:{blob,policy}})=>{try{const info=await inspectPng(blob.stream(),policy);self.postMessage({valid:true,info});}catch{self.postMessage({valid:false});}};
