import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { WORKSPACE_165_LIVE_CHECKS } from './workspace-165-release-acceptance.mjs';

export const CUARZO_BASELINE={tag:'workspace-v1.6.5.1-beta.1',commit:'0fafccb60e15ec68f32e64c90a67c0b5a52a9fc7'};
export const CUARZO_MIGRATION='supabase/migrations/20261014013712_workspace_cuarzo_documents.sql';
export const CUARZO_LIVE_SQL='tests/workspace-cuarzo-live-acceptance.sql';
const gates=['backupRestoreVerified','stagingAuthVerified','gatewayVerified','membershipRlsVerified','activationExpiryRevocationVerified','installedMacosVerified','installedWindowsVerified'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function verifyCuarzoAcceptance(proof,previous,{commit,projectRef,changedProtectedFiles,expectedCiRun,previousBytes,read=file=>fs.readFile(file)}={}){
 if(previous?.commit!==CUARZO_BASELINE.commit||previous.channel!=='beta'||previous.betaDistributionAuthorized!==true)throw Error('Exact public 1.6.5.1 acceptance required');
 for(const gate of gates)if(previous[gate]!==true)throw Error(`Prior acceptance missing ${gate}`);
 const prior=previous.workspace165Acceptance;
 if(prior?.sourceCommit!==CUARZO_BASELINE.commit||prior.projectRef!==projectRef||WORKSPACE_165_LIVE_CHECKS.some(key=>prior.liveChecks?.[key]!==true))throw Error('Missing inherited support/identity/database acceptance');
 if(changedProtectedFiles?.length!==1||changedProtectedFiles[0]!==CUARZO_MIGRATION)throw Error('Protected baseline changed beyond Cuarzo migration');
 if(proof?.sourceCommit!==commit||proof.projectRef!==projectRef)throw Error('Cuarzo proof must match source commit and project');
 if(proof.migration?.file!==CUARZO_MIGRATION||proof.migration.sha256!==sha(await read(CUARZO_MIGRATION)))throw Error('Cuarzo migration differs from accepted bytes');
 if(proof.liveSql?.file!==CUARZO_LIVE_SQL||proof.liveSql.sha256!==sha(await read(CUARZO_LIVE_SQL)))throw Error('Live test differs from accepted bytes');
 if(!Number.isFinite(Date.parse(proof.verifiedAt))||Math.abs(Date.now()-Date.parse(proof.verifiedAt))>86400000)throw Error('Fresh Cuarzo live acceptance required');
 const ci=proof.ciRun;
 if(!ci||ci.headSha!==commit||ci.conclusion!=='success'||String(ci.runId)!==String(expectedCiRun?.runId)||ci.url!==expectedCiRun?.url||!ci.url.startsWith('https://github.com/'))throw Error('Cuarzo acceptance must cite the same successful native CI run');
 const live=proof.liveResult;
 if(!Number.isInteger(live?.checks)||live.checks<28||live.credentials_preserved!==true||live.keynotes_preserved!==true||live.private_copies!==2||proof.transactionRollbackVerified!==true)throw Error('Cuarzo transactional live checks missing');
 for(const key of ['migrationApplied','privateTablesRlsVerified','anonymousSendDenied','existingReferencesPreserved'])if(proof.schemaChecks?.[key]!==true)throw Error(`Missing schema check ${key}`);
 return {...proof,inheritedEvidence:{release:CUARZO_BASELINE.tag,acceptanceSha256:sha(previousBytes),publishedAcceptance:previous,
   method:'Reuse only unchanged 1.6.5.1 protected sources; Cuarzo migration and transactional production checks are fresh.'}};
}
