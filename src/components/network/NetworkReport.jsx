import React, { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { networkRpc } from '../../hooks/useNetworkServers';
const metrics=[['people','GBA ID únicos'],['hero_views','Vistas del hero'],['directory_views','Vistas en directorio'],['profile_views','Visitas a la ficha'],['copy_ip','Copias de IP'],['discord_click','Clics a Discord'],['website_click','Clics al sitio'],['map_click','Clics al mapa'],['access_click','Clics al acceso'],['support_click','Clics a apoyo']];
export default function NetworkReport({serverId,partner=null,previewMode=false,dark=false}){
  const [days,setDays]=useState('30');const [data,setData]=useState(null);const [error,setError]=useState('');const [loading,setLoading]=useState(false);const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');setData(null);
    const start=partner?partner.starts_at:new Date(Date.now()-Number(days)*86400000).toISOString();
    const end=partner?partner.ends_at:new Date().toISOString();
    const request=previewMode?Promise.resolve(Object.fromEntries(metrics.map(([key])=>[key,0]))):networkRpc('vista_network_report',{p_server_id:serverId,p_start:start,p_end:end,p_partner_id:partner?.id||null});
    request.then(result=>{if(active)setData(result);}).catch(e=>{if(active)setError(e.message||'No se pudo cargar el reporte.');}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[serverId,partner?.id,partner?.starts_at,partner?.ends_at,days,previewMode,refresh]);
  const exportCsv=()=>{
    const rows=[['Periodo',partner?`${partner.starts_at} — ${partner.ends_at}`:`Últimos ${days} días`],...metrics.map(([key,label])=>[label,String(data?.[key]??0)])];
    const csv='\uFEFF'+rows.map(row=>row.map(value=>'"'+value.replaceAll('"','""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='network-reporte.csv';a.click();URL.revokeObjectURL(url);
  };
  return <section className={dark?'text-white':'text-[#17231f]'}><div className="flex flex-wrap gap-3 items-center mb-5"><h3 className="font-bold text-sm">{partner?'Resultados del patrocinio':'Actividad de tu servidor'}</h3>{!partner&&<select aria-label="Periodo del reporte" className={`ml-auto rounded border px-3 py-2 text-xs ${dark?'bg-[#151d18] border-white/20':'bg-white border-[#dce3dc]'}`} value={days} onChange={e=>setDays(e.target.value)}><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option></select>}<button aria-label="Actualizar reporte" className="p-2" onClick={()=>setRefresh(n=>n+1)} disabled={loading}><RefreshCw size={14}/></button><button className="flex items-center gap-2 text-xs" onClick={exportCsv} disabled={!data||loading}><Download size={14}/>CSV</button></div>{partner&&<p className="text-xs opacity-60 mb-5">{new Date(partner.starts_at).toLocaleDateString()} — {new Date(partner.ends_at).toLocaleDateString()}</p>}
    {loading?<p className="text-xs opacity-60 py-6" role="status">Cargando actividad…</p>:error?<p className="text-xs text-red-500" role="alert">{error}</p>:<div className="grid grid-cols-2 md:grid-cols-4 gap-3">{metrics.map(([key,label])=><div key={key} className={`p-4 rounded border ${dark?'border-white/10 bg-white/5':'border-[#dce3dc] bg-white'}`}><p className="text-[10px] opacity-60">{label}</p><p className="text-2xl font-bold mt-2">{data?.[key]??0}</p></div>)}</div>}
    <p className="text-[11px] opacity-60 leading-5 mt-4">{previewMode?'Datos de demostración. ':''}Cada vista o acción cuenta una vez por GBA ID, día UTC y ubicación. Las vistas requieren al menos un segundo de visibilidad. Copiar una IP o abrir Discord indica interés; la entrada al servidor requiere una medición adicional.</p>
  </section>;
}
