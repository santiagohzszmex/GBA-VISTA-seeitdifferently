import assert from 'node:assert/strict';
import { createUpdateController } from '../src/workspace/updateController.mjs';
const calls = { check: 0, download: 0, install: 0, restart: 0, close: 0 };
let failDownload = false, failInstall = false, failRestart = false, failCheck = false;
const update = { version: '0.1.2', body: 'Cambios de Workspace',
  async close() { calls.close++; },
  async download(notify) { calls.download++; notify({ event: 'Started', data: { contentLength: 100 } }); notify({ event: 'Progress', data: { chunkLength: 50 } }); if (failDownload) throw Error('Bad signature'); notify({ event: 'Progress', data: { chunkLength: 50 } }); },
  async install(options) { assert.equal(options.restartAfterInstall, true); calls.install++; if (failInstall) throw Error('Locked application'); } };
const client = createUpdateController({ now: () => 1000,
  check: async () => { calls.check++; if (failCheck) throw Error('Network'); return update; },
  relaunch: async () => { calls.restart++; if (failRestart) throw Error('Relaunch'); } });
await client.install(); assert.equal(calls.install, 0);
await Promise.all([client.check(), client.check()]); assert.equal(calls.check, 1);
assert.equal(client.getState().phase, 'available');
assert.equal(client.getState().lastChecked, 1000);
assert.equal(calls.download + calls.install + calls.restart, 0, 'A check never downloads or installs');
await client.install(); assert.equal(calls.install, 0, 'A package must first pass download verification');
failCheck = true; await client.check(); assert.equal(client.getState().phase, 'available'); failCheck = false;
failDownload = true; await client.download(); assert.equal(client.getState().phase, 'available'); assert.match(client.getState().error, /verificación/); assert.equal(calls.install, 0);
failDownload = false; await Promise.all([client.download(), client.download()]); assert.equal(calls.download, 2); assert.equal(client.getState().phase, 'ready'); assert.equal(client.getState().downloaded, 100); assert.equal(calls.install, 0);
await client.check(); assert.equal(calls.check, 2, 'A checked and downloaded update is not replaced');
failInstall = true; await client.install(); assert.equal(client.getState().phase, 'ready'); assert.equal(calls.restart, 0);
failInstall = false; failRestart = true; await Promise.all([client.install(), client.install()]); assert.equal(calls.install, 2); assert.equal(client.getState().phase, 'installed'); assert.match(client.getState().error, /Cierra/);
await client.install(); assert.equal(calls.install, 2, 'Restart failures do not repeat installation');
failRestart = false; await client.restart(); assert.equal(calls.restart, 2);
await client.dispose();
const current = createUpdateController({ check: async () => null, relaunch: () => { throw Error('Unexpected restart'); } });
await current.check(); assert.equal(current.getState().phase, 'current'); await current.download(); await current.install();
console.log('PASS: checks never download/install, explicit actions, concurrency, signature rejection, retry and restart recovery.');
