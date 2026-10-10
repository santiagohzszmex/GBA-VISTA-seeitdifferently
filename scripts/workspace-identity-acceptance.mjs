import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
export const IDENTITY_CHECKS = ['serverIdentityUnchanged','sessionLogicUnchanged','gatewayLoginVerified','gatewayRecoveryVerified','legacyRecoveryVerified','revokedSessionDenied','transactionRollbackVerified','credentialsPreserved','keynotesPreserved','workspaceSignInUiVerified'];
export async function verifyPresentationAcceptance(proof,{commit,files,projectRef,baseline}) {
  if(files.length!==1 || files[0]!=='src/context/AuthContext.jsx') throw Error('Full identity acceptance required for changes beyond session presentation');
  if(proof?.commit!==commit || proof.projectRef!==projectRef || !Number.isFinite(Date.parse(proof.verifiedAt)) || Math.abs(Date.now()-Date.parse(proof.verifiedAt))>86400000)throw Error('Fresh identity acceptance must match the source commit');
  for(const check of IDENTITY_CHECKS)if(proof[check]!==true)throw Error(`Missing identity acceptance: ${check}`);
  const source=await fs.readFile(files[0],'utf8');
  const normalized=source
    .replace("({ children, productName = 'VISTA' })",'({ children })')
    .replace(`<p className={productName === 'Workspace' ? 'text-3xl font-semibold tracking-tight mb-7' : 'font-serif italic text-5xl mb-7'}>{productName === 'Workspace' ? productName : 'VISTA.'}</p>`,`<p className="font-serif italic text-5xl mb-7">VISTA.</p>`)
    .replace('Abriendo {productName}…','Abriendo VISTA…');
  if(!/^[a-f0-9]{40}$/.test(baseline))throw Error('Invalid identity baseline');
  let original;
  try { original=execFileSync('git',['show',`${baseline}:${files[0]}`],{encoding:'utf8',stdio:['ignore','pipe','ignore']}); }
  catch {
    // CI checks out a shallow tree. Fetch just the immutable public baseline;
    // no credentials or workflow permission changes are needed.
    execFileSync('git',['fetch','--depth=1','origin',baseline],{stdio:['ignore','pipe','pipe'],timeout:60000});
    original=execFileSync('git',['show',`${baseline}:${files[0]}`],{encoding:'utf8'});
  }
  if(normalized!==original)throw Error('Session logic changed; full identity acceptance is required');
  const paths=['src/context/AuthContext.jsx','src/workspace/WorkspaceAuth.jsx'];
  if(proof.changes?.length!==paths.length)throw Error('Identity presentation proof is incomplete');
  for(const file of paths)if(proof.changes.find(item=>item.file===file)?.sha256!==createHash('sha256').update(await fs.readFile(file)).digest('hex'))throw Error('Identity source differs from acceptance');
  return proof;
}
