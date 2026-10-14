import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CUARZO_BASELINE,CUARZO_MIGRATION,CUARZO_LIVE_SQL,CUARZO_READ_ONLY_SOURCE,CUARZO_AUTH_UI_FILES,verifyCuarzoAcceptance} from '../scripts/workspace-cuarzo-release-acceptance.mjs';
import {schemaFingerprint} from '../scripts/workspace-cuarzo-schema-evidence.mjs';
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
const evidence={rls:true,direct_authenticated:false,direct_anon:false,anonymous_send:false,functions:Array.from({length:22},(_,i)=>({name:`function${i}`,definition:'guarded'})),columns:[],constraints:[],role_permissions:[]};
const readOnlyProof={...proof,method:'read-only-schema-parity',liveResult:undefined,transactionRollbackVerified:undefined,
 readOnlySource:{file:CUARZO_READ_ONLY_SOURCE,sha256:sha(await fs.readFile(CUARZO_READ_ONLY_SOURCE))},
 readOnlyResult:{readOnly:true,denials:6,migrationApplied:true,referencesTotal:20},referencesBefore:20,productionSchema:evidence,schemaFingerprint:schemaFingerprint(evidence)};
const readOnlyOptions={...options,roleTestedSchema:{sourceCommit:commit,assertions:577,evidence}};
assert.match((await verifyCuarzoAcceptance(readOnlyProof,previous,readOnlyOptions)).inheritedEvidence.method,/without fixture records/);
for(const bad of [{...readOnlyProof,readOnlyResult:{...readOnlyProof.readOnlyResult,readOnly:false}},
 {...readOnlyProof,productionSchema:{...evidence,direct_authenticated:true}},
 {...readOnlyProof,productionSchema:{...evidence,functions:[]}},
 {...readOnlyProof,productionSchema:{...evidence,functions:evidence.functions.map((f,i)=>i?f:{...f,definition:'unguarded'})}},
 {...readOnlyProof,readOnlySource:{...readOnlyProof.readOnlySource,sha256:'bad'}}])await assert.rejects(verifyCuarzoAcceptance(bad,previous,readOnlyOptions));
await assert.rejects(verifyCuarzoAcceptance(readOnlyProof,previous,{...readOnlyOptions,roleTestedSchema:{...readOnlyOptions.roleTestedSchema,sourceCommit:'b'.repeat(40)}}));
await assert.rejects(verifyCuarzoAcceptance(readOnlyProof,previous,{...readOnlyOptions,roleTestedSchema:{...readOnlyOptions.roleTestedSchema,assertions:0}}));
console.log('PASS: Read-only publication requires exact CI schema/functions/RBAC parity, denied access and unchanged references; rejects widened privileges, altered functions and mixed evidence.');
const authFiles=await Promise.all(CUARZO_AUTH_UI_FILES.map(async file=>({file,sha256:sha(await fs.readFile(file))})));
const authUi={files:authFiles,localFormNavigationVerified:true,existingLoginAndRecoveryUiVerified:true,gatewayMockRegistrationVerified:true,noProductionAccountsCreated:true};
const authProof={...readOnlyProof,authUi};
const authOptions={...readOnlyOptions,changedProtectedFiles:[CUARZO_MIGRATION,...CUARZO_AUTH_UI_FILES],roleTestedSchema:{...readOnlyOptions.roleTestedSchema,authUi:{sourceCommit:commit,assertions:21,files:authFiles}}};
assert.match((await verifyCuarzoAcceptance(authProof,previous,authOptions)).inheritedEvidence.method,/Access-form-only/);
await assert.rejects(verifyCuarzoAcceptance(authProof,previous,{...authOptions,changedProtectedFiles:[...authOptions.changedProtectedFiles,'api/gba-id.js']}));
await assert.rejects(verifyCuarzoAcceptance({...authProof,authUi:{...authUi,noProductionAccountsCreated:false}},previous,authOptions));
await assert.rejects(verifyCuarzoAcceptance({...authProof,authUi:{...authUi,files:authFiles.map(f=>({...f,sha256:'bad'}))}},previous,authOptions));
await assert.rejects(verifyCuarzoAcceptance(authProof,previous,{...authOptions,roleTestedSchema:{...authOptions.roleTestedSchema,authUi:{...authOptions.roleTestedSchema.authUi,assertions:0}}}));
console.log('PASS: Access-form release requires exact reviewed/CI-tested sources and refuses any server/auth transport change or missing local evidence.');
