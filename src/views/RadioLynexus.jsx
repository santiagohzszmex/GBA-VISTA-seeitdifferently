import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Check, Loader2, Pause, Play, Radio, Share2 } from 'lucide-react';
import { useRadio } from '../radio/RadioContext';

const formatDuration = seconds => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const getStatusLabel = status => {
  if (status === 'offline') return 'Fuera del aire';
  if (status === 'testing') return 'En pruebas';
  return 'En vivo';
};

function SignalCard({ item, isActive, onSelect }) {
  const song = item.now_playing?.song || {};
  const unavailable = item.signalStatus === 'offline';

  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={() => onSelect(item)}
      className={`w-[220px] shrink-0 text-left transition-opacity md:w-[250px] ${
        unavailable ? 'cursor-not-allowed opacity-35' : 'hover:opacity-80'
      }`}
    >
      <div className={`relative mb-3 aspect-square overflow-hidden rounded-[6px] bg-[#1b1c1f] ${isActive ? 'ring-2 ring-white ring-offset-4 ring-offset-[#0d0e10]' : ''}`}>
        {song.art ? (
          <img src={song.art} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center"><Radio size={30} className="text-white/20" /></div>
        )}
        {isActive && (
          <span className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#111214] shadow-lg">
            <Check size={16} strokeWidth={3} />
          </span>
        )}
      </div>
      <h3 className="truncate text-sm font-bold text-white">{item.station.name}</h3>
      <p className="mt-0.5 truncate text-xs text-white/42">{unavailable ? 'Sin programación' : song.title || 'Programación continua'}</p>
      <div className="mt-2 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white/35">
        <span className={`h-1.5 w-1.5 rounded-full ${item.signalStatus === 'online' ? 'bg-[#72c979]' : item.signalStatus === 'testing' ? 'bg-[#e5bd58]' : 'bg-white/40'}`} />
        {getStatusLabel(item.signalStatus)}
      </div>
    </button>
  );
}

