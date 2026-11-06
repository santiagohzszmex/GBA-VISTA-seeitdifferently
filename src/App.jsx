import React from 'react';
import {AuthProvider,useAuth} from './context/AuthContext';
import WorkspaceAuth from './workspace/WorkspaceAuth';
import GimgVista from './vista/GimgVista';
import {RadioProvider} from './radio/RadioContext';
const Mothership=React.lazy(()=>import('./views/Mothership'));
const WorkspacePublications=React.lazy(()=>import('./workspace/WorkspacePublications'));
const Keynotes=React.lazy(()=>import('./views/Keynotes'));
const path=window.location.pathname.replace(/\/$/,'');
const params=new URLSearchParams(window.location.search);
// Workspace vive en su propio repositorio (gba-workspace); /workspace/web se enruta a su proyecto.
const administration=path==='/mothership';
function MainApp(){
 const {user,isDueño}=useAuth();
 if(administration){
  if(!user)return <WorkspaceAuth productName="Mothership"/>;
  if(!isDueño)return <main className="gv"><section className="gv-reader"><h1>Acceso reservado.</h1><p>Mothership está disponible para la administración de GBA.</p><a href="/workspace/web/">Ir a Workspace</a></section></main>;
  return <React.Suspense fallback={<p role="status">Abriendo Mothership…</p>}><div className="bg-[#0a0a0a] px-6 py-4 text-sm text-neutral-400"><a href="https://vista.gba.software/">← VISTA</a><span className="mx-4">·</span><a href="/workspace/web/">Workspace</a></div><Mothership/></React.Suspense>;
 }
 if(params.get('gimg-publications')==='1')return <React.Suspense fallback={<p>Cargando publicaciones…</p>}><WorkspacePublications/></React.Suspense>;
 if(params.has('keynote')||path==='/keynotes')return <React.Suspense fallback={<p>Cargando Keynotes…</p>}><Keynotes initialSlug={params.get('keynote')}/></React.Suspense>;
 return <GimgVista preview={import.meta.env.DEV&&params.get('vista-preview')==='1'}/>;
}
export default function App(){
 React.useEffect(()=>{document.title=administration?'Mothership · GBA':'VISTA · Publicaciones de GIMG';},[]);
 return <RadioProvider><AuthProvider productName={administration?'Mothership':'VISTA'}><MainApp/></AuthProvider></RadioProvider>;
}
