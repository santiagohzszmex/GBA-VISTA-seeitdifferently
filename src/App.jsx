import React from 'react';
import {AuthProvider,useAuth} from './context/AuthContext';
import WorkspaceAuth from './workspace/WorkspaceAuth';
import WorkspaceView from './views/Workspace';
import GimgVista from './vista/GimgVista';
import {RadioProvider} from './radio/RadioContext';
const Mothership=React.lazy(()=>import('./views/Mothership'));
const WorkspacePublications=React.lazy(()=>import('./workspace/WorkspacePublications'));
const Keynotes=React.lazy(()=>import('./views/Keynotes'));
const UpdatePreview=import.meta.env.DEV?React.lazy(()=>import('./workspace/UpdatePreview')):null;
const path=window.location.pathname.replace(/\/$/,'');
const params=new URLSearchParams(window.location.search);
const workspace=path==='/workspace/web'||params.get('workspace')==='1';
const administration=path==='/mothership';
function MainApp(){
 const {user,isDueño}=useAuth();
 if(workspace)return user?<WorkspaceView/>:<WorkspaceAuth/>;
 if(import.meta.env.DEV&&params.get('workspace-preview')==='1')return <WorkspaceView previewMode/>;
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
 React.useEffect(()=>{document.title=workspace?'Workspace · GIMG':administration?'Mothership · GBA':'VISTA · Publicaciones de GIMG';if(workspace){const icon=document.createElement('link');icon.rel='icon';icon.type='image/png';icon.href='/gba/workspace/workspace-icon.png';document.head.append(icon);return()=>icon.remove();}},[]);
 if(import.meta.env.DEV&&params.has('workspace-update-preview'))return <React.Suspense fallback={<p>Cargando prueba…</p>}><UpdatePreview/></React.Suspense>;
 return <RadioProvider><AuthProvider productName={workspace?'Workspace':administration?'Mothership':'VISTA'}><MainApp/></AuthProvider></RadioProvider>;
}
