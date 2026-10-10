(async()=>{
 const container=document.getElementById('downloads');
 try{
  const response=await fetch('/gba/workspace/releases.json',{cache:'no-store'});if(!response.ok)throw Error();const release=await response.json();
  const beta=release.channel==='beta';
  const downloads=(release.downloads||[]).filter(d=>['macos','windows'].includes(d.platform)&&['aarch64','x86_64'].includes(d.architecture)&&/^https:\/\//.test(d.url)&&/^[a-f0-9]{64}$/i.test(d.sha256)&&d.version&&(d.signing===(d.platform==='macos'?'notarized':'authenticode')||beta&&d.signing===(d.platform==='macos'?'ad-hoc':'unsigned')));
  if(!downloads.length)return;
  container.replaceChildren();
  if(beta){const notice=document.createElement('p');notice.textContent='Versión beta para pruebas. Los paquetes de Mac aún no tienen notarización de Apple y el instalador de Windows no tiene firma digital de distribución. El sistema puede mostrar advertencias o bloquear la apertura.';container.append(notice);}
  for(const d of downloads){
   const card=document.createElement('article');const title=document.createElement('h3');
   title.textContent=d.platform==='macos'?(d.architecture==='aarch64'?'Mac · Apple Silicon':'Mac · Intel'):'Windows · x64';
   const link=document.createElement('a');link.className='button';link.href=d.url;link.rel='noopener noreferrer';link.textContent=`Descargar ${d.version}${beta?' beta':''}`;
   const info=document.createElement('p');info.textContent=d.platform==='macos'?'Abre el archivo DMG y arrastra Workspace a Aplicaciones.':'Abre el instalador EXE y sigue sus pasos.';
   card.append(title,info);
   if(beta){const warning=document.createElement('p');warning.textContent=d.platform==='macos'?'Beta sin notarización de Apple. macOS puede impedir su apertura.':'Beta sin firma digital. Windows puede mostrar un aviso de editor desconocido.';card.append(warning);}
   card.append(link);
   const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Verificar archivo';
   const hash=document.createElement('code');hash.textContent=`SHA-256: ${d.sha256}`;hash.style.overflowWrap='anywhere';details.append(summary,hash);card.append(details);container.append(card);
  }
 }catch{const p=document.createElement('p');p.textContent='No pudimos consultar las descargas. Vuelve a intentarlo más tarde.';container.replaceChildren(p);}
})();
