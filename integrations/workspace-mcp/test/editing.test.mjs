import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readDocument, prepareDocumentEdit } from '../editing.mjs';
import { Batches } from '../batches.mjs';

const doc={type:'doc',attrs:{schemaVersion:2},content:[{type:'paragraph',content:[{type:'text',text:'Color violeta',marks:[{type:'bold'}]},{type:'mention',attrs:{id:'person',label:'Persona',anchorId:'anchor'}}]},{type:'originalImage',attrs:{assetId:'image',alt:'Original'}}]};
const reference={id:'ref',title:'Paleta',revision:4,kind:'creative_direction',area_id:null,can_edit:true,palette:['#663399'],content_document:doc,originals:[{id:'image'}]};
const support={...reference,id:'support',title:'Entrevista',document_kind:'interview',area_id:'research',share_scope:'private',credits:'Autora'};
const task={id:'task',title:'Mi investigación',state:'in_progress',current_version:2};
const draft={revision:3,base_version:2,content_document:doc,credits:'Equipo',asset_url:'https://example.org/original'};
const context={actor_id:'actor',references:{references:[reference]},support:{documents:[support]},tasks:[task]};
const rpc=async method=>{if(method==='context')return structuredClone(context);if(method==='draft.get')return structuredClone(draft);throw Error('Unexpected write during preparation');};
const target={project_id:'edition',document_id:'ref',document_type:'reference',expected_revision:4};

test('editing existing references preserves formatting, mentions, originals and revision',async()=>{
 const edit=await prepareDocumentEdit(rpc,{...target,patch:{replacements:[{find:'violeta',replace:'morado',expected_count:1}]}});
 assert.equal(edit.method,'reference.save');assert.equal(edit.args.revision,4);assert.equal(edit.args.data.id,'ref');assert.deepEqual(edit.args.data.palette,['#663399']);
 assert.equal(edit.args.data.content_document.content[0].content[0].text,'Color morado');assert.deepEqual(edit.args.data.content_document.content[0].content[0].marks,[{type:'bold'}]);
 assert.deepEqual(edit.args.data.content_document.content[0].content[1],doc.content[0].content[1]);assert.deepEqual(edit.args.data.content_document.content[1],doc.content[1]);
 assert.deepEqual(edit.preview.originals,[{id:'image'}]);assert.deepEqual(reference.content_document,doc);
 await assert.rejects(prepareDocumentEdit(rpc,{...target,expected_revision:3,patch:{title:'Otro'}}),/documento cambió/);
 await assert.rejects(prepareDocumentEdit(rpc,{...target,patch:{replacements:[{find:'no existe',replace:'otro'}]}}),/aparece 0 veces/);
 await assert.rejects(prepareDocumentEdit(rpc,{...target,patch:{markdown:'Otro',replacements:[{find:'violeta',replace:'morado'}]}}),/una sola forma/);
 await assert.rejects(prepareDocumentEdit(async()=>({...context,references:{references:[{...reference,can_edit:false}]}}),{...target,patch:{title:'Otro'}}),/no editarlo/);
 await assert.rejects(readDocument(rpc,{...target,document_id:'foreign'}),/fuera de tu acceso/);
});

test('support and private draft edits keep scope, credits, source version and assignment identity',async()=>{
 const edit=await prepareDocumentEdit(rpc,{...target,document_type:'support',document_id:'support',expected_revision:4,patch:{title:'Entrevista corregida'}});
 assert.equal(edit.method,'support.save');assert.equal(edit.args.data.area_id,'research');assert.equal(edit.args.data.document_kind,'interview');assert.equal(edit.args.data.credits,'Autora');assert.ok(!('share_scope' in edit.args.data));assert.deepEqual(edit.args.data.content_document,doc);
 const changed=await prepareDocumentEdit(rpc,{...target,document_type:'draft',document_id:'task',expected_revision:3,patch:{credits:'Nueva autora'}});
 assert.equal(changed.method,'draft.save');assert.equal(changed.args.deliverable_id,'task');assert.equal(changed.args.base_version,2);assert.equal(changed.args.data.asset_url,draft.asset_url);
 await assert.rejects(prepareDocumentEdit(rpc,{...target,document_type:'draft',document_id:'task',expected_revision:3,patch:{title:'Cambiar asignación'}}),/Asignaciones/);
 await assert.rejects(prepareDocumentEdit(async m=>m==='context'?{...context,tasks:[{...task,state:'accepted'}]}:draft,{...target,document_type:'draft',document_id:'task',expected_revision:3,patch:{credits:'Otra'}}),/no editarlo/);
});

test('prepared edits do not write until execution and never refresh conflicting revisions',async()=>{
 const directory=await mkdtemp(path.join(tmpdir(),'workspace-edit-'));let writes=0;const requests=new Map();let currentRevision=5;
 const server=async(method,args,key)=>{if(method==='context')return context;if(method==='reference.save'){writes++;if(requests.has(key))return requests.get(key);if(args.revision!==currentRevision)throw Object.assign(Error('El documento cambió'),{status:400});const saved={id:'ref',revision:++currentRevision};requests.set(key,saved);return saved;}throw Error('Unexpected method');};
 try{const batches=new Batches({rpc:server,directory});const prepared=await prepareDocumentEdit(rpc,{...target,patch:{title:'Paleta nueva'}});assert.equal(writes,0);
 const batch={id:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',actor_id:'actor',project_id:'edition',type:'document_edits',items:[{name:'Paleta nueva',status:'pending',method:prepared.method,args:prepared.args,request_id:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'}]};await batches.save(batch);
 const conflict=await batches.execute(batch.id);assert.equal(conflict.pending,1);assert.match(conflict.items[0].error,/documento cambió/);assert.equal((await batches.get(batch.id)).items[0].args.revision,4);
 currentRevision=4;assert.equal((await batches.execute(batch.id)).completed,1);const written=writes;assert.equal((await batches.execute(batch.id)).completed,1);assert.equal(writes,written);
 }finally{await rm(directory,{recursive:true,force:true});}
});
