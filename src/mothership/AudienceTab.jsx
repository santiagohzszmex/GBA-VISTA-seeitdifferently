import React, { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, RefreshCw, UserCheck, Users } from 'lucide-react';
import { supabase } from '../supabaseClient';

const numberFormatter = new Intl.NumberFormat('es-MX');
const weekdayFormatter = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });

const EMPTY_METRICS = {
  active_7d: 0,
  active_today: 0,
  total_accounts: 0,
  activity_rate: 0,
  coverage_days: 0,
  tracking_since: null,
  daily: [],
};

function MetricCard({ label, value, detail, icon: Icon, accent = 'text-white' }) {
  return (
    <div className="border border-white/10 bg-white/[0.035] p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">{label}</p>
        <Icon size={16} className={accent}/>
      </div>
      <p className={`mt-5 text-4xl font-semibold tracking-tight ${accent}`}>{value}</p>
      <p className="mt-2 text-xs text-neutral-500">{detail}</p>
    </div>
  );
}

export default function AudienceTab() {
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadMetrics = async () => {
    setLoading(true);
    setError('');
    const { data, error: metricsError } = await supabase.rpc('vista_admin_audience_metrics');
    if (metricsError) {
      setError('No se pudo abrir la medición de audiencia. Comprueba que la migración esté instalada.');
      setLoading(false);
      return;
    }
    setMetrics({ ...EMPTY_METRICS, ...(data || {}) });
    setLoading(false);
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const daily = Array.isArray(metrics.daily) ? metrics.daily : [];
  const maximumDaily = useMemo(
    () => Math.max(1, ...daily.map(item => Number(item.active_users) || 0)),
    [daily]
  );
  const rate = Math.round((Number(metrics.activity_rate) || 0) * 10) / 10;

  return (
    <section className="max-w-6xl mx-auto">
      <header className="flex flex-col gap-5 border-b border-white/10 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-emerald-400">
            <Activity size={16}/>
            <span className="text-[10px] font-black uppercase tracking-widest">Actividad autenticada</span>
          </div>
          <h2 className="font-serif text-4xl italic tracking-tight text-white">Audiencia VISTA.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-500">Usuarios que realmente regresan a la plataforma, medidos por GBA ID y no por el total histórico de cuentas.</p>
        </div>
        <button type="button" onClick={loadMetrics} disabled={loading} className="flex h-10 items-center justify-center gap-2 border border-white/10 px-4 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:border-white/25 hover:text-white disabled:opacity-40">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Actualizar
        </button>
      </header>

      {error ? (
        <div className="mt-8 border border-red-500/20 bg-red-500/5 p-6 text-sm text-red-300">{error}</div>
      ) : (
        <>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Activos · 7 días" value={loading ? '—' : numberFormatter.format(metrics.active_7d)} detail="GBA ID únicos en la ventana móvil" icon={UserCheck} accent="text-emerald-400"/>
            <MetricCard label="Tasa de actividad" value={loading ? '—' : `${rate}%`} detail="Activos de 7 días / cuentas totales" icon={Activity} accent="text-cyan-300"/>
            <MetricCard label="Activos hoy" value={loading ? '—' : numberFormatter.format(metrics.active_today)} detail="GBA ID únicos durante el día UTC" icon={CalendarDays}/>
            <MetricCard label="Cuentas totales" value={loading ? '—' : numberFormatter.format(metrics.total_accounts)} detail="Contexto histórico, no retención" icon={Users}/>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="border border-white/10 bg-white/[0.025] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Actividad diaria</h3>
                  <p className="mt-1 text-xs text-neutral-600">GBA ID únicos por día</p>
                </div>
                <span className="text-[10px] font-mono text-neutral-600">7D</span>
              </div>
              <div className="mt-8 grid h-52 grid-cols-7 items-end gap-2">
                {daily.map(item => {
                  const value = Number(item.active_users) || 0;
                  const height = value === 0 ? 4 : Math.max(12, Math.round((value / maximumDaily) * 100));
                  const date = new Date(`${item.date}T12:00:00Z`);
                  return (
                    <div key={item.date} className="flex h-full min-w-0 flex-col justify-end text-center">
                      <span className="mb-2 text-[10px] font-mono text-neutral-500">{value}</span>
                      <div className="w-full bg-emerald-400/80" style={{ height: `${height}%` }}/>
                      <span className="mt-2 truncate text-[9px] font-bold uppercase text-neutral-600">{weekdayFormatter.format(date)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="border border-white/10 p-6">
              <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Cómo se calcula</p>
              <p className="mt-4 text-sm leading-6 text-neutral-400">Cada GBA ID cuenta una sola vez por día cuando abre VISTA con una sesión válida. La cifra principal reúne los últimos siete días, incluido hoy.</p>
              <div className="mt-6 border-t border-white/10 pt-5">
                <p className="text-xs font-bold text-white">Cobertura actual</p>
                <p className="mt-2 text-sm text-neutral-500">{metrics.coverage_days || 0} de 7 días registrados</p>
                {metrics.tracking_since && <p className="mt-1 text-[10px] text-neutral-700">Desde {metrics.tracking_since}</p>}
              </div>
              <p className="mt-6 text-xs leading-5 text-neutral-600">Los perfiles completados no forman parte de esta métrica. Se trabajarán cuando tengan una utilidad clara para el usuario.</p>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
