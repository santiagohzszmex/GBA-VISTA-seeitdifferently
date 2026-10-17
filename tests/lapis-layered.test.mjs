import assert from 'node:assert/strict';
import {inspectLayered} from '../spikes/lapis/validate-layered.mjs';
const psd=Buffer.alloc(26);psd.write('8BPS');psd.writeUInt16BE(1,4);psd.writeUInt16BE(4,12);psd.writeUInt32BE(5000,14);psd.writeUInt32BE(4000,18);psd.writeUInt16BE(8,22);psd.writeUInt16BE(3,24);
const p=await inspectLayered(new Blob([psd]),'psd');assert.equal(p.verification,'header');assert.equal(p.width,4000);assert.equal(p.layers,'author_declared');
const psb=Buffer.from(psd);psb.writeUInt16BE(2,4);await assert.rejects(inspectLayered(new Blob([psb]),'psd'),/PSB/);
await assert.rejects(inspectLayered(new Blob(['8BPS']),'psd'),/inválida/);
await assert.rejects(inspectLayered(new Blob(['MZ executable']),'psd'),/inválida/);
const tiff=Buffer.alloc(26);tiff.write('II');tiff.writeUInt16LE(42,2);tiff.writeUInt32LE(8,4);tiff.writeUInt16LE(1,8);
assert.equal((await inspectLayered(new Blob([tiff]),'tiff')).verification,'header');
const bad=Buffer.from(tiff);bad.writeUInt32LE(999999,4);await assert.rejects(inspectLayered(new Blob([bad]),'tiff'),/fuera/);
await assert.rejects(inspectLayered(new Blob(['not a ZIP']),'kra'),/ZIP/);
// Empty ordinary ZIP must not pass as KRA.
await assert.rejects(inspectLayered(new Blob([Buffer.from('504b0506000000000000000000000000000000000000','hex')]),'kra'),/ZIP/);
for(const format of ['procreate','afphoto','clip'])assert.equal((await inspectLayered(new Blob(['opaque synthetic attachment']),format)).verification,'unverified');
await assert.rejects(inspectLayered(new Blob(['data']),'svg'),/no admitido/);
console.log('PASS: 14 bounded layered-file checks; opacity is explicit and header detection does not claim real layers.');
