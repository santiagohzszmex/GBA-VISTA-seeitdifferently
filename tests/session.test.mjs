import assert from 'node:assert/strict';
import { createSessionLoader } from '../src/auth/sessionLoader.js';

const session=id=>({user:{id}});
const deferred=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
let checks=0;
function setup(overrides={}){
 const state={user:'initial',loading:true,error:'',reads:0,signOuts:0,activity:0};let listener;
 const auth={getSession:async()=>({data:{session:session('a')},error:null}),signOut:async()=>{state.signOuts++;listener?.('SIGNED_OUT',null);},onAuthStateChange:callback=>{listener=callback;return {data:{subscription:{unsubscribe(){}}}};},...overrides.auth};
 const loader=createSessionLoader({auth,readProfile:async(id,signal)=>{state.reads++;return overrides.read?await overrides.read(id,signal):{id,rol:'Ciudadano'};},recordActivity:async()=>{state.activity++;},onUser:value=>{state.user=value;},onLoading:value=>{state.loading=value;},onError:value=>{state.error=value;},timeoutMs:30});
 return {loader,state,auth,emit:(...args)=>listener?.(...args)};
}
const eq=(actual,expected)=>{assert.deepEqual(actual,expected);checks++;};
{
 const t=setup();await t.loader.restore();eq(t.state.user.id,'a');eq(t.state.loading,false);eq(t.state.error,'');eq(t.state.activity,1);t.loader.dispose();
}
{
 const t=setup({auth:{getSession:async()=>({data:{session:null},error:null})}});await t.loader.start();eq(t.state.user,null);eq(t.state.reads,0);eq(t.state.loading,false);t.loader.dispose();
}
{
 const wait=deferred();const t=setup({read:()=>wait.promise});const first=t.loader.load(session('a'));const second=t.loader.load(session('a'));eq(t.state.reads,1);wait.resolve({id:'a'});await Promise.all([first,second]);eq(t.state.user.id,'a');t.loader.dispose();
}
{
 const wait=deferred();const t=setup({read:id=>id==='a'?wait.promise:Promise.resolve({id})});const first=t.loader.load(session('a'));await t.loader.load(session('b'));wait.resolve({id:'a'});await first;eq(t.state.user.id,'b');t.loader.dispose();
}
{
 const wait=deferred();const t=setup({read:()=>wait.promise});const first=t.loader.load(session('a'));t.loader.clearSession();wait.resolve({id:'a'});await first;eq(t.state.user,null);eq(t.state.loading,false);t.loader.dispose();
}
{
 let attempt=0;const t=setup({read:()=>++attempt===1?new Promise(()=>{}):Promise.resolve({id:'a'})});await t.loader.restore();eq(t.state.loading,false);eq(t.state.error.includes('Tu sesión se conserva'),true);eq(t.state.signOuts,0);await t.loader.restore();eq(t.state.user.id,'a');eq(t.state.error,'');t.loader.dispose();
}
{
 const t=setup({read:async()=>{throw new Error('temporary network failure');}});await t.loader.restore();eq(t.state.signOuts,0);eq(t.state.error.length>0,true);eq(t.state.loading,false);t.loader.dispose();
}
{
 const t=setup({read:async()=>null});await t.loader.start();eq(t.state.signOuts,1);eq(t.state.user,null);eq(t.state.loading,false);t.loader.dispose();
}
{
 let listener;let locked=false;
 const t=setup({auth:{onAuthStateChange:callback=>{listener=callback;return {data:{subscription:{unsubscribe(){}}}};},getSession:async()=>{locked=true;const result=listener('SIGNED_IN',session('a'));eq(result,undefined);locked=false;return {data:{session:session('a')},error:null};}},read:async id=>{eq(locked,false);return {id};}});
 await t.loader.start();await new Promise(resolve=>setTimeout(resolve,2));eq(t.state.reads,1);eq(t.state.user.id,'a');t.loader.dispose();
}
{
 const t=setup({auth:{getSession:async()=>({data:{session:null},error:null})}});await t.loader.start();t.emit('SIGNED_IN',session('a'));t.emit('SIGNED_OUT',null);await new Promise(resolve=>setTimeout(resolve,3));eq(t.state.user,null);eq(t.state.reads,0);t.loader.dispose();
}
{
 const wait=deferred();const t=setup({read:()=>wait.promise});const load=t.loader.load(session('a'));t.loader.dispose();wait.resolve({id:'a'});await load;eq(t.state.user,'initial');
}
{
 const t=setup({auth:{getSession:()=>new Promise(()=>{})}});await t.loader.restore();eq(t.state.error.includes('Tu sesión se conserva'),true);eq(t.state.signOuts,0);eq(t.state.reads,0);t.loader.dispose();
}
{
 const wait=deferred();const t=setup({auth:{getSession:()=>wait.promise}});const initial=t.loader.restore();await t.loader.load(session('b'));wait.resolve({data:{session:session('a')},error:null});await initial;eq(t.state.user.id,'b');eq(t.state.reads,1);t.loader.dispose();
}
{
 const wait=deferred();const t=setup({read:()=>wait.promise});await t.loader.restore();wait.resolve({id:'late'});await Promise.resolve();eq(t.state.user,'initial');eq(t.state.error.includes('Tu sesión se conserva'),true);t.loader.dispose();
}
{
 let fail=false;const t=setup({read:async id=>{if(fail)throw new Error('503');return {id};}});await t.loader.load(session('a'));fail=true;await t.loader.load(session('a'),true);eq(t.state.user.id,'a');eq(t.state.signOuts,0);t.loader.dispose();
}
{
 const t=setup();await t.loader.start();t.emit('TOKEN_REFRESHED',session('a'));await new Promise(resolve=>setTimeout(resolve,2));eq(t.state.reads,1);eq(t.state.user.id,'a');eq(t.state.error,'');t.loader.dispose();
}
{
 const t=setup({auth:{getSession:async()=>({data:{session:null},error:new Error('temporary')})}});await t.loader.restore();eq(t.state.signOuts,0);eq(t.state.loading,false);eq(t.state.error.length>0,true);t.loader.dispose();
}
{
 let signal;const wait=deferred();const t=setup({read:(id,value)=>{signal=value;return wait.promise;}});const load=t.loader.load(session('a'));t.loader.dispose();await load;eq(signal.aborted,true);eq(t.state.user,'initial');
}
console.log(`PASS: ${checks} session assertions for startup, auth lock, retries, temporary errors, stale requests, sign-out and cleanup.`);
