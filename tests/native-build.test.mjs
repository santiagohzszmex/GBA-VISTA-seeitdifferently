import assert from 'node:assert/strict';
import { nativeBuildArgs } from '../scripts/workspace-build.mjs';
assert.deepEqual(nativeBuildArgs(['--target','aarch64-apple-darwin','--bundles','dmg'],'linux'),['build','--target','aarch64-apple-darwin','--bundles','app,dmg']);
assert.deepEqual(nativeBuildArgs(['--bundles','dmg'],'darwin'),['build','--bundles','app,dmg']);
assert.deepEqual(nativeBuildArgs(['--target','x86_64-pc-windows-msvc','--bundles','nsis'],'darwin'),['build','--target','x86_64-pc-windows-msvc','--bundles','nsis']);
assert.deepEqual(nativeBuildArgs(['--bundles','app,dmg'],'darwin'),['build','--bundles','app,dmg']);
console.log('PASS: DMG builds retain app bundles; Windows NSIS args stay intact.');
