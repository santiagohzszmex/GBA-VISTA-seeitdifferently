import React from 'react';
import { Loader2, Pause, Play, Radio, Volume1, Volume2, X } from 'lucide-react';
import { useRadio } from '../../radio/RadioContext';

export default function GlobalRadioPlayer() {
  const {
    activeStation,
    isPlaying,
    isBuffering,
    volume,
    togglePlayback,
    setVolume,
    dismissPlayer,
  } = useRadio();

  if (!activeStation) return null;

  const song = activeStation.now_playing?.song || {};
  const openRadio = () => {
    window.dispatchEvent(new CustomEvent('vista:navigate-radio', {
      detail: { shortcode: activeStation.station.shortcode }
    }));
  };

  return (
    <div className="fixed bottom-[84px] left-0 right-0 z-[850] border-t border-white/10 bg-[#101113]/95 text-white shadow-[0_-18px_60px_rgba(0,0,0,0.32)] backdrop-blur-2xl md:bottom-0 md:left-24 md:z-[1200]">
      <div className="mx-auto flex h-[82px] max-w-[1500px] items-center gap-3 px-4 md:h-[92px] md:gap-5 md:px-8">
        <button type="button" onClick={openRadio} className="h-12 w-12 shrink-0 overflow-hidden rounded-[6px] bg-[#24262a] md:h-14 md:w-14" aria-label="Abrir VISTA Radio">
          <img src={song.art} alt="" className="h-full w-full object-cover" />
        </button>

        <button type="button" onClick={openRadio} className="min-w-0 flex-1 text-left md:max-w-xl">
          <div className="mb-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-[#74d680]">
            <Radio size={11} /> {activeStation.station.name}
          </div>
          <p className="truncate text-sm font-bold md:text-base">{song.title || 'Señal en directo'}</p>
          <p className="truncate text-[11px] text-white/55 md:text-xs">{song.artist || 'En directo'}</p>
        </button>

        <button
          type="button"
          onClick={togglePlayback}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#101113] transition-transform hover:scale-105 active:scale-95 md:h-14 md:w-14"
          aria-label={isPlaying ? `Pausar ${activeStation.station.name}` : `Escuchar ${activeStation.station.name}`}
        >
          {isBuffering ? <Loader2 className="animate-spin" size={22} /> : isPlaying ? <Pause fill="currentColor" size={21} /> : <Play className="ml-0.5" fill="currentColor" size={21} />}
        </button>

        <div className="hidden items-center gap-3 md:flex">
          {volume > 0.45 ? <Volume2 size={18} className="text-white/55" /> : <Volume1 size={18} className="text-white/55" />}
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={event => setVolume(event.target.value)}
            className="h-1 w-28 cursor-pointer accent-white"
            aria-label="Volumen"
          />
        </div>

        <button
          type="button"
          onClick={dismissPlayer}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Cerrar reproductor"
        >
          <X size={19} />
        </button>
      </div>
    </div>
  );
}
