import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
const [platform,target]=process.argv.slice(2);
if(!['macos','windows'].includes(platform)||!/^[a-z0-9_-]+$/.test(target||'')) throw Error('Invalid native smoke target');
const executable=platform==='macos'
 ?path.join('src-tauri/target',target,'release/bundle/macos/GBA Workspace.app/Contents/MacOS/gba-workspace')
 :path.join('src-tauri/target',target,'release/gba-workspace.exe');
await fs.access(executable);
const child=spawn(path.resolve(executable),[],{stdio:'ignore'});
let error=null,exited=false;
child.on('error',e=>{error=e;});child.on('exit',()=>{exited=true;});
await new Promise(resolve=>setTimeout(resolve,8000));
if(error||exited) throw Error('Native application failed to stay open during startup');
child.kill();
await fs.writeFile('release-candidates/startup.json',JSON.stringify({platform,target,commit:process.env.GITHUB_SHA,processStartup:true,installedAppTest:false,liveIdentityTest:false},null,2)+'\n');
console.log('Native process startup passed. Installed-app and live identity acceptance still required.');
