import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const [source,acceptance,output='public/gba/workspace/releases.json']=process.argv.slice(2);
if(!source||!acceptance) throw Error('Usage: node scripts/workspace-release-manifest.mjs packages-with-urls.json acceptance.json [output]');
const packages=JSON.parse(await fs.readFile(source,'utf8'));
const proof=JSON.parse(await fs.readFile(acceptance,'utf8'));
for(const check of ['backupRestoreVerified','stagingAuthVerified','gatewayVerified','membershipRlsVerified','activationExpiryRevocationVerified','installedMacosVerified','installedWindowsVerified']) {
 if(proof[check]!==true) throw Error(`Missing acceptance: ${check}`);
}
if(!/^[a-f0-9]{40}$/.test(proof.commit||'')||!/^https:\/\//.test(proof.evidenceUrl||'')) throw Error('Acceptance requires exact commit and evidence URL');
if(packages.commit!==proof.commit||!packages.downloads?.length) throw Error('Package commit does not match acceptance');
const downloads=[];
for(const p of packages.downloads) {
 const url=new URL(p.url);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash) throw Error('Require permanent public HTTPS asset URL');
 if(!['macos','windows'].includes(p.platform)||!['aarch64','x86_64'].includes(p.architecture)||!/^\d+\.\d+\.\d+$/.test(p.version)||!/^[a-f0-9]{64}$/.test(p.sha256)) throw Error('Invalid package metadata');
 if(p.signing!==(p.platform==='macos'?'notarized':'authenticode')) throw Error('Public distribution requires verified native signing');
 const response=await fetch(url,{signal:AbortSignal.timeout(120000)});
 if(!response.ok||new URL(response.url).protocol!=='https:') throw Error('Public asset is unavailable');
 const bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length!==p.size||createHash('sha256').update(bytes).digest('hex')!==p.sha256) throw Error('Public asset differs from verified native package');
 downloads.push({platform:p.platform,architecture:p.architecture,version:p.version,url:p.url,sha256:p.sha256,size:p.size,signing:p.signing});
}
if(!downloads.some(p=>p.platform==='macos')||!downloads.some(p=>p.platform==='windows')) throw Error('Both native platforms are required');
if(new Set(downloads.map(p=>p.version)).size!==1) throw Error('Mixed release versions');
await fs.writeFile(output,JSON.stringify({version:downloads[0].version,commit:proof.commit,downloads},null,2)+'\n');
console.log('Public HTTPS bytes verified; release manifest written.');