export default function RadioLynexus() {
  const {
    stations,
    activeStation,
    isPlaying,
    isBuffering,
    error,
    selectStation,
    play,
    pause,
  } = useRadio();
  const [shareState, setShareState] = useState('idle');

  useEffect(() => {
    if (!stations.length) return;
    const requestedStation = new URLSearchParams(window.location.search).get('station');
    const matchingStation = stations.find(item => item.station.shortcode === requestedStation);

    if (matchingStation && matchingStation.station.shortcode !== activeStation?.station?.shortcode) {
      selectStation(matchingStation);
      return;
    }

    if (!activeStation) selectStation(stations[0]);
  }, [stations, activeStation, selectStation]);

  const song = activeStation?.now_playing?.song || {};
  const elapsed = activeStation?.now_playing?.elapsed || 0;
  const duration = activeStation?.now_playing?.duration || 0;
  const progress = duration > 0 ? Math.min(100, Math.max(0, (elapsed / duration) * 100)) : 0;
  const listeners = activeStation?.listeners?.current ?? 0;
  const history = useMemo(() => activeStation?.song_history?.slice(0, 5) || [], [activeStation]);

  const handleShare = async () => {
    if (!activeStation) return;
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('radio', activeStation.station.shortcode);
    url.searchParams.set('station', activeStation.station.shortcode);
    const shareData = {
      title: `${activeStation.station.name} en VISTA`,
      text: `Escucha ${activeStation.station.name} en directo desde VISTA.`,
      url: url.toString(),
    };

    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(shareData.url);
      setShareState('done');
      window.setTimeout(() => setShareState('idle'), 1800);
    } catch {
      setShareState('idle');
    }
  };

  if (!activeStation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0e10] text-white">
        <Loader2 className="animate-spin" size={25} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0e10] pb-32 text-white selection:bg-white selection:text-[#0d0e10]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between px-5 md:px-8">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-black tracking-[0.12em]">VISTA</span>
            <span className="text-sm text-white/45">Radio</span>
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Compartir estación"
            title="Compartir estación"
          >
            {shareState === 'done' ? <Check size={18} /> : <Share2 size={18} />}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1320px] px-5 md:px-8">
        <section className="grid items-center gap-9 border-b border-white/10 py-10 md:grid-cols-[minmax(260px,400px)_1fr] md:gap-10 md:py-14 lg:grid-cols-[minmax(300px,460px)_1fr] lg:gap-16 lg:py-16">
          <div className="aspect-square w-full overflow-hidden rounded-[6px] bg-[#191a1d]">
            {song.art ? (
              <img src={song.art} alt={`Portada de ${song.title || activeStation.station.name}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center"><Radio size={64} className="text-white/15" /></div>
            )}
          </div>

          <div className="min-w-0 max-w-2xl">
            <div className="mb-8 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[#72c979]" />
              <p className="text-sm font-semibold text-white/70">{activeStation.station.name}</p>
            </div>

            <p className="mb-3 text-xs font-semibold text-white/38">Sonando ahora</p>
            <h1 className="text-4xl font-bold leading-tight tracking-normal md:text-5xl">{song.title || 'Programación en directo'}</h1>
            <p className="mt-3 text-lg text-white/48">{song.artist || activeStation.station.name}</p>

            {activeStation.station.description && (
              <p className="mt-8 max-w-xl text-sm leading-6 text-white/38">{activeStation.station.description}</p>
            )}

            <div className="mt-9 flex items-center gap-4">
              <button
                type="button"
                onClick={() => isPlaying ? pause() : play(activeStation)}
                disabled={activeStation.signalStatus === 'offline'}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#111214] transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-35"
                aria-label={isPlaying ? 'Pausar' : 'Escuchar'}
              >
                {isBuffering ? <Loader2 className="animate-spin" size={20} /> : isPlaying ? <Pause fill="currentColor" size={20} /> : <Play className="ml-0.5" fill="currentColor" size={20} />}
              </button>
              <span className="text-sm font-semibold">{isPlaying ? 'Pausar' : 'Escuchar'}</span>
            </div>

            <div className="mt-9 max-w-xl">
              {duration > 0 ? (
                <>
                  <div className="h-1 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-white/70 transition-[width] duration-1000" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] tabular-nums text-white/28">
                    <span>{formatDuration(elapsed)}</span>
                    <span>{formatDuration(duration)}</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs text-white/32">
                  <Activity size={14} /> Transmisión continua
                </div>
              )}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/10 pt-5 text-xs text-white/38">
              <span>{listeners} {listeners === 1 ? 'oyente' : 'oyentes'} en la señal</span>
              <span className="text-white/15">·</span>
              <span>{isPlaying ? 'Reproducción activa en VISTA' : 'Sin reproducción en VISTA'}</span>
            </div>

            {error && <p className="mt-4 text-xs text-[#e5bd58]">{error}</p>}
          </div>
        </section>

        <section className="border-b border-white/10 py-12 md:py-16">
          <h2 className="mb-7 text-2xl font-bold tracking-normal">Señales</h2>
          <div className="flex snap-x gap-5 overflow-x-auto pb-6 [scrollbar-color:#383b40_transparent]">
            {stations.map(item => (
              <SignalCard
                key={item.station.shortcode}
                item={item}
                isActive={item.station.shortcode === activeStation.station.shortcode}
                onSelect={selectStation}
              />
            ))}
          </div>
        </section>

        <section className="py-12 md:py-16">
          <h2 className="mb-7 text-2xl font-bold tracking-normal">Historial</h2>
          <div className="divide-y divide-white/10 border-y border-white/10">
            {history.length > 0 ? history.map((item, index) => (
              <div key={`${item.sh_id}-${index}`} className="grid grid-cols-[46px_1fr_auto] items-center gap-4 py-4 md:grid-cols-[52px_1fr_auto]">
                <img src={item.song?.art} alt="" className="h-11 w-11 rounded-[4px] bg-white/5 object-cover md:h-[52px] md:w-[52px]" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.song?.title || item.song?.text}</p>
                  <p className="truncate text-xs text-white/38">{item.song?.artist || activeStation.station.name}</p>
                </div>
                <span className="text-xs tabular-nums text-white/25">{formatDuration(item.duration)}</span>
              </div>
            )) : (
              <p className="py-10 text-sm text-white/35">No hay emisiones recientes.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
