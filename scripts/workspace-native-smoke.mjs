import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { nativePaths } from './workspace-native-paths.mjs';
const [platform,target]=process.argv.slice(2);
if(!['macos','windows'].includes(platform)||!/^[a-z0-9_-]+$/.test(target||'')) throw Error('Invalid native smoke target');
const config=JSON.parse(await fs.readFile('src-tauri/tauri.conf.json','utf8'));
const original=nativePaths(platform,target,config);
if(process.env.GITHUB_ACTIONS!=='true'||!process.env.RUNNER_TEMP) throw Error('Installer acceptance must run on a disposable native CI runner');
const packages=JSON.parse(await fs.readFile('release-candidates/packages.json','utf8'));
if(packages.commit!==process.env.GITHUB_SHA||packages.downloads.length!==1) throw Error('Installer evidence does not match this build');
const pkg=packages.downloads[0];
const installer=path.resolve('release-candidates',pkg.file);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const bytes=await fs.readFile(installer);
if(pkg.platform!==platform||bytes.length!==pkg.size||digest(bytes)!==pkg.sha256) throw Error('Installer differs from package evidence');
const folder=await fs.mkdtemp(path.join(process.env.RUNNER_TEMP,'gba-installed-'));
const run=(cmd,args)=>execFileSync(cmd,args,{stdio:['ignore','pipe','pipe'],timeout:120000});
let mounted=false,child;
try {
 let executable;
 if(platform==='macos') {
  const mount=path.join(folder,'volume');await fs.mkdir(mount);
  run('hdiutil',['attach',installer,'-readonly','-nobrowse','-mountpoint',mount]);mounted=true;
  const app=path.join(folder,`${config.productName}.app`);
  run('ditto',[path.join(mount,`${config.productName}.app`),app]);
  run('codesign',['--verify','--deep','--strict',app]);
  executable=path.join(app,'Contents/MacOS',path.basename(original.executable));
 } else {
  // NSIS requires the directory argument last and without embedded quotes.
  const installDir=path.join(folder,'app');
  run(installer,['/S',`/D=${installDir}`]);
  executable=path.join(installDir,'gba-workspace.exe');
 }
 if(digest(await fs.readFile(executable))!==digest(await fs.readFile(original.executable))) throw Error('Installed executable differs from built executable');
 child=spawn(executable,[],{stdio:'ignore'});
 let error=null,exited=false;
 child.on('error',e=>{error=e;});child.on('exit',()=>{exited=true;});
 await new Promise(resolve=>setTimeout(resolve,8000));
 if(error||exited) throw Error('Installed application failed to stay open during startup');
 await fs.writeFile('release-candidates/startup.json',JSON.stringify({platform,target,commit:process.env.GITHUB_SHA,sha256:pkg.sha256,processStartup:true,installedAppTest:true,installedExecutableMatches:true,liveIdentityTest:false},null,2)+'\n');
 console.log('Installer extraction, installed executable and startup passed. Live UI identity acceptance is separate.');
} finally {
 if(child&&!child.killed) {const closed=new Promise(resolve=>child.once('close',resolve));child.kill();await Promise.race([closed,new Promise(resolve=>setTimeout(resolve,3000))]);}
 if(mounted)run('hdiutil',['detach',path.join(folder,'volume')]);
 await fs.rm(folder,{recursive:true,force:true});
}
