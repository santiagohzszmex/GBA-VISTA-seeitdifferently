import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
export const DATABASE_CHECKS = ['databaseMigrationVerified','transactionRollbackVerified','draftLifecycleVerified','privateDraftIsolationVerified','acceptedReferencesVerified','revokedSessionDenied','keynotesPreserved'];
export const PRISMA_DATABASE_CHECKS = ['referenceAuthorityVerified','referenceHistoryVerified','originalAccessVerified','storageCapacityVerified','operationLimitsVerified','uploadRevocationVerified','r2RoundTripVerified'];
export const NOTIFICATION_CHECKS=['notificationScopesVerified','notificationReadIsolationVerified','notificationRevocationVerified','legacyConceptVerified','editionRemovalVerified','editionRestoreVerified'];
export async function verifyDatabaseAcceptance(proof, { commit, files, projectRef }) {
 if(files.some(file=>!/^supabase\/migrations\/[0-9]+_workspace_(personal_drafts_and_library|prisma_references_and_originals|prisma_original_completion_scope|prisma_metered_singleton_updates|prisma_notifications|prisma_edition_removal)\.sql$/.test(file))) throw Error('Full acceptance required for database changes outside reviewed Workspace migrations');
 if(proof?.commit !== commit || proof.projectRef !== projectRef) throw Error('Database acceptance must match the release commit and project');
 if(!Number.isFinite(Date.parse(proof.verifiedAt)) || Math.abs(Date.now()-Date.parse(proof.verifiedAt))>86400000) throw Error('Fresh database acceptance required');
 if(files.some(file=>file.includes('_workspace_prisma_notifications') || file.includes('_workspace_prisma_edition_removal'))) for(const key of NOTIFICATION_CHECKS) if(proof[key]!==true)throw Error(`Missing 1.5.5 acceptance: ${key}`);
 if(files.some(file=>file.includes('_workspace_prisma_'))) {
  for(const key of PRISMA_DATABASE_CHECKS) if(proof[key]!==true) throw Error(`Missing Prisma acceptance: ${key}`);
  if(!/^https:\/\/workspace-originals\.[a-z0-9.-]+\.workers\.dev$/.test(proof.r2?.gatewayUrl||'') || proof.r2?.bucket!=='workspace-originals' || proof.r2?.storageClass!=='Standard' || proof.r2?.capacityBytes!==10000000000 || !/^[a-f0-9]{64}$/.test(proof.r2?.uploadedSha256||'') || proof.r2.uploadedSha256!==proof.r2.downloadedSha256) throw Error('Live R2 integrity evidence is required');
 }
 for(const key of DATABASE_CHECKS) if(proof[key]!==true) throw Error(`Missing database acceptance: ${key}`);
 if(files.length!==proof.changes?.length) throw Error('Database change list differs from acceptance');
 for(const file of files) {
  const accepted=proof.changes.find(item=>item.file===file);
  if(!accepted || !/^supabase\/migrations\/[a-zA-Z0-9_]+\.sql$/.test(file) || createHash('sha256').update(await fs.readFile(file)).digest('hex')!==accepted.sha256) throw Error('Database bytes differ from acceptance');
 }
 return proof;
}
