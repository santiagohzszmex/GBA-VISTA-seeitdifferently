// Both coordinates and bounds are in CSS viewport pixels, including native WebViews.
export function placeEditorMenu(anchor, size, bounds, margin = 8) {
  const left = bounds.left + margin, right = bounds.right - margin;
  const top = bounds.top + margin, bottom = bounds.bottom - margin;
  if (anchor.bottom < top || anchor.top > bottom || anchor.right < left || anchor.left > right) return null;
  const below = bottom - anchor.bottom - margin, above = anchor.top - top - margin;
  const side = below >= size.height || below >= above ? 'below' : 'above';
  const height = Math.min(size.height, side === 'below' ? below : above);
  if (height < 52 || right - left < 100) return null;
  const width = Math.min(size.width, right - left);
  return { left:Math.max(left, Math.min(anchor.left, right - width)),
    top:side === 'below' ? anchor.bottom + margin : anchor.top - margin - height,
    maxHeight:height, maxWidth:width, side };
}

export function editorVisibleBounds(element) {
  const viewport = window.visualViewport;
  const bounds = {left:viewport?.offsetLeft || 0, top:viewport?.offsetTop || 0,
    right:(viewport?.offsetLeft || 0) + (viewport?.width || window.innerWidth),
    bottom:(viewport?.offsetTop || 0) + (viewport?.height || window.innerHeight)};
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent), rect = parent.getBoundingClientRect();
    if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { bounds.top=Math.max(bounds.top,rect.top); bounds.bottom=Math.min(bounds.bottom,rect.bottom); }
    if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { bounds.left=Math.max(bounds.left,rect.left); bounds.right=Math.min(bounds.right,rect.right); }
  }
  return bounds;
}
