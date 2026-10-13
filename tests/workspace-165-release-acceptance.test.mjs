import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { WORKSPACE_165_BASELINE, WORKSPACE_165_LIVE_CHECKS, WORKSPACE_165_MIGRATION, verifyWorkspace165Acceptance } from '../scripts/workspace-165-release-acceptance.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const migrationBytes=await fs.readFile(WORKSPACE_165_MIGRATION.file);
const files=new Map([
  ['src/context/AuthContext.jsx',Buffer.from('accepted identity source')],
  ['src/workspace/WorkspaceAuth.jsx',Buffer.from('accepted workspace auth source')],
  ['supabase/migrations/20261012230342_workspace_notifications.sql',Buffer.from('accepted database migration')],
  [WORKSPACE_165_MIGRATION.file,migrationBytes],
]);
const identity={commit:'b'.repeat(40),changes:['src/context/AuthContext.jsx','src/workspace/WorkspaceAuth.jsx'].map(file=>({file,sha256:hash(files.get(file))}))};
const database={commit:'c'.repeat(40),changes:[{file:'supabase/migrations/20261012230342_workspace_notifications.sql',sha256:hash(files.get('supabase/migrations/20261012230342_workspace_notifications.sql'))}]};
const previous={commit:WORKSPACE_165_BASELINE.commit,channel:'beta',betaDistributionAuthorized:true,...Object.fromEntries(['backupRestoreVerified','stagingAuthVerified','gatewayVerified','membershipRlsVerified','activationExpiryRevocationVerified','installedMacosVerified','installedWindowsVerified'].map(key=>[key,true])),identityAcceptance:identity,databaseAcceptance:database};
const commit='a'.repeat(40),projectRef='wgihpztgwsovhykboyru',ciRun={runId:'165012345',url:'https://github.com/GBA-Projects/gba-workspace-connector/actions/runs/165012345',headSha:commit,conclusion:'success'};
const proof={sourceCommit:commit,projectRef,verifiedAt:new Date().toISOString(),ciRun,migration:{...WORKSPACE_165_MIGRATION,sha256:hash(files.get(WORKSPACE_165_MIGRATION.file))},liveChecks:Object.fromEntries(WORKSPACE_165_LIVE_CHECKS.map(key=>[key,true]))};
const options={commit,projectRef,changedDatabaseFiles:[WORKSPACE_165_MIGRATION.file],expectedCiRun:ciRun,previousBytes:Buffer.from(JSON.stringify(previous)),read:file=>files.get(file),readBaseline:file=>files.get(file)};
const accepted=await verifyWorkspace165Acceptance(proof,previous,options);
assert.equal(accepted.sourceCommit,commit);
assert.equal(accepted.inheritedEvidence.release,WORKSPACE_165_BASELINE.tag);
assert.equal(accepted.inheritedEvidence.publishedAcceptance.commit,WORKSPACE_165_BASELINE.commit);
assert.equal(accepted.migration.sha256,WORKSPACE_165_MIGRATION.sha256);
await assert.rejects(verifyWorkspace165Acceptance(proof,previous,{...options,changedDatabaseFiles:[...options.changedDatabaseFiles,'supabase/migrations/extra.sql']}),/outside the reviewed/);
await assert.rejects(verifyWorkspace165Acceptance(proof,previous,{...options,changedIdentityFiles:['api/workspace.js']}),/Identity\/authentication/);
await assert.rejects(verifyWorkspace165Acceptance({...proof,sourceCommit:'d'.repeat(40)},previous,options),/source commit/);
await assert.rejects(verifyWorkspace165Acceptance({...proof,ciRun:{...ciRun,headSha:'e'.repeat(40)}},previous,options),/exact source commit/);
await assert.rejects(verifyWorkspace165Acceptance({...proof,ciRun:{...ciRun,runId:'165000000'}},previous,options),/successful CI run/);
await assert.rejects(verifyWorkspace165Acceptance({...proof,ciRun:{...ciRun,conclusion:'failure'}},previous,options),/successful CI run/);
await assert.rejects(verifyWorkspace165Acceptance({...proof,verifiedAt:'2020-01-01'},previous,options),/Fresh live/);
for(const key of WORKSPACE_165_LIVE_CHECKS) await assert.rejects(verifyWorkspace165Acceptance({...proof,liveChecks:{...proof.liveChecks,[key]:false}},previous,options),/Missing fresh 1\.6\.5 live check/);
await assert.rejects(verifyWorkspace165Acceptance({...proof,migration:{...proof.migration,sha256:'f'.repeat(64)}},previous,options),/migration bytes/);
await assert.rejects(verifyWorkspace165Acceptance(proof,{...previous,commit:'d'.repeat(40)},options),/exact published/);
await assert.rejects(verifyWorkspace165Acceptance(proof,{...previous,installedWindowsVerified:false},options),/installedWindowsVerified/);
await assert.rejects(verifyWorkspace165Acceptance(proof,previous,{...options,readBaseline:file=>file==='src/context/AuthContext.jsx'?Buffer.from('changed inherited source'):files.get(file)}),/Inherited identity or database source changed/);
console.log('PASS: 1.6.5 acceptance chains exact published 1.6.0.2 evidence and rejects stale, mixed-run, changed-baseline, missing-live-check, or extra-database proofs.');
