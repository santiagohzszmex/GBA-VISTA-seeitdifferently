import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import {workspaceIdentityRequest} from '../src/auth/workspaceIdentity.mjs';
export const WORKSPACE_AUTH_UI_FILES=['src/workspace/WorkspaceAuth.jsx','src/auth/workspaceIdentity.mjs'];
export async function runWorkspaceAuthAcceptance(){
 let assertions=0;
 const eq=(a,b)=>{assert.deepEqual(a,b);assertions++;};
 const invalid=(mode,input,pattern)=>{assert.throws(()=>workspaceIdentityRequest(mode,input),pattern);assertions++;};
 const input={handle:'  @Ana  García  ',pin:'0123',confirmation:'0123',recovery:' una frase privada ',recoverySaved:true};
 eq(workspaceIdentityRequest('register',input),{action:'register',handle:'Ana García',pin:'0123',recovery:'una frase privada'});
 eq(workspaceIdentityRequest('login',input),{action:'login',handle:'Ana García',pin:'0123',recovery:''});
 eq(workspaceIdentityRequest('recover',{...input,recovery:'Sol',recoverySaved:false}).recovery,'Sol');
 for(const mode of ['login','register','recover']){
  invalid(mode,{...input,handle:'../../evil'},/GBA ID/);
  invalid(mode,{...input,handle:'<script>'},/GBA ID/);
  invalid(mode,{...input,pin:'12e3'},/4 dígitos/);
 }
 invalid('register',{...input,confirmation:'1234'},/coincidir/);
 invalid('register',{...input,recovery:'        '},/recuperación/);
 invalid('register',{...input,recovery:' 1234567 '},/8 caracteres/);
 invalid('register',{...input,recovery:'a'.repeat(257)},/recuperación/);
 invalid('register',{...input,recoverySaved:false},/guardaste/);
 invalid('recover',{...input,recovery:''},/recuperación/);
 invalid('recover',{...input,confirmation:'1111'},/coincidir/);
 invalid('administrator',input,/cómo/);
 eq(Object.keys(workspaceIdentityRequest('register',input)).sort(),['action','handle','pin','recovery']);
 const files=await Promise.all(WORKSPACE_AUTH_UI_FILES.map(async file=>({file,sha256:createHash('sha256').update(await fs.readFile(new URL('../'+file,import.meta.url))).digest('hex')})));
 console.log(`PASS: ${assertions} Workspace access assertions: shared identity requests, leading-zero PINs, legacy recovery, input rejection, saved recovery and no role/candidate fields.`);
 return {sourceCommit:process.env.GITHUB_SHA,assertions,files};
}
