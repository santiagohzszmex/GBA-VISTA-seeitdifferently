import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
export const DATABASE_CHECKS = ['databaseMigrationVerified','transactionRollbackVerified','draftLifecycleVerified','privateDraftIsolationVerified','acceptedReferencesVerified','revokedSessionDenied','keynotesPreserved'];
export async function verifyDatabaseAcceptance(proof, { commit, files, projectRef }) {
 if(files.some(file=>!/^supabase\/migrations\/[0-9]+_workspace_personal_drafts_and_library\.sql$/.test(file))) throw Error('Full acceptance required for database changes outside drafts and approved references');
 if(proof?.commit !== commit || proof.projectRef !== projectRef) throw Error('Database acceptance must match the release commit and project');
 if(!Number.isFinite(Date.parse(proof.verifiedAt)) || Math.abs(Date.now()-Date.parse(proof.verifiedAt))>86400000) throw Error('Fresh database acceptance required');
 for(const key of DATABASE_CHECKS) if(proof[key]!==true) throw Error(`Missing database acceptance: ${key}`);
 if(files.length!==proof.changes?.length) throw Error('Database change list differs from acceptance');
 for(const file of files) {
  const accepted=proof.changes.find(item=>item.file===file);
  if(!accepted || !/^supabase\/migrations\/[a-zA-Z0-9_]+\.sql$/.test(file) || createHash('sha256').update(await fs.readFile(file)).digest('hex')!==accepted.sha256) throw Error('Database bytes differ from acceptance');
 }
 return proof;
}
