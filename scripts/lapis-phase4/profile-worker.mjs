import fs from 'node:fs/promises';
const auth=JSON.parse(await fs.readFile('/private/tmp/workspace-lapis-phase4-cloudflare-auth.json','utf8'));
const r=await fetch('https://api.cloudflare.com/client/v4/accounts/4334afb560574c76fa5054127dcd9b0b/workers/workers/workspace-lapis-phase4-test/versions/d4c8b68a-ae84-44c0-aa1d-1534b3a2f0de/profile',{method:'POST',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify({duration_ms:1000,profile_type:'cpu'})});
if(!r.ok){const b=await r.json();console.log(JSON.stringify({status:r.status,errors:b.errors}));}else{await fs.writeFile('/private/tmp/workspace-lapis-phase4-cpu.pprof.gz',Buffer.from(await r.arrayBuffer()));console.log('CPU profile captured');}
