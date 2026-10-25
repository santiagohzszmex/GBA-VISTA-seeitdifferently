import assert from 'node:assert/strict';
import edition from '../api/edition.js';
import editorial from '../api/editorial.js';
import profile from '../api/profile.js';
import update from '../api/update.js';
const oldFetch=globalThis.fetch;
process.env.VITE_SUPABASE_URL='https://example.invalid';process.env.VITE_SUPABASE_ANON_KEY='local-public-key';
const response=()=>({code:0,headers:{},body:'',status(n){this.code=n;return this;},setHeader(k,v){this.headers[k]=v;},send(s){this.body=s;}});
let requested='';globalThis.fetch=async url=>{requested=url;return {ok:true,json:async()=>[{id:'00000000-0000-4000-8000-000000000001',titulo:'Ahuautle',sello_editorial:'GIMG'}]};};
let r=response();await edition({query:{id:'00000000-0000-4000-8000-000000000001'},headers:{host:'vista.gba.software'}},r);assert.equal(r.code,200);assert.match(requested,/catalog_origin=eq.gimg/);assert.match(requested,/archived_at=is.null/);assert.match(requested,/estado_publicacion=eq.aprobado/);assert.match(r.body,/Leer en VISTA/);
globalThis.fetch=async()=>({ok:true,json:async()=>[]});r=response();await edition({query:{id:'00000000-0000-4000-8000-000000000002'},headers:{}},r);assert.equal(r.code,404);
for(const handler of [editorial,profile,update]){r=response();handler({},r);assert.equal(r.code,410);assert.equal(r.headers['Cache-Control'],'no-store');}
globalThis.fetch=oldFetch;console.log('PASS: GIMG-only share metadata, archived/absent publication 404 and retired community links 410.');
