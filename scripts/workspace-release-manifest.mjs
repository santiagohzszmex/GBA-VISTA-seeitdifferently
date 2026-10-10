import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { toNativeVersion } from '../src/workspace/releaseVersion.mjs';

export async function buildReleaseManifest(packages, proof, fetchAsset=fetch) {
 const channel=proof.channel||'stable';
 if(!['stable','beta'].includes(channel)) throw Error('Invalid release channel');
 for(const check of ['backupRestoreVerified','stagingAuthVerified','gatewayVerified','membershipRlsVerified','activationExpiryRevocationVerified','installedMacosVerified','installedWindowsVerified']) {
  if(proof[check]!==true) throw Error(`Missing acceptance: ${check}`);
 }
 if(channel==='beta'&&proof.betaDistributionAuthorized!==true) throw Error('Beta distribution requires explicit authorization');
 if(!/^[a-f0-9]{40}$/.test(proof.commit||'')||!/^https:\/\//.test(proof.evidenceUrl||'')) throw Error('Acceptance requires exact commit and evidence URL');
 if(packages.commit!==proof.commit||!packages.downloads?.length) throw Error('Package commit does not match acceptance');
 const downloads=[],targets=new Set();
 for(const p of packages.downloads) {
  const url=new URL(p.url);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash) throw Error('Require permanent public HTTPS asset URL');
  if(!['macos','windows'].includes(p.platform)||!['aarch64','x86_64'].includes(p.architecture)||p.platform==='windows'&&p.architecture!=='x86_64'||!/^\d+\.\d+\.\d+$/.test(p.version)||!/^[a-f0-9]{64}$/.test(p.sha256)||!Number.isSafeInteger(p.size)||p.size<100000) throw Error('Invalid package metadata');
  if(p.displayVersion && p.displayVersion!==p.version && toNativeVersion(p.displayVersion)!==p.version)throw Error('Public package version differs');
  const signed=p.platform==='macos'?'notarized':'authenticode';
  const beta=p.platform==='macos'?'ad-hoc':'unsigned';
  if(p.signing!==signed&&(channel!=='beta'||p.signing!==beta)) throw Error('Public stable distribution requires verified native signing');
  const target=`${p.platform}/${p.architecture}`;
  if(targets.has(target)) throw Error('Duplicate native target');targets.add(target);
  const response=await fetchAsset(url,{signal:AbortSignal.timeout(120000)});
  if(!response.ok||new URL(response.url).protocol!=='https:') throw Error('Public asset is unavailable');
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length!==p.size||createHash('sha256').update(bytes).digest('hex')!==p.sha256) throw Error('Public asset differs from verified native package');
  downloads.push({platform:p.platform,architecture:p.architecture,version:p.displayVersion||p.version,nativeVersion:p.version,url:p.url,sha256:p.sha256,size:p.size,signing:p.signing});
 }
 if(!downloads.some(p=>p.platform==='macos')||!downloads.some(p=>p.platform==='windows')) throw Error('Both native platforms are required');
 if(new Set(downloads.map(p=>p.version)).size!==1) throw Error('Mixed release versions');
 return {version:downloads[0].version,channel,commit:proof.commit,evidenceUrl:proof.evidenceUrl,downloads};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
 const [source,acceptance,output='public/gba/workspace/releases.json']=process.argv.slice(2);
 if(!source||!acceptance) throw Error('Usage: node scripts/workspace-release-manifest.mjs packages-with-urls.json acceptance.json [output]');
 const manifest=await buildReleaseManifest(JSON.parse(await fs.readFile(source,'utf8')),JSON.parse(await fs.readFile(acceptance,'utf8')));
 await fs.writeFile(output,JSON.stringify(manifest,null,2)+'\n');
 console.log(`Public HTTPS bytes verified; ${manifest.channel} release manifest written.`);
}
