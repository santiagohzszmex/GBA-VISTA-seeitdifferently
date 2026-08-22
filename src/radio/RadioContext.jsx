import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const NOW_PLAYING_URL = 'https://azuracast.lynexus.net/api/nowplaying';
const REFRESH_INTERVAL = 15000;

const RadioContext = createContext(null);

const getSignalStatus = station => {
  const title = station?.now_playing?.song?.title?.toLowerCase() || '';
  const text = station?.now_playing?.song?.text?.toLowerCase() || '';

  if (!station?.is_online || title.includes('sin servicio') || text.includes('sin servicio')) return 'offline';
  if (title.includes('prueba') || text.includes('prueba')) return 'testing';
  return 'online';
};

export function RadioProvider({ children }) {
  const audioRef = useRef(null);
  const [stations, setStations] = useState([]);
  const [activeShortcode, setActiveShortcode] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const fetchStations = useCallback(async () => {
    try {
      const response = await fetch(NOW_PLAYING_URL, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('No fue posible consultar Radio Lynexus.');
      const payload = await response.json();
      const normalized = payload
        .filter(item => item?.station?.listen_url)
        .sort((a, b) => a.station.id - b.station.id)
        .map(item => ({ ...item, signalStatus: getSignalStatus(item) }));

      setStations(normalized);
      setLastUpdatedAt(new Date());
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'La señal no está disponible por el momento.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStations();
    const interval = window.setInterval(fetchStations, REFRESH_INTERVAL);
    return () => window.clearInterval(interval);
  }, [fetchStations]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audio.volume = volume;
    audioRef.current = audio;

    const handlePlaying = () => {
      setIsPlaying(true);
      setIsBuffering(false);
      setError('');
    };
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => setIsBuffering(true);
    const handleError = () => {
      setIsPlaying(false);
      setIsBuffering(false);
      setError('La señal seleccionada no respondió.');
    };

    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const activeStation = useMemo(
    () => stations.find(item => item.station.shortcode === activeShortcode) || null,
    [stations, activeShortcode]
  );

  const selectStation = useCallback(async station => {
    if (!station || station.signalStatus === 'offline') return;
    const audio = audioRef.current;
    const nextShortcode = station.station.shortcode;
    const shouldResume = isPlaying;

    setActiveShortcode(nextShortcode);
    setError('');

    if (!audio || audio.src === station.station.listen_url) return;
    audio.pause();
    audio.src = station.station.listen_url;
    audio.load();

    if (shouldResume) {
      setIsBuffering(true);
      try {
        await audio.play();
      } catch {
        setIsBuffering(false);
        setIsPlaying(false);
      }
    }
  }, [isPlaying]);

  const play = useCallback(async (station = activeStation) => {
    if (!station || station.signalStatus === 'offline' || !audioRef.current) return;
    const audio = audioRef.current;

    if (activeShortcode !== station.station.shortcode) setActiveShortcode(station.station.shortcode);
    if (audio.src !== station.station.listen_url) {
      audio.src = station.station.listen_url;
      audio.load();
    }

    setIsBuffering(true);
    setError('');
    try {
      await audio.play();
    } catch {
      setIsBuffering(false);
      setIsPlaying(false);
      setError('Pulsa de nuevo para iniciar la señal.');
    }
  }, [activeShortcode, activeStation]);

  const pause = useCallback(() => audioRef.current?.pause(), []);
  const togglePlayback = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const setVolume = useCallback(nextVolume => {
    const normalized = Math.min(1, Math.max(0, Number(nextVolume)));
    setVolumeState(normalized);
    if (audioRef.current) audioRef.current.volume = normalized;
  }, []);

  const dismissPlayer = useCallback(() => {
    audioRef.current?.pause();
    setActiveShortcode(null);
  }, []);

  const value = useMemo(() => ({
    stations,
    activeStation,
    isPlaying,
    isBuffering,
    isLoading,
    volume,
    error,
    lastUpdatedAt,
    selectStation,
    play,
    pause,
    togglePlayback,
    setVolume,
    dismissPlayer,
  }), [stations, activeStation, isPlaying, isBuffering, isLoading, volume, error, lastUpdatedAt, selectStation, play, pause, togglePlayback, setVolume, dismissPlayer]);

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}

export function useRadio() {
  const context = useContext(RadioContext);
  if (!context) throw new Error('useRadio debe utilizarse dentro de RadioProvider.');
  return context;
}
