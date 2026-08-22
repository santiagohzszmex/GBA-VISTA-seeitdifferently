import React from 'react';
import { ArrowUpRight, Loader2, Pause, Play, Radio } from 'lucide-react';
import { useRadio } from '../../radio/RadioContext';

export default function HomeRadioStrip({ onOpen }) {
  const {
    stations,
    activeStation,
    isPlaying,
    isBuffering,
    play,
    pause,
    selectStation,
  } = useRadio();

  const station = activeStation || stations[0] || null;
  if (!station) return null;

  const song = station.now_playing?.song || {};
  const handleOpen = () => {
    if (!activeStation) selectStation(station);
    onOpen?.(station);
  };

  return (
    <section className="relative z-20 mx-auto max-w-[1500px] px-6 pt-10 md:px-12 md:pt-14" aria-label="VISTA Radio">
      <div className="grid min-h-[132px] grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-4 overflow-hidden rounded-[6px] bg-[#111214] p-4 text-white shadow-[0_16px_45px_rgba(0,0,0,0.12)] md:min-h-[148px] md:grid-cols-[108px_minmax(0,1fr)_auto_auto] md:gap-6 md:p-5">
        <button type="button" onClick={handleOpen} className="h-[84px] w-[84px] overflow-hidden rounded-[4px] bg-white/5 md:h-[108px] md:w-[108px]" aria-label="Abrir VISTA Radio">
          {song.art ? <img src={song.art} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center"><Radio size={26} className="text-white/25" /></span>}
        </button>

        <button type="button" onClick={handleOpen} className="min-w-0 text-left">
          <div className="mb-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.14em] text-[#72c979]">
            <Radio size={11} /> {station.station.name}
          </div>
          <p className="truncate text-base font-bold md:text-xl">{song.title || 'Programación en directo'}</p>
          <p className="mt-1 truncate text-xs text-white/45 md:text-sm">{song.artist || 'En directo'}</p>
        </button>

        <button
          type="button"
          onClick={() => isPlaying ? pause() : play(station)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#111214] transition-transform hover:scale-105 active:scale-95 md:h-14 md:w-14"
          aria-label={isPlaying ? 'Pausar radio' : 'Escuchar radio'}
        >
          {isBuffering ? <Loader2 className="animate-spin" size={20} /> : isPlaying ? <Pause fill="currentColor" size={20} /> : <Play className="ml-0.5" fill="currentColor" size={20} />}
        </button>

        <button
          type="button"
          onClick={handleOpen}
          className="hidden h-11 items-center gap-2 border-l border-white/10 pl-6 text-xs font-bold text-white/55 transition-colors hover:text-white md:flex"
        >
          Abrir Radio <ArrowUpRight size={16} />
        </button>
      </div>
    </section>
  );
}
