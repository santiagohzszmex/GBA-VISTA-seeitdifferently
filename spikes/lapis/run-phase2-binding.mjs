// Development-only runner: exact-size synthetic files from phase2-fixtures.py.
import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2],origin=new URL(process.argv[3]||'http://localhost:8797');
if(!root||!['localhost','127.0.0.1'].includes(origin.hostname))throw Error('Use a synthetic fixture directory and the local spike Worker');
const results=[];
for(const bytes of [19000000,20000000,20000001,20971520,20971521]){
 const name=`SYNTHETIC-GPS-${bytes}-bytes.png`,start=Date.now(),response=await fetch(new URL('/binding',origin),{method:'POST',body:fs.createReadStream(path.join(root,name)),duplex:'half',signal:AbortSignal.timeout(90000)});
 const text=await response.text();let result;try{result=JSON.parse(text);}catch{result={transport_error:text.slice(0,250)};}
 results.push({name,bytes,status:response.status,elapsed_ms:Date.now()-start,result});
}
for(const mode of ['provider','clean']){
 const response=await fetch(new URL(`/binding?raw=${mode}`,origin),{method:'POST',body:fs.createReadStream(path.join(root,'SYNTHETIC-GPS-19000000-bytes.png')),duplex:'half',signal:AbortSignal.timeout(90000)});
 if(response.ok)fs.writeFileSync(path.join(root,`${mode}.webp`),Buffer.from(await response.arrayBuffer()));else results.push({mode,status:response.status,error:(await response.text()).slice(0,500)});
}
console.log(JSON.stringify({tested_at:new Date().toISOString(),synthetic:true,construction:'Padded RGBA PNG with synthetic EXIF/GPS; not an illustrator export.',results},null,2));
