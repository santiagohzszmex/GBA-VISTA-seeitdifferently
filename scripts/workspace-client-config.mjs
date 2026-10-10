const {VITE_SUPABASE_URL:url,VITE_SUPABASE_ANON_KEY:key,VITE_GBA_ID_API_URL:api}=process.env;
if(url!=='https://wgihpztgwsovhykboyru.supabase.co') throw Error('Workspace must target the approved Supabase project');
if(!key) throw Error('Missing public Supabase client key');
if(key.startsWith('sb_secret_')) throw Error('A server key must never enter a desktop build');
if(!key.startsWith('sb_publishable_')) {
  let claims;
  try { claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()); } catch { throw Error('Invalid public Supabase client key'); }
  if(claims.role!=='anon'||claims.ref!=='wgihpztgwsovhykboyru') throw Error('Expected anon key for approved project');
}
if(api!=='https://gba.software/api/gba-id') throw Error('Unexpected identity gateway');
console.log('Public client configuration verified; no server key accepted.');
