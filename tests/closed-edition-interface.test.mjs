import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import {pathToFileURL} from 'node:url';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {build} from 'esbuild';
import {isClosedEdition,editionsForScreen,selectedEdition,consultationPermissions,closedEditionData} from '../src/workspace/editionState.mjs';
const projects=[{id:'active',title:'En trabajo',status:'active'},{id:'planned',title:'Planeada',status:'planned'},{id:'closed',title:'Ciclo terminado',status:'closed'},{id:'archived',title:'Archivo',status:'archived'},{id:'deleted',status:'closed',deleted_at:'2026-11-01'}];
assert.equal(isClosedEdition(projects[2]),true);assert.deepEqual(editionsForScreen(projects,'editions').map(x=>x.id),['active','planned']);assert.deepEqual(editionsForScreen(projects,'closed').map(x=>x.id),['closed','archived']);
assert.equal(selectedEdition(projects,'closed','editions'),'active');assert.equal(selectedEdition(projects,'active','closed'),'closed');assert.equal(selectedEdition([],'active','closed'),'');assert.equal(selectedEdition(projects,'archived','settings'),'archived');
const permissions={'project.update':true,'content.edit_assigned':true,'content.comment':true,'content.read_assigned':true,'asset.download_source':true};
const readonly=consultationPermissions(permissions);assert.equal(readonly['project.update'],false);assert.equal(readonly['content.comment'],false);assert.equal(readonly['content.read_assigned'],true);assert.equal(readonly['asset.download_source'],true);
const data={projects,areas:[],tasks:[],versions:[],references:[],approvedDocuments:[],members:[],comments:[],events:[],referencePermissions:permissions,taskPermissions:{x:permissions},support:{creation_areas:['a'],documents:[{id:'s',can_edit:true,can_convert:true}]},images:{enabled:true,uploads_enabled:true}};
const frozen=closedEditionData(data);assert.equal(frozen.support.documents[0].can_edit,false);assert.equal(frozen.support.documents[0].can_convert,false);assert.deepEqual(frozen.support.creation_areas,[]);assert.equal(frozen.images.uploads_enabled,false);assert.equal(data.images.uploads_enabled,true);
await fs.mkdir('release-candidates',{recursive:true});const folder=await fs.mkdtemp(path.resolve('release-candidates','closed-ui-'));
try{
 await build({entryPoints:['src/workspace/ClosedEdition.jsx','src/workspace/WorkspaceNavigation.jsx'],outdir:folder,bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty','.png':'dataurl'},define:{'import.meta.env':JSON.stringify({VITE_SUPABASE_URL:'https://fixture.supabase.co',VITE_SUPABASE_ANON_KEY:'fixture-local-only',DEV:false})}});
 const {default:ClosedEdition}=await import(pathToFileURL(path.join(folder,'ClosedEdition.js')));const {WorkspaceNavigation,EditionTabs}=await import(pathToFileURL(path.join(folder,'WorkspaceNavigation.js')));
 const render=(c,p)=>renderToStaticMarkup(React.createElement(c,p));
 const html=render(ClosedEdition,{project:projects[2],data,actorId:'me',permissions,workApi:async()=>null});assert.match(html,/Sólo consulta/);assert.match(html,/Administrar edición/);assert.doesNotMatch(html,/Nueva referencia|Crear documento|Guardar cambios/);
 const viewer=render(ClosedEdition,{project:projects[2],data,actorId:'me',permissions:{},workApi:async()=>null});assert.doesNotMatch(viewer,/Administrar edición/);
 const active=render(EditionTabs,{projects:editionsForScreen(projects,'editions'),selectedId:'active'});assert.doesNotMatch(active,/Ciclo terminado|Archivo/);
 const closed=render(EditionTabs,{projects:editionsForScreen(projects,'closed'),selectedId:'closed',closed:true});assert.match(closed,/Ciclo terminado/);assert.doesNotMatch(closed,/En trabajo|Planeada/);
 const nav=render(WorkspaceNavigation,{screen:'closed',closedCount:2,context:{},onScreenChange:()=>{}});assert.match(nav,/Cerradas/);assert.match(nav,/aria-current="page"/);
 console.log('PASS: closed-edition navigation, preserved read permissions and no editing controls in consultation view.');
}finally{await fs.rm(folder,{recursive:true,force:true});}
