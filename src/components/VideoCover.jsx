import React, { useState } from 'react';
import { videoImageSources } from '../utils/publishing';
import placeholder from '../assets/video-placeholder.svg';

export default function VideoCover({ item, prefer = 'poster', alt, ...props }) {
  const sources = [...videoImageSources(item, prefer), placeholder];
  // Failed sources belong to this image set, so changing the link retries the
  // new images immediately without keeping a stale thumbnail on screen.
  const key = sources.join('|');
  const [failed, setFailed] = useState({ key: '', index: 0 });
  const index = failed.key === key ? failed.index : 0;
  return <img {...props} src={sources[index]} alt={alt ?? item?.titulo ?? ''}
    onError={() => { if (index < sources.length - 1) setFailed({ key, index: index + 1 }); }}
    onLoad={event => {
      // YouTube can return its tiny placeholder with HTTP 200 for an unavailable
      // max-resolution image. Try the regular thumbnail in that case as well.
      if (index < sources.length - 1 && /(?:img\.youtube\.com|i\.ytimg\.com)\//.test(sources[index]) && event.currentTarget.naturalWidth <= 120) setFailed({ key, index: index + 1 });
    }}/>;
}
