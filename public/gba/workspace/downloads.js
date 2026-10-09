(async()=>{
 const container=document.getElementById('downloads');
 try{
  const response=await fetch('/gba/workspace/releases.json',{cache:'no-store'});if(!response.ok)throw Error();const release=await response.json();
  const downloads=(release.downloads||[]).filter(d=>['macos','windows'].includes(d.platform)&&/^https:\/\//.test(d.url)&&/^[a-f0-9]{64}$/i.test(d.sha256)&&d.version);
  if(!downloads.length)return;
  container.replaceChildren();
  for(const d of downloads){const card=document.createElement('article');const title=document.createElement('h3');title.textContent=d.platform==='macos'?'macOS':'Windows';const link=document.createElement('a');link.className='button';link.href=d.url;link.rel='noopener noreferrer';link.textContent=`Descargar ${d.version}`;const info=document.createElement('p');info.textContent=`${d.architecture||''} · SHA-256: ${d.sha256}`;info.style.overflowWrap='anywhere';card.append(title,link,info);container.append(card);}
 }catch{const p=document.createElement('p');p.textContent='No pudimos consultar las descargas. Vuelve a intentarlo más tarde.';container.replaceChildren(p);}
})();
