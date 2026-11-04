import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
const routes=JSON.parse(fs.readFileSync('vercel.json')).routes;
for(const [route,file]of [['/sepia/','public/gba/sepia/index.html'],['/ultramar/','public/gba/ultramar/index.html'],['/sepia/conectar/','public/gba/sepia/conectar/index.html']]){
 const html=fs.readFileSync(file,'utf8');assert.equal((html.match(/<h1[ >]/g)||[]).length,1);assert.match(html,/lang="es"/);assert.match(html,/en (?:desarrollo|preparación)/i);
 for(const url of [route,route.slice(0,-1),'/gba'+route]){const found=routes.find(r=>r.src&&new RegExp(r.src).test(url));assert.equal(found?.dest,'/'+file.replace('public/',''));}
 for(const match of html.matchAll(/(?:src|href)="(\/gba\/[^"#?]+)"/g)){const p='public'+match[1];if(/\.(svg|png|css|js)$/.test(p))assert.ok(fs.existsSync(p),p);}
 assert.doesNotMatch(html,/<form\b|<input\b|fetch\(|license\.activate|pairing\.approve/);
}
const sepia=fs.readFileSync('public/gba/sepia/index.html','utf8');assert.match(sepia,/no se convierten automáticamente/);assert.match(sepia,/no ofrece un instalador público/);assert.equal(/<a[^>]*>\s*(?:Comprar|Descargar Ultramar)/i.test(sepia),false);assert.equal(/\$\d|7 días sin conexión/i.test(sepia),false);
const connect=fs.readFileSync('public/gba/sepia/conectar/index.html','utf8');assert.match(connect,/noindex, nofollow/);assert.match(connect,/todavía no está disponible/);
for(const name of ['public/gba/index.html','public/gba/en/index.html']){const html=fs.readFileSync(name,'utf8');assert.match(html,/data-page="sepia\/"/);assert.match(html,/sepia-home/);assert.match(html,/id="anima"/);assert.match(html,/https:\/\/vista\.gba\.software\//);}
const base='public/gba/workspace/releases.json';assert.equal(fs.readFileSync(base,'utf8'),execFileSync('git',['show','HEAD:'+base],{encoding:'utf8'}));assert.equal(JSON.parse(fs.readFileSync(base)).version,'1.5.0');
console.log('PASS: Sepia/Ultramar public routes, real availability, original assets, no inactive authentication forms, navigation and immutable Workspace base.');
