import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createReadStream} from 'node:fs';
import path from 'node:path';
const directory=process.argv[2],output=process.argv[3];if(!directory||!output)throw Error('Usage: node run.mjs SAMPLE_DIRECTORY OUTPUT_JSON [--real]');
const rows=[];for(const file of (await fs.readdir(directory)).filter(f=>/\.(png|psd|tiff|kra)$/i.test(f))){
 const format=file.split('.').pop().toLowerCase();const args=['spikes/lapis/measure-one.mjs',path.join(directory,file),format];if(process.argv.includes('--real'))args.push('--real');
 const processResult=spawnSync(process.execPath,args,{encoding:'utf8',timeout:120000});
 rows.push(processResult.status===0?JSON.parse(processResult.stdout):{file,error:processResult.stderr.slice(-700),ok:false});
}
const binding=[];if(process.env.LAPIS_BINDING_URL)for(const file of (await fs.readdir(directory)).filter(f=>/\.png$/i.test(f))){
 const start=performance.now();try{
  const response=await fetch(`${process.env.LAPIS_BINDING_URL}/binding`,{method:'POST',body:createReadStream(path.join(directory,file)),duplex:'half',signal:AbortSignal.timeout(90000)});
  binding.push({file,status:response.status,roundTripMs:Math.round(performance.now()-start),...await response.json()});
 }catch(error){binding.push({file,error:error.message});}
}
await fs.writeFile(output,JSON.stringify({createdAt:new Date().toISOString(),synthetic:!process.argv.includes('--real'),localEngine:'sharp/libvips (local machine, NOT Workers)',local:rows,binding},null,2));
console.log(JSON.stringify({local:rows,binding}));
