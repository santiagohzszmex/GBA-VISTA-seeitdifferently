import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const WORKSPACE_165_BASELINE = {
  tag: 'workspace-v1.6.0.2-beta.1',
  commit: '920c3fbf7300d79ab95dfce094a250ac5a957f0a',
};
export const WORKSPACE_165_MIGRATION = {
  file: 'supabase/migrations/20261013040243_workspace_support_and_team.sql',
  sha256: 'de54cb749514d4bfe1deae523b8aed1b4d76e160a6fb2987872cd4bd9cd1d9cd',
};
export const WORKSPACE_165_LIVE_CHECKS = [
  'migrationApplied',
  'privateTablesRlsVerified',
  'privateCreationAndAuthorIsolationVerified',
  'areaShareAndRevocationVerified',
  'frozenAssignmentCopiesVerified',
  'conversionCreatesPrivateUnsubmittedDraftVerified',
  'supportOriginalAuthorizationVerified',
  'teamAreaIsolationVerified',
  'referenceCategoryCatalogVerified',
  'connectorSupportIdempotencyVerified',
];

const RELEASE_GATES = [
  'backupRestoreVerified', 'stagingAuthVerified', 'gatewayVerified',
  'membershipRlsVerified', 'activationExpiryRevocationVerified',
  'installedMacosVerified', 'installedWindowsVerified',
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const baselineBytes = file => execFileSync('git', ['show', `${WORKSPACE_165_BASELINE.commit}:${file}`]);

function inheritedProofs(previous) {
  const identity = previous.identityAcceptance || previous.connectorMaintenanceAcceptance?.inheritedChecks?.identity;
  const database = previous.databaseAcceptance || previous.connectorMaintenanceAcceptance?.inheritedChecks?.database;
  if (!identity || !database) throw Error('Published baseline is missing inherited identity or database acceptance');
  for (const [label, acceptance] of [['identity', identity], ['database', database]]) {
    if (!/^[a-f0-9]{40}$/.test(acceptance.commit || '') || !Array.isArray(acceptance.changes) || !acceptance.changes.length) {
      throw Error(`Published baseline ${label} acceptance is incomplete`);
    }
  }
  if (identity.changes.some(source => !['src/context/AuthContext.jsx', 'src/workspace/WorkspaceAuth.jsx'].includes(source.file))) {
    throw Error('Published identity acceptance contains an unrecognized source');
  }
  if (database.changes.some(source => !/^supabase\/migrations\/[a-zA-Z0-9_]+\.sql$/.test(source.file || ''))) {
    throw Error('Published database acceptance contains an unrecognized source');
  }
  return { identity, database };
}

/**
 * Builds the 1.6.5 DB acceptance artifact by chaining the exact public 1.6.0.2
 * acceptance and requiring fresh live evidence for its only new migration.
 */
export async function verifyWorkspace165Acceptance(proof, previous, {
  commit,
  projectRef,
  changedDatabaseFiles,
  changedIdentityFiles = [],
  expectedCiRun,
  previousBytes = Buffer.from(JSON.stringify(previous)),
  read = file => fs.readFile(file),
  readBaseline = baselineBytes,
} = {}) {
  if (previous?.commit !== WORKSPACE_165_BASELINE.commit || previous.channel !== 'beta' || previous.betaDistributionAuthorized !== true) {
    throw Error('Acceptance must inherit the exact published Workspace 1.6.0.2 beta release');
  }
  for (const key of RELEASE_GATES) if (previous[key] !== true) throw Error(`Published baseline acceptance is missing ${key}`);
  const inherited = inheritedProofs(previous);
  for (const acceptance of [inherited.identity, inherited.database]) {
    for (const source of acceptance.changes) {
      const acceptedHash = source.sha256;
      if (!/^[a-f0-9]{64}$/.test(acceptedHash || '') || hash(await read(source.file)) !== acceptedHash || hash(await readBaseline(source.file)) !== acceptedHash) {
        throw Error('Inherited identity or database source changed; full acceptance required');
      }
    }
  }

  if (proof?.sourceCommit !== commit || proof.projectRef !== projectRef) throw Error('Fresh 1.6.5 acceptance must match the release source commit and project');
  if (changedIdentityFiles.length) throw Error('Identity/authentication code changed since 1.6.0.2; full identity acceptance required');
  if (changedDatabaseFiles?.length !== 1 || changedDatabaseFiles[0] !== WORKSPACE_165_MIGRATION.file) {
    throw Error('Full database acceptance required for database changes outside the reviewed 1.6.5 migration');
  }
  const migrationHash = hash(await read(WORKSPACE_165_MIGRATION.file));
  if (migrationHash !== WORKSPACE_165_MIGRATION.sha256 || proof.migration?.file !== WORKSPACE_165_MIGRATION.file || proof.migration?.sha256 !== migrationHash) {
    throw Error('1.6.5 migration bytes differ from the reviewed acceptance');
  }
  const verifiedAt = Date.parse(proof.verifiedAt);
  if (!Number.isFinite(verifiedAt) || Math.abs(Date.now() - verifiedAt) > 86400000) throw Error('Fresh live 1.6.5 migration acceptance required');
  const ci = proof.ciRun;
  if (!ci || String(ci.runId) !== String(expectedCiRun?.runId) || ci.url !== expectedCiRun?.url || ci.headSha !== commit || ci.conclusion !== 'success' || !/^https:\/\//.test(ci.url || '')) {
    throw Error('Acceptance must cite the successful CI run for this exact source commit');
  }
  for (const key of WORKSPACE_165_LIVE_CHECKS) if (proof.liveChecks?.[key] !== true) throw Error(`Missing fresh 1.6.5 live check: ${key}`);

  return {
    sourceCommit: commit,
    projectRef,
    verifiedAt: proof.verifiedAt,
    ciRun: ci,
    migration: { ...WORKSPACE_165_MIGRATION, sha256: migrationHash },
    liveChecks: Object.fromEntries(WORKSPACE_165_LIVE_CHECKS.map(key => [key, true])),
    inheritedEvidence: {
      release: WORKSPACE_165_BASELINE.tag,
      sourceCommit: WORKSPACE_165_BASELINE.commit,
      acceptanceSha256: hash(previousBytes),
      publishedAcceptance: previous,
      preservedReleaseGates: Object.fromEntries(RELEASE_GATES.map(key => [key, true])),
      inheritedIdentityAcceptance: inherited.identity,
      inheritedDatabaseAcceptance: inherited.database,
      method: 'Published 1.6.0.2 evidence is inherited only for unchanged accepted sources; all listed 1.6.5 migration checks are fresh.',
    },
  };
}
