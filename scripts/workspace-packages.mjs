import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

// Run on the native runner after Tauri has finished. This records package
// evidence, not a claim that live Auth/RLS or an installed app has been tested.
const [platform, architecture, target, out='release-candidates'] = process.argv.slice(2);
if (!['macos','windows'].includes(platform) || !['aarch64','x86_64'].includes(architecture) || !/^[a-z0-9_-]+$/.test(target||'')) throw Error('Invalid platform/architecture/target');
const config=JSON.parse(await fs.readFile('src-tauri/tauri.conf.json','utf8'));
const root=path.join('src-tauri/target',target,'release/bundle');
const run=(command,args)=>execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
async function files(dir) {
  const result=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) result.push(...await files(full));
    else if(entry.isFile()) result.push(full);
  }
  return result;
}
let signing='unsigned';
if(platform==='macos') {
  const app=path.join(root,'macos/GBA Workspace.app');
  const binary=path.join(app,'Contents/MacOS/gba-workspace');
  const arch=run('lipo',['-archs',binary]).trim();
  if(arch!==(architecture==='aarch64'?'arm64':'x86_64')) throw Error(`Wrong Mach-O architecture: ${arch}`);
  const details=spawnSync('codesign',['-dv','--verbose=4',app],{encoding:'utf8'});
  if(details.status===0) {
    run('codesign',['--verify','--deep','--strict',app]);
    signing=/TeamIdentifier=(?!not set)[A-Z0-9]+/.test(details.stderr)?'developer-id':'ad-hoc';
  } else if(!/not signed at all/.test(details.stderr)) throw Error('Unable to inspect app signature');
  if(process.env.REQUIRE_APPLE_NOTARIZATION==='true') {
    if(signing!=='developer-id') throw Error('Developer ID signature required');
    run('xcrun',['stapler','validate',app]);
    run('spctl',['--assess','--type','execute','--verbose=2',app]);
    signing='notarized';
  }
} else {
  const binary=await fs.readFile(path.join('src-tauri/target',target,'release/gba-workspace.exe'));
  const pe=binary.readUInt32LE(0x3c);
  if(binary.subarray(pe,pe+4).toString('hex')!=='50450000' || binary.readUInt16LE(pe+4)!==0x8664) throw Error('Expected Windows x64 PE');
}
await fs.mkdir(out,{recursive:true});
const packages=(await files(root)).filter(f=>platform==='macos'?f.endsWith('.dmg'):/\.(exe|msi)$/.test(f));
if(!packages.length) throw Error('No native installers were generated');
const downloads=[];
for(const file of packages) {
  if(platform==='macos') run('hdiutil',['verify',file]);
  let packageSigning=signing;
  if(platform==='windows') {
    const status=run('powershell.exe',['-NoProfile','-NonInteractive','-Command',`(Get-AuthenticodeSignature -LiteralPath '${file.replaceAll("'","''")}').Status.ToString()`]).trim();
    if(!['Valid','NotSigned'].includes(status)) throw Error(`Invalid installer signature: ${status}`);
    packageSigning=status==='Valid'?'authenticode':'unsigned';
  }
  const bytes=await fs.readFile(file);
  if(bytes.length<100000) throw Error(`Implausibly small installer: ${file}`);
  const name=`gba-workspace-${config.version}-${platform}-${architecture}${path.extname(file)}`;
  if(downloads.some(d=>d.file===name)) throw Error('Ambiguous installer name');
  await fs.copyFile(file,path.join(out,name));
  downloads.push({file:name,platform,architecture,version:config.version,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,signing:packageSigning});
}
await fs.writeFile(path.join(out,'packages.json'),JSON.stringify({commit:process.env.GITHUB_SHA||null,downloads},null,2)+'\n');
await fs.writeFile(path.join(out,'SHA256SUMS'),downloads.map(d=>`${d.sha256}  ${d.file}`).join('\n')+'\n');
console.log(`Verified ${downloads.length} native candidate(s): ${platform}/${architecture}; signing=${signing}.`);
