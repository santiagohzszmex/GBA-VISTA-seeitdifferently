import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const out=process.argv[2];if(!out)throw Error('Usage: node generate-synthetic.mjs OUTPUT_DIRECTORY');
await fs.mkdir(out,{recursive:true});
const cases=[];const width=4000,height=5000;
for(const mb of [5,15,25,50]){
 const raw=Buffer.alloc(width*height*4);let state=0x12345678;
 const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return state>>>0;};
 const noisy=Math.min(width*height,Math.floor(mb*1000000/3.25));
 for(let i=0;i<width*height;i++){
  const x=i%width,y=Math.floor(i/width),j=i*4,v=i<noisy?random():0;
  raw[j]=i<noisy?v&255:x%256;raw[j+1]=i<noisy?v>>>8&255:y%256;raw[j+2]=i<noisy?v>>>16&255:(x+y)%256;raw[j+3]=(x%23===0||y%31===0)?0:255;
 }
 const file=`SYNTHETIC-${mb}MB-4000x5000-alpha.png`;
 await sharp(raw,{raw:{width,height,channels:4}}).png({compressionLevel:6,adaptiveFiltering:true}).toFile(path.join(out,file));
 const stat=await fs.stat(path.join(out,file));cases.push({file,targetMB:mb,bytes:stat.size,width,height,synthetic:true,alpha:true});
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify({synthetic:true,description:'Generated raster: seeded noise plus gradient and transparent grid. NOT illustrator samples. No padding chunks.',cases},null,2));
console.log(JSON.stringify(cases));
