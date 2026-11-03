// Local review only. Default feature flag is OFF; never sets secrets or enables production.
import {createServer} from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createSepiaHandler} from '../../server/sepia/service.mjs';
const root=path.resolve('public');
const handlers={native:createSepiaHandler('native'),'admin-session':createSepiaHandler('admin-session'),admin:createSepiaHandler('admin'),'offline-keys':createSepiaHandler('offline-keys')};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://127.0.0.1').pathname;
 if(pathname.startsWith('/api/sepia/v1')){const route=pathname.split('/')[4]||'native';const api=handlers[route];if(!api){res.writeHead(404).end();return;}const response={setHeader:(...args)=>res.setHeader(...args),status(n){res.statusCode=n;return this;},json(o){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(o));return this;},end(){res.end();return this;}};await api(req,response);return;}
 let route=pathname.replace(/^\/sepia(?=\/|$)/,'/gba/sepia');if(route.endsWith('/'))route+='index.html';
 const file=path.resolve(root,'.'+route);
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 try{const bytes=await fs.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404).end();}
});
server.listen(Number(process.env.SEPIA_REVIEW_PORT||5203),'127.0.0.1',()=>console.log('Sepia local review: http://127.0.0.1:5203/sepia/conectar/ (feature remains off unless explicitly configured).'));
