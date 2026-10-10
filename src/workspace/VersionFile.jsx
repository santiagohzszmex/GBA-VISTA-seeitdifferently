import React, { useState } from 'react';
import { rpc } from './ui';
export default function VersionFile({ version, permissions, previewMode }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!version?.has_file || !permissions?.['asset.download_source']) return null;
  async function open() {
    setBusy(true); setError('');
    try {
      const result = previewMode ? { url: version.asset_url } : await rpc('workspace_asset_link', { p_version_id: version.id });
      if (result.url) window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }
  return <div className="gw-version-file"><button type="button" disabled={busy} onClick={() => void open()}>Abrir archivo entregado</button>{error && <p role="alert">{error}</p>}</div>;
}
