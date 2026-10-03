export const EDITIONS = { java: 'Java', bedrock: 'Bedrock', crossplay: 'Java + Bedrock' };
export const STYLES = ['Geopolítico', 'Towny', 'Naciones', 'Roleplay'];
export const GAME_STATUS = { activo: 'Activo', proximamente: 'Próximamente', mantenimiento: 'Mantenimiento' };
export const PLACEMENTS = { directory: 'Destacado en el directorio', hero: 'Hero de pantalla completa', both: 'Hero + directorio' };
export const REVIEW_STATUS = { pendiente: 'En revisión', aprobado: 'Publicado', rechazado: 'Requiere cambios', suspendido: 'Suspendido' };
export const PARTNER_STATUS = { draft: 'Borrador', active: 'Activo', paused: 'Pausado', ended: 'Finalizado' };
export const safeUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; } };
export const activePartners = (partners, now = Date.now()) => partners.filter(p => new Date(p.starts_at).getTime() <= now && new Date(p.ends_at).getTime() > now);
export const partnerStatus = p => p.state === 'active' && new Date(p.ends_at).getTime() <= Date.now() ? 'Vencido' : p.state === 'active' && new Date(p.starts_at).getTime() > Date.now() ? 'Programado' : PARTNER_STATUS[p.state];
export const EMPTY_SERVER = { nombre: '', headline: '', descripcion: '', ip: '', discord_url: '', website_url: '', map_url: '', logo_url: '', portada_url: '', idioma: 'Español', edition: 'java', version: '', estilo: 'Geopolítico', region: '', game_status: 'activo' };
export const serverPayload = server => Object.fromEntries(Object.keys(EMPTY_SERVER).map(key => [key, server[key] ?? EMPTY_SERVER[key]]));
// Demonstration data is available only in Vite's development preview.
export const PREVIEW_SERVERS = [
  { ...EMPTY_SERVER, id:'preview-atlas', slug:'atlas-geopolitico', nombre:'Atlas Geopolítico', headline:'Cada nación tiene una historia. Construye la tuya.', descripcion:'Una comunidad de muestra donde la diplomacia, el comercio y las decisiones de cada nación construyen un mundo compartido.', ip:'play.example.invalid', idioma:'Español', edition:'crossplay', estilo:'Naciones', region:'Latinoamérica', version:'1.21', estado:'aprobado', verificada:true, owner_id:'preview-owner' },
  { ...EMPTY_SERVER, id:'preview-horizonte', slug:'horizonte-nations', nombre:'Horizonte Nations', headline:'Un territorio por descubrir.', descripcion:'Servidor de muestra centrado en ciudades, acuerdos entre comunidades y una economía creada por sus jugadores.', ip:'mc.example.invalid', idioma:'Español', edition:'java', estilo:'Towny', region:'Global', version:'1.21', estado:'aprobado', verificada:false, owner_id:'preview-owner' },
  { ...EMPTY_SERVER, id:'preview-meridian', slug:'meridian-roleplay', nombre:'Meridian Roleplay', headline:'La próxima era empieza contigo.', descripcion:'Comunidad de muestra para historias políticas, instituciones y personajes que cambian el rumbo de sus naciones.', discord_url:'https://discord.com', idioma:'English', edition:'java', estilo:'Roleplay', game_status:'proximamente', estado:'aprobado', verificada:false, owner_id:'preview-owner' }
];
export const PREVIEW_PARTNERS = [
  { id:'preview-partner-atlas', server_id:'preview-atlas', placement:'both', starts_at:new Date(Date.now()-86400000).toISOString(), ends_at:new Date(Date.now()+30*86400000).toISOString(), hero_title:'El mundo lo\nescriben sus\nnaciones.', hero_description:'Funda una ciudad. Firma un tratado. Deja una historia que merezca contarse.', hero_image_url:'', state:'active', payment_confirmed:true, amount:0, currency:'USD', deliverables:'Datos de demostración. No representan un acuerdo comercial.' },
  { id:'preview-partner-meridian', server_id:'preview-meridian', placement:'hero', starts_at:new Date(Date.now()-86400000).toISOString(), ends_at:new Date(Date.now()+30*86400000).toISOString(), hero_title:'Una nueva era.\nTu propio\ncamino.', hero_description:'Conoce una comunidad donde cada decisión abre una historia diferente.', hero_image_url:'', state:'active', payment_confirmed:true, amount:0, currency:'USD', deliverables:'Datos de demostración. No representan un acuerdo comercial.' }
];
