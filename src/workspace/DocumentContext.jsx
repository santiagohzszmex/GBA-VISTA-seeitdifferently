import React, { createContext, useContext, useEffect, useState } from 'react';
import { readReferenceOriginal } from './referenceAssets';

export const DocumentContext = createContext({ originals: {}, gateway: '', actorId: '', candidates: async () => [] });
export const useDocumentContext = () => useContext(DocumentContext);

export function DocumentImage({ assetId, caption, credits }) {
  const { originals, gateway, actorId } = useDocumentContext();
  const asset = originals?.[assetId];
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [unsupported,setUnsupported] = useState(false);
  useEffect(() => {
    let live = true, objectUrl;
    setUrl(''); setError(''); setUnsupported(false);
    if (!asset || !gateway) return;
    readReferenceOriginal(gateway, asset).then(blob => {
      if (live) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    }).catch(failure => { if (live) setError(failure.message); });
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [assetId, asset?.sha256, gateway, actorId]);
  return <figure className="gw-opal-image">
    {url ? <img src={url} hidden={unsupported} onError={()=>setUnsupported(true)} alt={caption || asset?.file_name || 'Imagen del documento'} /> : <p role={error ? 'alert' : 'status'}>{error || (asset ? 'Abriendo imagen original…' : 'Imagen disponible para las personas con acceso al original.')}</p>}
    {unsupported && <p>Este dispositivo no muestra el formato de la imagen. El original conserva su calidad.</p>}
    {url && asset?.can_download && <a className="gw-opal-original-download" href={url} download={asset.file_name}>Descargar imagen original</a>}
    {caption && <figcaption>{caption}</figcaption>}{credits && <small>Crédito: {credits}</small>}
  </figure>;
}
