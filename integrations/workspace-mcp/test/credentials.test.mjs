import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {credential} from '../credentials.mjs';
test('macOS Keychain writer confirms storage and deletes its own disposable fixture',{skip:process.platform!=='darwin'},async()=>{const scope={service:`software.gba.workspace.codex.fixture.${randomUUID()}`,account:'disposable'};const token=`wsc_${'e'.repeat(64)}`;try{await credential('write',token,scope);assert.equal(await credential('read',undefined,scope),token);}finally{await credential('delete',undefined,scope);}});
