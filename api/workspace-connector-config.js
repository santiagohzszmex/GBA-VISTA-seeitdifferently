// Only public browser configuration; never return the server/service key.
export function createConfigHandler(env=process.env) {return function handler(request,response) {
  response.setHeader('Cache-Control','no-store');
  if (request.method!=='GET') return response.status(405).json({error:'Método no permitido'});
  const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL;
  const key=env.SUPABASE_ANON_KEY||env.VITE_SUPABASE_ANON_KEY;
  let publicKey=key?.startsWith('sb_publishable_');
  if(!publicKey&&key){try{publicKey=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role==='anon';}catch{}}
  if(url!=='https://wgihpztgwsovhykboyru.supabase.co'||!publicKey) return response.status(503).json({error:'Configuración pública pendiente'});
  return response.status(200).json({supabaseUrl:url,publishableKey:key,gatewayUrl:'https://workspace-originals.gba-vista.workers.dev'});
};}
export default createConfigHandler();
