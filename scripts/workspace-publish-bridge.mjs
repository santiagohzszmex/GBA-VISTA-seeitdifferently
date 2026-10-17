// One-time compatibility release from the exact public Cuarzo source.
// Never install the app, change the macOS channel, or publish Windows Lapislázuli.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyCandidate,buildUpdateManifest,UPDATE_TARGETS,REPOSITORY} from './workspace-update-manifest.mjs';
import {BASELINE,BRIDGE_VERSION,BRIDGE_DISPLAY,FEED,verifyBridgeSource,windowsBridgeFeed,verifyUpgradePaths} from './workspace-updater-bridge.mjs';
const gh=args=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(120000)});assert.ok(r.ok,`Unavailable: ${url}`);return Buffer.from(await r.arrayBuffer());};
async function main(){
 const args=process.argv.slice(2),run=args[args.indexOf('--run')+1],publish=args.includes('--publish');
 assert.match(run||'',/^\d+$/,'--run required');
 const source=verifyBridgeSource(),commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 assert.equal(execFileSync('git',['diff','--name-only','HEAD'],{encoding:'utf8'}).trim(),'','Commit release sources first');
 const config=JSON.parse(await fs.readFile('src-tauri/tauri.conf.json','utf8'));
 const info=JSON.parse(gh(['run','view',run,'--repo',REPOSITORY,'--json','headSha,conclusion,name,url']));
 assert.equal(info.headSha,commit);assert.equal(info.conclusion,'success');assert.equal(info.name,'Workspace native candidates');
 const baselineRelease=JSON.parse(gh(['release','view','workspace-v1.6.6.2-beta.1','--repo',REPOSITORY,'--json','isDraft,targetCommitish']));
 assert.equal(baselineRelease.isDraft,false);assert.equal(baselineRelease.targetCommitish,BASELINE);
 const folder=path.resolve('release-candidates',`bridge-${run}`);await fs.mkdir(folder,{recursive:true});
 const lock=await fs.open(path.join(folder,'publication.lock'),'wx',0o600);
 try {
  const previous=await get(FEED+'latest.json'),mac=await get(FEED+'latest-darwin.json'),base=await get('https://gba.software/gba/workspace/releases.json');
  assert.equal(JSON.parse(base).version,'1.5.0');assert.equal(JSON.parse(previous).version,'1.6.602');
  assert.equal(JSON.parse(previous).commit,BASELINE);
  await fs.writeFile(path.join(folder,'previous-latest.json'),previous);await fs.writeFile(path.join(folder,'previous-latest-darwin.json'),mac);
  gh(['release','download','workspace-v1.6.6.2-beta.1','--repo',REPOSITORY,'--pattern','acceptance.json','--dir',folder,'--clobber']);
  const prior=await fs.readFile(path.join(folder,'acceptance.json')),priorProof=JSON.parse(prior);
  assert.equal(priorProof.commit,BASELINE);assert.equal(priorProof.betaDistributionAuthorized,true);
  for(const gate of ['backupRestoreVerified','stagingAuthVerified','gatewayVerified','membershipRlsVerified','activationExpiryRevocationVerified','installedMacosVerified','installedWindowsVerified'])assert.equal(priorProof[gate],true,`Missing inherited acceptance ${gate}`);
  const key=process.env.WORKSPACE_UPDATE_SIGNING_KEY||path.join(os.homedir(),'.tauri/workspace-updates.key');
  assert.equal((await fs.readFile(key+'.pub','utf8')).trim(),config.plugins.updater.pubkey);
  const tag=`workspace-v${BRIDGE_DISPLAY}-beta.1`,files=[],updates=[],downloads=[];
  for(const target of UPDATE_TARGETS){
   const [system,architecture]=target.split('-'),platform=system==='darwin'?'macos':system,dest=path.join(folder,target);await fs.mkdir(dest,{recursive:true});
   try{await fs.access(path.join(dest,'packages.json'));}catch{gh(['run','download',run,'--repo',REPOSITORY,'--name',`workspace-${platform}-${architecture}`,'--dir',dest]);}
   const metadata=JSON.parse(await fs.readFile(path.join(dest,'packages.json'),'utf8')),startup=JSON.parse(await fs.readFile(path.join(dest,'startup.json'),'utf8'));
   const file=metadata.updaters?.[0]?.file;assert.equal(path.basename(file),file);
   const bytes=await fs.readFile(path.join(dest,file)),artifact=verifyCandidate(metadata,startup,bytes,{commit,version:BRIDGE_VERSION,displayVersion:BRIDGE_DISPLAY,target});
   const installer=metadata.downloads[0];assert.equal(path.basename(installer.file),installer.file);
   const installerBytes=await fs.readFile(path.join(dest,installer.file));assert.equal(installerBytes.length,installer.size);assert.equal(sha(installerBytes),installer.sha256);
   execFileSync(process.execPath,[path.resolve('node_modules/@tauri-apps/cli/tauri.js'),'signer','sign','--private-key-path',key,'--password','',path.join(dest,file)],{stdio:['ignore','pipe','pipe']});
   execFileSync('/Applications/Workspace.app/Contents/MacOS/gba-workspace',['--verify-update',path.join(dest,file),path.join(dest,file+'.sig')],{stdio:['ignore','pipe','pipe']});
   const signature=(await fs.readFile(path.join(dest,file+'.sig'),'utf8')).trim(),url=f=>`https://github.com/${REPOSITORY}/releases/download/${tag}/${encodeURIComponent(f)}`;
   updates.push({...artifact,url:url(file),signature});downloads.push({...installer,url:url(installer.file)});files.push(path.join(dest,file),path.join(dest,file+'.sig'),path.join(dest,installer.file));
  }
  const notes='# Workspace 1.6.6.3 Cuarzo · Conexión con Lapislázuli\n\nCorrige el actualizador de las versiones anteriores. Guarda tu trabajo e instala este pequeño puente. En Mac, después del reinicio vuelve a buscar actualizaciones: aparecerá Lapislázuli 1.7.1. En Windows se conserva Cuarzo. Tus datos y sesión se mantienen. Cada descarga e instalación requiere tu acción; no cambia la base pública 1.5.0.\n\nBeta sin notarización de Apple ni firma de distribución Windows; paquetes de actualización firmados con la identidad de Workspace.';
  const shared=buildUpdateManifest({version:BRIDGE_VERSION,displayVersion:BRIDGE_DISPLAY,commit,notes,pubDate:new Date().toISOString(),artifacts:updates,previous:JSON.parse(previous)}),windows=windowsBridgeFeed(shared);
  verifyUpgradePaths(shared,JSON.parse(mac),windows);
  for(const [name,value] of [['latest.json',shared],['latest-windows.json',windows],['packages.json',{commit,downloads,updaters:updates}],['acceptance.json',{commit,source,baselineAcceptanceSha256:sha(prior),baselineAcceptanceTag:'workspace-v1.6.6.2-beta.1',nativeInstalledAcceptanceRun:info.url,unchangedProtectedSources:true,dependenciesUnchanged:true,windowsLapislazuliPublished:false,manualInstallation:true}]])await fs.writeFile(path.join(folder,name),JSON.stringify(value,null,2)+'\n');
  await fs.writeFile(path.join(folder,'release-notes.md'),notes+'\n');
  if(!publish){console.log(`Prepared ${tag}; no publication or installation.`);return;}
  assert.equal(sha(await get(FEED+'latest.json')),sha(previous),'Legacy feed changed during preparation');
  assert.equal(sha(await get(FEED+'latest-darwin.json')),sha(mac),'macOS feed changed during preparation');
  gh(['release','create',tag,...files,path.join(folder,'packages.json'),path.join(folder,'acceptance.json'),'--repo',REPOSITORY,'--target',commit,'--draft','--prerelease','--title',`Workspace ${BRIDGE_DISPLAY} Cuarzo · puente del actualizador`,'--notes-file',path.join(folder,'release-notes.md')]);
  gh(['release','edit',tag,'--repo',REPOSITORY,'--draft=false']);
  for(const artifact of updates){const bytes=await get(artifact.url);assert.equal(bytes.length,artifact.size);assert.equal(sha(bytes),artifact.sha256);}
  gh(['release','upload','workspace-updates',path.join(folder,'latest-windows.json'),'--repo',REPOSITORY,'--clobber']);
  const liveWindows=await get(FEED+'latest-windows.json');assert.deepEqual(JSON.parse(liveWindows),windows);
  gh(['release','upload','workspace-updates',path.join(folder,'latest.json'),'--repo',REPOSITORY,'--clobber']);
  const liveShared=await get(FEED+'latest.json');assert.deepEqual(JSON.parse(liveShared),shared);
  assert.equal(sha(await get(FEED+'latest-darwin.json')),sha(mac));assert.equal(sha(await get('https://gba.software/gba/workspace/releases.json')),sha(base));
  verifyUpgradePaths(JSON.parse(liveShared),JSON.parse(mac),JSON.parse(liveWindows));
  console.log(`Published ${tag}; legacy→bridge→Lapislázuli for both Macs; Windows stays Cuarzo; macOS feed/base unchanged. Nothing installed locally.`);
 }finally{await lock.close();await fs.unlink(path.join(folder,'publication.lock'));}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
