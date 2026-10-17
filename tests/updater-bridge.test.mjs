import assert from 'node:assert/strict';
import {verifyBridgeSource,windowsBridgeFeed,verifyUpgradePaths,BRIDGE_VERSION,BRIDGE_DISPLAY} from '../scripts/workspace-updater-bridge.mjs';
import {createUpdateController} from '../src/workspace/updateController.mjs';
verifyBridgeSource();
const artifact=target=>({url:`https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/releases/download/workspace-v1.6.6.3-beta.1/${target}`,signature:'test-only'});
const shared={version:BRIDGE_VERSION,displayVersion:BRIDGE_DISPLAY,notes:'Puente',platforms:Object.fromEntries(['darwin-aarch64','darwin-x86_64','windows-x86_64'].map(t=>[t,artifact(t)]))};
const mac={version:'1.7.100',platforms:{'darwin-aarch64':artifact('darwin-aarch64'),'darwin-x86_64':artifact('darwin-x86_64')}};
const windows=windowsBridgeFeed(shared);assert.ok(verifyUpgradePaths(shared,mac,windows));
assert.throws(()=>verifyUpgradePaths(shared,mac,{...windows,version:'1.7.100'}));
let installs=0,downloads=0;
for(const [currentVersion,manifest] of [['1.6.602',shared],[BRIDGE_VERSION,mac],[BRIDGE_VERSION,null]]){
 const controller=createUpdateController({currentVersion:async()=>currentVersion,check:async()=>manifest?{version:manifest.version,body:manifest.notes,rawJson:manifest,download:async()=>downloads++,install:async()=>installs++}:null,relaunch:async()=>{}});
 await controller.check();assert.equal(controller.getState().phase,manifest?'available':'current');
 assert.equal(controller.getState().required,false);
}
assert.equal(installs+downloads,0,'Discovery never downloads, installs or restarts');
console.log('PASS legacy→bridge→Lapislázuli on both Macs; Windows stays on its real Cuarzo version; protected sources/dependencies unchanged; installation remains manual.');
