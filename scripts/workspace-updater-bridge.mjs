import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {newerNative} from '../src/workspace/releaseVersion.mjs';
export const BASELINE='53be339c4fae8318ff46770b209dbf0cd9e510a7';
export const BRIDGE_VERSION='1.6.603';
export const BRIDGE_DISPLAY='1.6.6.3';
export const FEED='https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/releases/download/workspace-updates/';
const allowed=new Set(['.github/workflows/workspace-desktop.yml','src-tauri/tauri.conf.json','src-tauri/Cargo.toml','src-tauri/Cargo.lock','src/workspace/releaseInfo.json','package.json','scripts/workspace-updater-bridge.mjs','scripts/workspace-publish-bridge.mjs','tests/updater-bridge.test.mjs','docs/workspace/updater-bridge.md']);
export function verifyBridgeSource(root=process.cwd()) {
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
 const read=file=>readFileSync(path.join(root,file),'utf8').trim();
 const changed=git(['diff','--name-only',BASELINE]);
 for(const file of changed.split('\n').filter(Boolean))assert.ok(allowed.has(file),`Bridge cannot change ${file}`);
 const previous=JSON.parse(git(['show',BASELINE+':src-tauri/tauri.conf.json']));
 const current=JSON.parse(read('src-tauri/tauri.conf.json'));
 assert.equal(current.version,BRIDGE_VERSION);
 assert.deepEqual(current.plugins.updater.endpoints,[FEED+'latest-{{target}}.json']);
 current.version=previous.version;current.plugins.updater.endpoints=previous.plugins.updater.endpoints;
 assert.deepEqual(current,previous,'Only version and endpoint may change in native configuration');
 for(const file of ['src-tauri/Cargo.toml','src-tauri/Cargo.lock']) {
  const before=git(['show',BASELINE+':'+file]);
  const after=read(file);
  assert.equal(after,before.replace('name = "gba-workspace"\nversion = "1.6.602"','name = "gba-workspace"\nversion = "1.6.603"'),`No dependency changes in ${file}`);
 }
 const beforePackage=JSON.parse(git(['show',BASELINE+':package.json'])),afterPackage=JSON.parse(read('package.json'));
 beforePackage.scripts['test:desktop']+=' && node tests/updater-bridge.test.mjs';assert.deepEqual(afterPackage,beforePackage,'Only the regression test is added to package.json');
 const workflow='.github/workflows/workspace-desktop.yml';
 assert.equal(read(workflow),git(['show',BASELINE+':'+workflow]).replace('          persist-credentials: false','          fetch-depth: 0\n          persist-credentials: false'),'Workflow only fetches history for baseline verification');
 return {baseline:BASELINE,changedFiles:changed.split('\n').filter(Boolean)};
}
export function windowsBridgeFeed(shared) {
 assert.equal(shared.version,BRIDGE_VERSION);assert.equal(shared.displayVersion,BRIDGE_DISPLAY);
 assert.deepEqual(Object.keys(shared.platforms).sort(),['darwin-aarch64','darwin-x86_64','windows-x86_64']);
 return {...shared,notes:'Workspace 1.6.6.3 Cuarzo · Actualizador conectado. Se conserva Cuarzo en Windows; Lapislázuli aún no se ofrece para este sistema.',platforms:{'windows-x86_64':shared.platforms['windows-x86_64']}};
}
export function verifyUpgradePaths(shared,mac,windows) {
 assert.equal(shared.version,BRIDGE_VERSION);assert.equal(windows.version,BRIDGE_VERSION);
 assert.deepEqual(windows,windowsBridgeFeed(shared));
 assert.deepEqual(Object.keys(mac.platforms).sort(),['darwin-aarch64','darwin-x86_64']);
 assert.ok(newerNative(mac.version,BRIDGE_VERSION));
 for(const installed of ['0.1.4','0.1.401','1.5.0','1.6.501','1.6.600','1.6.601','1.6.602']) {
  assert.ok(newerNative(shared.version,installed));
  for(const target of ['darwin-aarch64','darwin-x86_64','windows-x86_64'])assert.ok(shared.platforms[target]?.signature);
 }
 assert.ok(!newerNative(windows.version,BRIDGE_VERSION),'Windows bridge stops at its real installed version');
 for(const platform of Object.values(windows.platforms))assert.ok(platform.url.includes('/workspace-v1.6.6.3-beta.1/'));
 return true;
}
