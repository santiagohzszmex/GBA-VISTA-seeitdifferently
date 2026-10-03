import React, { useId } from 'react';

// The Alliance globe keeps Partners within GBA's identity; the links signify an alliance.
export default function PartnerEmblem({ size = 24, monochrome = false, className = '' }) {
  const id = `gba-partners-${useId().replace(/:/g, '')}`;
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" className={className}>
    {!monochrome && <defs>
      <linearGradient id={`${id}-blue`} x1="12" y1="6" x2="44" y2="48" gradientUnits="userSpaceOnUse"><stop stopColor="#62bbff"/><stop offset=".48" stopColor="#1677ee"/><stop offset="1" stopColor="#174dba"/></linearGradient>
      <linearGradient id={`${id}-green`} x1="24" y1="8" x2="44" y2="30" gradientUnits="userSpaceOnUse"><stop stopColor="#73e3b3"/><stop offset="1" stopColor="#12a678"/></linearGradient>
      <linearGradient id={`${id}-metal`} x1="39" y1="36" x2="48" y2="61" gradientUnits="userSpaceOnUse"><stop stopColor="#fafcff"/><stop offset=".43" stopColor="#d6dfe9"/><stop offset=".5" stopColor="#879bac"/><stop offset="1" stopColor="#e5edf3"/></linearGradient>
    </defs>}
    <circle cx="27" cy="27" r="21" fill={monochrome ? 'none' : `url(#${id}-blue)`} stroke={monochrome ? 'currentColor' : '#275b9b'} strokeWidth={monochrome ? 3 : 1}/>
    {!monochrome && <path d="M21 7C23 21 35 29 47 29H21Z" fill={`url(#${id}-green)`}/>}
    <path d="M21 7V47M21 29H47M21 7C23 21 35 29 47 29" stroke={monochrome ? 'currentColor' : '#fff'} strokeWidth="2.6" strokeLinecap="round"/>
    {!monochrome && <path d="M11 19A19 19 0 0 1 40 12" stroke="#fff" strokeOpacity=".4" strokeWidth="1.5" strokeLinecap="round"/>}
    <g transform="translate(30 33) scale(1.3)" strokeLinecap="round" strokeLinejoin="round">
      {!monochrome && <path d="M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7.1-7.1L11 5M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7.1 7.1L13 19" stroke="#586c7d" strokeWidth="4.6"/>}
      <path d="M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7.1-7.1L11 5M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7.1 7.1L13 19" stroke={monochrome ? 'currentColor' : `url(#${id}-metal)`} strokeWidth={monochrome ? 2.7 : 3}/>
    </g>
  </svg>;
}
