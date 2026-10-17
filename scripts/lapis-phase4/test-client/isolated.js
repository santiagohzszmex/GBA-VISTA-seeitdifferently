// Build alias used only by the separate Phase 4 test configuration.
export const useAuth=()=>({user:null,logout:async()=>{},refreshUser:async()=>{}});
export const supabase=new Proxy({}, {get(){throw Error('Esta prueba sintética no se conecta a Supabase.');}});
