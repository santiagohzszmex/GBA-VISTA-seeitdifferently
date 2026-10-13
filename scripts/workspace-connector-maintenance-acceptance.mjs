import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

export const CONNECTOR_BASELINE={tag:'workspace-v1.6.0.1-beta.1',commit:'09e50c1c2a9b8c60ab3689e66da47ed316db0fdf'};
export const CONNECTOR_DELTA=[
 'api/workspace-connector-config.js',
 'cloudflare/workspace-originals/worker.mjs',
 'supabase/migrations/20261012230342_gimg_close_illustration.sql',
 'supabase/migrations/20261012232451_gimg_recruitment_vacancies.sql',
 'supabase/migrations/20261013000619_workspace_connector.sql'
];
export const CONNECTOR_CHECKS=['migrationsApplied','privateTablesRls','anonymousRegistrationDenied','privateDispatcherDenied','authenticatedEditorialContextVerified','invalidCapabilityDenied','publicConfigSecretDenied','storageCapacityVerified','closedRecruitmentAreasVerified','resumableImportsVerified'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function verifyConnectorMaintenanceAcceptance(proof,previous,{commit,projectRef,changedFiles,read=file=>fs.readFile(file),readBaseline=file=>execFileSync('git',['show',`${CONNECTOR_BASELINE.commit}:${file}`])}){
 if(proof?.commit!==commit||proof.projectRef!==projectRef||proof.baselineCommit!==CONNECTOR_BASELINE.commit||previous?.commit!==CONNECTOR_BASELINE.commit)throw Error('Maintenance acceptance must match the exact published baseline, project and release commit');
 if(!Number.isFinite(Date.parse(proof.verifiedAt))||Math.abs(Date.now()-Date.parse(proof.verifiedAt))>86400000)throw Error('Fresh connector acceptance required');
 if(previous.channel!=='beta'||previous.betaDistributionAuthorized!==true||!previous.databaseAcceptance||!previous.identityAcceptance)throw Error('Published baseline acceptance is incomplete');
 if(changedFiles.length!==CONNECTOR_DELTA.length||CONNECTOR_DELTA.some(file=>!changedFiles.includes(file)))throw Error('Full acceptance required for server changes outside the reviewed connector delta');
 for(const key of CONNECTOR_CHECKS)if(proof.checks?.[key]!==true)throw Error(`Missing connector maintenance acceptance: ${key}`);
 if(proof.changes?.length!==changedFiles.length)throw Error('Maintenance change list differs');
 for(const file of changedFiles)if(proof.changes.find(x=>x.file===file)?.sha256!==hash(await read(file)))throw Error('Connector source bytes differ from acceptance');
 for(const acceptance of [previous.identityAcceptance,previous.databaseAcceptance]){
  if(acceptance.commit!==CONNECTOR_BASELINE.commit)throw Error('Inherited acceptance has a different source commit');
  for(const source of acceptance.changes||[])if(source.sha256!==hash(await read(source.file))||source.sha256!==hash(await readBaseline(source.file)))throw Error('Previously accepted identity or database source changed; full acceptance required');
 }
 if(proof.capacityBytes!==10000000000||proof.actorVerified!==true||!proof.evidence?.nativeValidationRun)throw Error('Connector live evidence is incomplete');
 return {commit,projectRef,verifiedAt:proof.verifiedAt,baselineCommit:CONNECTOR_BASELINE.commit,baselineRelease:CONNECTOR_BASELINE.tag,
  inheritedChecks:{identity:previous.identityAcceptance,database:previous.databaseAcceptance},checks:proof.checks,changes:proof.changes,evidence:proof.evidence,
  method:'Exact unchanged legacy source plus fresh scoped connector/server acceptance. No legacy checks are represented as newly repeated.'};
}
