import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({entryPoints:['src/workspace/workflowDemo.js'],bundle:true,platform:'node',format:'esm',write:false});
const {createWorkflowDemo,workflowDemoData,DEMO_ACTORS,runWorkflowDemo} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
let state = createWorkflowDemo();
const researcher = DEMO_ACTORS.researcher;
const privateId = 'support-private-interview-demo';
const privateDoc = state.supportDocuments.find(row=>row.id===privateId);
const seenByResearcher = workflowDemoData(state,researcher,'halloween-demo').support.documents.map(row=>row.id);
assert(seenByResearcher.includes(privateId),'the author can see their private document');
assert(seenByResearcher.includes('support-shared-research-demo'),'the author can see their area-shared document');
assert(workflowDemoData(state,DEMO_ACTORS.lead,'halloween-demo').support.documents.some(row=>row.id==='support-shared-research-demo'),'the same-area lead can read an area-shared document');
assert(!workflowDemoData(state,DEMO_ACTORS.lead,'halloween-demo').support.documents.some(row=>row.id===privateId),'another person in the same area cannot read a private draft');
assert(!workflowDemoData(state,DEMO_ACTORS.artist,'halloween-demo').support.documents.some(row=>row.area_id==='research-demo'),'a contributor from another area cannot see research support documents');
assert(!('drafts' in workflowDemoData(state,DEMO_ACTORS.artist,'halloween-demo')),'private work drafts are not included in the shared project bundle');
assert(!('supportDocuments' in workflowDemoData(state,researcher,'halloween-demo')),'the backing list is not exposed outside the scoped support bundle');

function support(action,payload,revision) {
  const result=runWorkflowDemo(state,researcher,`support.${action}`,{project_id:'halloween-demo',area_id:privateDoc.area_id,id:privateId,...payload},revision);
  state=result.state;
  return result.result;
}
const originalSnapshot=JSON.stringify(privateDoc.content_document);
support('link',{linked_task_id:'research-task-demo'},privateDoc.revision);
let copy=state.taskReferences['research-task-demo'].find(row=>row.latest_source_id===privateId);
assert(copy,'linking creates a material copy for the task');
assert.equal(state.supportDocuments.find(row=>row.id===privateId).share_scope,'private','linking does not share the live document');
assert.equal(JSON.stringify(copy.snapshot.content_document),originalSnapshot);

const editedDocument={type:'doc',attrs:{schemaVersion:2},content:[{type:'paragraph',content:[{type:'text',text:'Edición privada posterior al vínculo.'}]}]};
let current=state.supportDocuments.find(row=>row.id===privateId);
support('save',{...current,content_document:editedDocument,revision:current.revision},current.revision);
copy=state.taskReferences['research-task-demo'].find(row=>row.latest_source_id===privateId);
assert.equal(JSON.stringify(copy.snapshot.content_document),originalSnapshot,'later edits do not change the frozen task copy');

current=state.supportDocuments.find(row=>row.id===privateId);
support('share',{share_scope:'area'},current.revision);
current=state.supportDocuments.find(row=>row.id===privateId);
support('share',{share_scope:'private'},current.revision);
assert(state.taskReferences['research-task-demo'].some(row=>row.latest_source_id===privateId),'removing area access keeps the task copy');

current=state.supportDocuments.find(row=>row.id===privateId);
const task= support('convert',{},current.revision);
assert.equal(task.state,'assigned');
assert.equal(task.current_version,0);
assert.equal(state.versions.filter(row=>row.deliverable_id===task.id).length,0,'conversion does not submit a review version');
assert(state.drafts[`${task.id}:${researcher.id}`],'conversion creates a private draft');
assert.equal(state.supportDocuments.find(row=>row.id===privateId).converted_task_id,task.id,'the support original remains linked to its conversion');

console.log('PASS: scoped private/shared support visibility, frozen task copies, retained copies after revoking area access, and private non-submitted conversion.');
