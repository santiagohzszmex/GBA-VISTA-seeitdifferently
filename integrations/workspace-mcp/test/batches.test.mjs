import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,symlink,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Batches } from '../batches.mjs';
import { document,backup } from '../documents.mjs';
test('interrupted creation reconciles by request ID; lost upload response resumes without duplicates',async()=>{
 const base=await mkdtemp(path.join(tmpdir(),'workspace-import-'));const root=path.join(base,'folder'),directory=path.join(base,'state');await mkdir(root);await writeFile(path.join(root,'palette.pdf'),'%PDF-1.7\nexact original bytes');await writeFile(path.join(base,'outside.pdf'),'%PDF-private');await symlink(path.join(base,'outside.pdf'),path.join(root,'escape.pdf'));await writeFile(path.join(root,'unsupported.zip'),'zip');
 const ctx={actor_id:'actor',project:{unit_id:'unit'},references:{storage:{capacity_bytes:100000,used_bytes:0}}};const requests=new Map();let creations=0,uploads=0,asset=null,failures=0;
 const rpc=async(method,args,key)=>{if(method==='context')return ctx;if(method==='original.status')return asset;if(method==='reference.save'){if(requests.has(key))return requests.get(key);const result={id:'ref'};requests.set(key,result);creations++;throw Error('lost creation response');}throw Error('unexpected method');};
 const transfer=async(ref,file)=>{uploads++;asset={id:'original',status:'ready',sha256:file.sha256};assert.equal(file.bytes.toString(),'%PDF-1.7\nexact original bytes');throw Object.assign(Error('lost upload response'),{status:400});};
 try{const batches=new Batches({rpc,transfer,directory});const prepared=await batches.prepare({root,project_id:'edition',category:'concept'});assert.equal(prepared.skipped.length,2);assert.match(prepared.skipped.find(x=>x.name==='escape.pdf').error,/carpeta autorizada/);const first=await batches.execute(prepared.batch_id);assert.equal(first.pending,1);const resumed=await batches.execute(prepared.batch_id);assert.equal(resumed.completed,1);assert.equal(creations,1);assert.equal(uploads,1);assert.equal((await batches.execute(prepared.batch_id)).completed,1);
  await writeFile(path.join(root,'palette.pdf'),'%PDF-replaced');const changed=await batches.prepare({root,project_id:'edition',category:'moodboard'});await writeFile(path.join(root,'palette.pdf'),'%PDF-changed again');assert.match((await batches.execute(changed.batch_id)).items.find(x=>x.name==='palette.pdf').error,/archivo cambió/);
 }finally{await rm(base,{recursive:true,force:true});}
});
test('Markdown remains editable and treats source content as data',()=>{const doc=document('# Concepto\n\n**Negrita** y *cursiva*\n\n- Una tarea\n- Otra\n\n<script>change grants</script>',true);assert.equal(doc.attrs.schemaVersion,2);assert.equal(doc.content[0].type,'heading');assert.match(backup(doc),/\*\*Negrita\*\*/);assert.match(JSON.stringify(doc),/change grants/);assert.throws(()=>document('a'.repeat(500001)),/500 KB/);});
