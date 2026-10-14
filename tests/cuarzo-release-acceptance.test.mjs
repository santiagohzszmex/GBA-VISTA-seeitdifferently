import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CUARZO_BASELINE,CUARZO_MIGRATION,CUARZO_LIVE_SQL,verifyCuarzoAcceptance} from '../scripts/workspace-cuarzo-release-acceptance.mjs';
import {WORKSPACE_165_LIVE_CHECKS} from '../scripts/workspace-165-release-acceptance.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const gates=['backupRestoreVerified','stagingAuthVerified','gatewayVerified','membershipRlsVerified','activationExpiryRevocationVerified','installedMacosVerified','installedWindowsVerified'];
const previous={commit:CUARZO_BASELINE.commit,channel:'beta',betaDistributionAuthorized:true,...Object.fromEntries(gates.map(key=>[key,true])),
 workspace165Acceptance:{sourceCommit:CUARZO_BASELINE.commit,projectRef:'wgihpztgwsovhykboyru',liveChecks:Object.fromEntries(WORKSPACE_165_LIVE_CHECKS.map(key=>[key,true]))}};
const commit='a'.repeat(40),projectRef='wgihpztgwsovhykboyru',ciRun={runId:'166',headSha:commit,conclusion:'success',url:'https://github.com/santiagohzszmex/GBA-VISTA-seeitdifferently/actions/runs/166'};
const proof={sourceCommit:commit,projectRef,verifiedAt:new Date().toISOString(),ciRun,
 migration:{file:CUARZO_MIGRATION,sha256:sha(await fs.readFile(CUARZO_MIGRATION))},liveSql:{file:CUARZO_LIVE_SQL,sha256:sha(await fs.readFile(CUARZO_LIVE_SQL))},
 liveResult:{checks:28,credentials_preserved:true,keynotes_preserved:true,private_copies:2},transactionRollbackVerified:true,
 schemaChecks:{migrationApplied:true,privateTablesRlsVerified:true,anonymousSendDenied:true,existingReferencesPreserved:true}};
const options={commit,projectRef,changedProtectedFiles:[CUARZO_MIGRATION],expectedCiRun:ciRun,previousBytes:Buffer.from(JSON.stringify(previous))};
assert.equal((await verifyCuarzoAcceptance(proof,previous,options)).inheritedEvidence.release,CUARZO_BASELINE.tag);
for(const invalid of [{...proof,liveResult:{...proof.liveResult,checks:0}},{...proof,transactionRollbackVerified:false},{...proof,sourceCommit:'b'.repeat(40)},{...proof,migration:{...proof.migration,sha256:'c'.repeat(64)}},{...proof,ciRun:{...ciRun,conclusion:'failure'}}])await assert.rejects(verifyCuarzoAcceptance(invalid,previous,options));
await assert.rejects(verifyCuarzoAcceptance(proof,previous,{...options,changedProtectedFiles:[CUARZO_MIGRATION,'api/identity.js']}));
await assert.rejects(verifyCuarzoAcceptance(proof,{...previous,commit:'b'.repeat(40)},options));
console.log('PASS: Cuarzo publication rejects missing live checks, rollback, mixed commits, changed migrations, failed CI and changed protected sources.');
