import fs from 'node:fs/promises';
const auth=JSON.parse(await fs.readFile('/private/tmp/workspace-lapis-phase4-cloudflare-auth.json','utf8'));
const body={queryId:'workspace-lapis-phase4-local-audit',timeframe:{from:Date.now()-3600000,to:Date.now()},parameters:{datasets:['workspace-lapis-phase4-test']},view:'events',limit:200,dry:true};
const r=await fetch('https://api.cloudflare.com/client/v4/accounts/4334afb560574c76fa5054127dcd9b0b/workers/observability/telemetry/query',{method:'POST',headers:{Authorization:`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const b=await r.json();
await fs.writeFile('/private/tmp/workspace-lapis-phase4-metrics-raw.json',JSON.stringify(b),{mode:0o600});
console.log(JSON.stringify({status:r.status,success:b.success,errors:b.errors,resultKeys:Object.keys(b.result||{}),eventKeys:b.result?.events?Object.keys(b.result.events):null}));
