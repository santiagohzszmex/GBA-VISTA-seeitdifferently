// Offline rehearsal only. Never connects to production or copies user data to a remote project.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const folder=process.argv[2];if(!folder)throw Error('Private backup directory required');
const packed=await fs.readFile(folder+'/backup.aes256gcm'),key=await fs.readFile(folder+'/restore.key');
const cipher=crypto.createDecipheriv('aes-256-gcm',key,packed.subarray(0,12));cipher.setAuthTag(packed.subarray(12,28));
const bytes=Buffer.concat([cipher.update(packed.subarray(28)),cipher.final()]);
const inventory=JSON.parse(await fs.readFile(folder+'/inventory.json'));
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),inventory.sha256);
const b=JSON.parse(bytes),db=new PGlite();const quote=s=>'"'+s.replaceAll('"','""')+'"';
await db.exec('create schema workspace_private;');
for(const [table,rows] of Object.entries(b.rows)){
 const [schema,name]=table.split('.'),qualified=quote(schema)+'.'+quote(name);
 const cols=b.columns.filter(c=>c.table_schema===schema&&c.table_name===name).sort((a,b)=>a.ordinal_position-b.ordinal_position);
 assert.ok(cols.length>0);
 const types=cols.map(c=>{if(!['pg_catalog','public'].includes(c.udt_schema))throw Error('Unsupported rehearsal type: '+c.udt_schema);return `${quote(c.column_name)} ${c.data_type==='ARRAY'?quote(c.udt_name.slice(1))+'[]':quote(c.udt_name)}`;});
 await db.exec(`create table ${qualified} (${types.join(',')})`);
 await db.query(`insert into ${qualified} select * from jsonb_populate_recordset(null::${qualified},$1::jsonb)`,[JSON.stringify(rows||[])]);
 // Compare typed PostgreSQL rows, including duplicate counts. JSONB key order
 // and equivalent timestamptz spellings are not data differences. Text values
 // still compare exactly; do not normalize editorial content or timestamps in JS.
 const result=await db.query(`with expected as (select * from jsonb_populate_recordset(null::${qualified},$1::jsonb)), differences as
 ((select * from ${qualified} except all select * from expected)
 union all (select * from expected except all select * from ${qualified}))
 select (select count(*)::integer from differences) as differences,(select count(*)::integer from ${qualified}) as restored`,[JSON.stringify(rows||[])]);
 assert.equal(result.rows[0].differences,0,`Typed restore mismatch: ${table}`);
 assert.equal(result.rows[0].restored,(rows||[]).length,`Restore count mismatch: ${table}`);
}
await db.close();
await fs.writeFile(folder+'/restore-rehearsal.json',JSON.stringify({verified_at:new Date().toISOString(),sha256:inventory.sha256,offline:true,affectedTables:Object.keys(b.rows).length,exactRows:true,scope:'Encrypted export decrypts; affected tables restore with original PostgreSQL column types and exact values. Function definitions, ACL, triggers and constraints retained for selective recovery; no production changes.'},null,2),{mode:0o600});
console.log(`PASS offline backup decryption and exact typed restoration of ${Object.keys(b.rows).length} affected tables.`);
