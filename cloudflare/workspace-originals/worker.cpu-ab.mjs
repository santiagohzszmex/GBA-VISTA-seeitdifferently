// EXPERIMENT ONLY. Never use as the production entry point.
import original from './worker.mjs';
import {createImageGateway} from './images/gateway.mjs';
export function assertTestEnvironment(env){
 if(env.SUPABASE_URL!=='https://ojlcttpqkyktqpqybbdy.supabase.co'||env.LAPIS_CPU_AB!=='synthetic-test-only')throw Error('CPU experiment requires isolated test bindings');
}
export async function testCompletionHash({request,env,asset,verifyFull}){
 assertTestEnvironment(env);
 // Only PNG header + size inspection in A; the SQL sha field is a CLIENT CLAIM.
 return request.headers.get('X-Lapis-Variant')==='A'&&asset.role==='png'?asset.sha256:verifyFull();
}
const images=createImageGateway({completionHash:testCompletionHash});
export default {
 async fetch(request,env,ctx){
  assertTestEnvironment(env);
  if(!/^\/(images|image-downloads)(\/|$)/.test(new URL(request.url).pathname))return original.fetch(request,env,ctx);
  const response=await images.fetch(request,env,ctx);
  const label=request.headers.get('X-Lapis-Trial');
  if(label&&/^[AB]-(typical|limit)-[1-3]$/.test(label))console.log(JSON.stringify({message:'lapis-cpu-ab',trial:label,phase:request.method==='PUT'?'part':new URL(request.url).pathname.endsWith('/complete')?'complete':'open',status:response.status}));
  return response;
 },
 scheduled:original.scheduled
};
