import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { WORKSPACE_165_LIVE_CHECKS } from './workspace-165-release-acceptance.mjs';
import {verifySchemaEvidence} from './workspace-cuarzo-schema-evidence.mjs';

export const CUARZO_BASELINE={tag:'workspace-v1.6.5.1-beta.1',commit:'0fafccb60e15ec68f32e64c90a67c0b5a52a9fc7'};
export const CUARZO_MIGRATION='supabase/migrations/20261014013712_workspace_cuarzo_documents.sql';
export const CUARZO_LIVE_SQL='tests/workspace-cuarzo-live-acceptance.sql';
export const CUARZO_READ_ONLY_SOURCE='scripts/workspace-cuarzo-schema-evidence.mjs';
export const CUARZO_AUTH_UI_FILES=['src/workspace/WorkspaceAuth.jsx','src/auth/workspaceIdentity.mjs'];
const gates=['backupRestoreVerified','stagingAuthVerified','gatewayVerified','membershipRlsVerified','activationExpiryRevocationVerified','installedMacosVerified','installedWindowsVerified'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function verifyCuarzoAcceptance(proof,previous,{commit,projectRef,changedProtectedFiles,expectedCiRun,previousBytes,roleTestedSchema,read=file=>fs.readFile(file)}={}){
 if(previous?.commit!==CUARZO_BASELINE.commit||previous.channel!=='beta'||previous.betaDistributionAuthorized!==true)throw Error('Exact public 1.6.5.1 acceptance required');
 for(const gate of gates)if(previous[gate]!==true)throw Error(`Prior acceptance missing ${gate}`);
 const prior=previous.workspace165Acceptance;
 if(prior?.sourceCommit!==CUARZO_BASELINE.commit||prior.projectRef!==projectRef||WORKSPACE_165_LIVE_CHECKS.some(key=>prior.liveChecks?.[key]!==true))throw Error('Missing inherited support/identity/database acceptance');
 const expectedProtected=[CUARZO_MIGRATION,...(proof?.authUi?CUARZO_AUTH_UI_FILES:[])];
 if(changedProtectedFiles?.length!==expectedProtected.length||expectedProtected.some(file=>!changedProtectedFiles.includes(file)))throw Error('Protected baseline changed beyond the reviewed Cuarzo migration/access form');
 if(proof?.sourceCommit!==commit||proof.projectRef!==projectRef)throw Error('Cuarzo proof must match source commit and project');
 if(proof.migration?.file!==CUARZO_MIGRATION||proof.migration.sha256!==sha(await read(CUARZO_MIGRATION)))throw Error('Cuarzo migration differs from accepted bytes');
 if(!Number.isFinite(Date.parse(proof.verifiedAt))||Math.abs(Date.now()-Date.parse(proof.verifiedAt))>86400000)throw Error('Fresh Cuarzo live acceptance required');
 const ci=proof.ciRun;
 if(!ci||ci.headSha!==commit||ci.conclusion!=='success'||String(ci.runId)!==String(expectedCiRun?.runId)||ci.url!==expectedCiRun?.url||!ci.url.startsWith('https://github.com/'))throw Error('Cuarzo acceptance must cite the same successful native CI run');
 let method='Reuse only unchanged 1.6.5.1 protected sources; Cuarzo migration and transactional production checks are fresh.';
 if(proof.method==='read-only-schema-parity'){
  if(proof.readOnlySource?.file!==CUARZO_READ_ONLY_SOURCE||proof.readOnlySource.sha256!==sha(await read(CUARZO_READ_ONLY_SOURCE)))throw Error('Read-only inspection differs from reviewed source');
  if(roleTestedSchema?.sourceCommit!==commit||roleTestedSchema.assertions!==577)throw Error('Exact role-tested schema artifact from native CI required');
  if(proof.readOnlyResult?.readOnly!==true||proof.readOnlyResult.denials!==6||proof.readOnlyResult.migrationApplied!==true||proof.readOnlyResult.referencesTotal!==proof.referencesBefore)throw Error('Production read-only guard checks missing');
  const matched=verifySchemaEvidence(proof.productionSchema,roleTestedSchema.evidence);
  if(proof.schemaFingerprint!==matched.fingerprint)throw Error('Production schema fingerprint differs');
  method='Production inspected in READ ONLY mode without fixture records; exact schema/function/RBAC parity with the 577-assertion CI-local database. Positive production fixture tests were declined by the owner and were not run.';
 }else{
  if(proof.liveSql?.file!==CUARZO_LIVE_SQL||proof.liveSql.sha256!==sha(await read(CUARZO_LIVE_SQL)))throw Error('Live test differs from accepted bytes');
  const live=proof.liveResult;
  if(!Number.isInteger(live?.checks)||live.checks<28||live.credentials_preserved!==true||live.keynotes_preserved!==true||live.private_copies!==2||proof.transactionRollbackVerified!==true)throw Error('Cuarzo transactional live checks missing');
 }
 if(proof.authUi){
  const tested=roleTestedSchema?.authUi;
  if(proof.method!=='read-only-schema-parity'||tested?.sourceCommit!==commit||tested.assertions!==21||tested.files?.length!==CUARZO_AUTH_UI_FILES.length||proof.authUi.files?.length!==CUARZO_AUTH_UI_FILES.length)throw Error('Exact CI acceptance for the access form required');
  for(const key of ['localFormNavigationVerified','existingLoginAndRecoveryUiVerified','gatewayMockRegistrationVerified','noProductionAccountsCreated'])if(proof.authUi[key]!==true)throw Error(`Missing access-form acceptance ${key}`);
  for(const file of CUARZO_AUTH_UI_FILES){
   const hash=sha(await read(file));
   if(tested.files.find(item=>item.file===file)?.sha256!==hash||proof.authUi.files.find(item=>item.file===file)?.sha256!==hash)throw Error('Access form differs from reviewed and CI-tested bytes');
  }
  method+=' Access-form-only delta verified locally, with server registration mocked in CI; the identity gateway, session transport, server permissions and stored credentials are unchanged.';
 }
 for(const key of ['migrationApplied','privateTablesRlsVerified','anonymousSendDenied','existingReferencesPreserved'])if(proof.schemaChecks?.[key]!==true)throw Error(`Missing schema check ${key}`);
 return {...proof,inheritedEvidence:{release:CUARZO_BASELINE.tag,acceptanceSha256:sha(previousBytes),publishedAcceptance:previous,
   method}};
}
