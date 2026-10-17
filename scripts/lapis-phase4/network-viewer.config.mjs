import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
// Tokens stay on the loopback server; only normal short-lived download links reach WKWebView.
const cfg=JSON.parse(fs.readFileSync('/private/tmp/workspace-lapis-phase4-secrets.json','utf8'));
if(cfg.project!=='ojlcttpqkyktqpqybbdy')throw Error('Isolated test only');
let limited=false;
export default defineConfig({root:path.resolve('scripts/lapis-phase4/network-viewer'),plugins:[react(),{name:'synthetic-network-viewer',configureServer(server){server.middlewares.use('/__lapis',async(req,res,next)=>{
 const route=req.url?.split('?')[0];res.setHeader('Cache-Control','no-store');
 if(route==='/network-mode'){let s='';for await(const c of req)s+=c;if(s.length<100)limited=!!JSON.parse(s).slow;res.statusCode=204;res.end();return;}
 if(route==='/metrics'){let s='';for await(const c of req){s+=c;if(s.length>8192){res.statusCode=413;res.end();return;}}try{fs.appendFileSync('/private/tmp/workspace-lapis-network-viewer.ndjson',JSON.stringify({...JSON.parse(s),network:limited?'deployed-R2+stream-limit-5.24Mbps':'deployed-R2',timestamp:new Date().toISOString()})+'\n');res.statusCode=204;res.end();}catch{res.statusCode=400;res.end();}return;}
 if(route==='/network-manifest'){res.setHeader('Content-Type','application/json');res.end(fs.readFileSync('/private/tmp/workspace-lapis-network-manifest.json'));return;}
 const m=/^\/network-link\/([a-f0-9-]{36})$/.exec(route||'');
 if(m){const allowed=JSON.parse(fs.readFileSync('/private/tmp/workspace-lapis-network-manifest.json')).assets;if(!allowed.some(a=>a.id===m[1])){res.statusCode=403;res.end();return;}
 const r=await fetch(`${cfg.gateway_url}/images/files/${m[1]}/original/link`,{method:'POST',headers:{Authorization:`Bearer ${cfg.sessions[2].access_token}`}});res.statusCode=r.status;res.setHeader('Content-Type','application/json');res.end(await r.text());return;}
 next();
 });}}],server:{host:'127.0.0.1',port:1420,strictPort:true,fs:{allow:[path.resolve('.')]}}});
