import React, { useEffect, useState } from 'react';
import { Download, FileText, Image } from 'lucide-react';
import { readReferenceOriginal } from './referenceAssets';
import { fileSize } from './referenceModel';
export default function ReferenceOriginal({ asset, gateway }) {
  const [url, setUrl] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let live = true, objectUrl;
    setUrl(''); setError(''); setImageFailed(false);
    if (!gateway) return;
    readReferenceOriginal(gateway, asset).then(blob => { if (live) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); } }).catch(failure => { if (live) setError(failure.message); });
    return () => { live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [asset.id, asset.sha256, gateway]);
  async function download() {
    setWorking(true); setError('');
    try { const blob = await readReferenceOriginal(gateway, asset, true); const address = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = address; anchor.download = asset.file_name; anchor.click(); setTimeout(() => URL.revokeObjectURL(address), 1000); }
    catch (failure) { setError(failure.message); } finally { setWorking(false); }
  }
  const pdf = asset.mime_type === 'application/pdf';
  return <figure className="gw-reference-original"><figcaption><span>{pdf ? <FileText size={16} /> : <Image size={16} />}<strong>{asset.file_name}</strong><small>{fileSize(asset.size_bytes)} · Original</small></span>{asset.can_download && <button type="button" disabled={working} onClick={() => void download()}><Download size={14} />Descargar original</button>}</figcaption>
    {error ? <p role="alert" className="gw-error">{error}</p> : !url ? <p role="status">Abriendo original privado…</p> : pdf ? <><iframe src={url} title={`Moodboard: ${asset.file_name}`} className="gw-moodboard-pdf" /><p>Si tu dispositivo no muestra el PDF, descarga el original para consultarlo.</p></> : <><img src={url} alt={asset.file_name} loading="lazy" hidden={imageFailed} onError={() => setImageFailed(true)} />{imageFailed && <p>El original está conservado, pero este dispositivo no muestra su formato. Descárgalo y ábrelo con una aplicación compatible.</p>}</>}
  </figure>;
}
