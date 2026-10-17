// Test identities only, on the isolated Supabase project. Never accept production.
import fs from 'node:fs/promises';
const file='/private/tmp/workspace-lapis-phase4-secrets.json';
const cfg=JSON.parse(await fs.readFile(file,'utf8'));
if(cfg.project!=='ojlcttpqkyktqpqybbdy')throw Error('Test project mismatch');
const sessions={};
for(let n=1;n<=6;n++){
 const r=await fetch(`${cfg.url}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({email:`lapis-phase4-${n}@example.invalid`,password:cfg.password})});
 const b=await r.json();if(!r.ok)throw Error(`Auth ${n}: ${r.status} ${b.msg||b.message||b.error_description}`);
 sessions[n]={access_token:b.access_token,refresh_token:b.refresh_token,user_id:b.user.id,session_id:JSON.parse(Buffer.from(b.access_token.split('.')[1],'base64url')).session_id};
}
cfg.sessions=sessions;await fs.writeFile(file,JSON.stringify(cfg),{mode:0o600});console.log('PASS: six real Auth sessions created in isolated test project; tokens stored privately.');
