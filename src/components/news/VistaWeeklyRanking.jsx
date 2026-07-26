import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Eye, Heart, Info, Newspaper, ShieldCheck, Trophy, Users, X } from 'lucide-react';

const formatMetric = new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 });
const formatDay = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'America/Mexico_City' });

const getWeekLabel = (start, end) => {
  const lastDay = new Date(end);
  lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  return `${formatDay.format(start)} - ${formatDay.format(lastDay)}`.replaceAll('.', '');
};

function RankingExplanation({ mode, onClose }) {
  const isHistorical = mode === 'historical';

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[2200] bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="vista-ranking-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto bg-white rounded-lg shadow-2xl border border-black/10">
        <div className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-[#d2d2d7] px-6 py-5 flex items-start justify-between gap-5 z-10">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0066FF]">{isHistorical ? 'Clasificación histórica' : 'Clasificación semanal'}</p>
            <h2 id="vista-ranking-title" className="font-serif italic text-3xl font-bold mt-1">¿Cómo funciona el Top VISTA?</h2>
          </div>
          <button type="button" onClick={onClose} title="Cerrar" aria-label="Cerrar explicación" className="w-10 h-10 flex-shrink-0 rounded-full bg-[#f5f5f7] hover:bg-[#e8e8ed] flex items-center justify-center transition-colors">
            <X size={18}/>
          </button>
        </div>

        <div className="px-6 py-6">
          <p className="text-[#6e6e73] leading-relaxed">
            {isHistorical
              ? 'Esta primera clasificación reconoce todo el contenido publicado hasta ahora. El martes 28 de julio comienza el Top VISTA semanal con el contenido de la semana iniciada el lunes 27.'
              : 'El Top VISTA compara el impacto de las editoriales entre el lunes y el domingo de cada semana. Se evalúan hasta cinco ediciones aprobadas por editorial y la clasificación comienza de nuevo cada lunes.'}
          </p>

          <div className="mt-7 border-y border-[#d2d2d7] divide-y divide-[#d2d2d7]">
            {[
              ['Alcance', '40 puntos', 'Promedio de vistas, equilibrado con una escala logarítmica.'],
              ['Interacción', '30 puntos', 'Relación entre likes y lecturas, suavizada para evitar resultados artificiales con pocas vistas.'],
              ['Comunidad', '20 puntos', 'Seguidores actuales de la editorial, también equilibrados mediante escala logarítmica.'],
              ['Actividad', '10 puntos', isHistorical ? 'Haber publicado al menos una edición aprobada.' : 'Publicar al menos una edición aprobada durante la semana.']
            ].map(([label, points, description]) => (
              <div key={label} className="grid sm:grid-cols-[130px_90px_1fr] gap-1 sm:gap-5 py-4">
                <span className="font-bold text-sm">{label}</span>
                <span className="text-xs font-black text-[#0066FF] uppercase tracking-wider">{points}</span>
                <span className="text-sm text-[#6e6e73]">{description}</span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm leading-relaxed text-[#6e6e73]">
            Los valores se normalizan frente al mejor resultado {isHistorical ? 'histórico' : 'de la semana'} para producir un puntaje máximo de 100. Global Insight y las editoriales independientes utilizan exactamente la misma fórmula; la insignia oficial no concede puntos adicionales.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VistaWeeklyRanking({ ranking, loading, mode = 'weekly', weekStart, weekEnd }) {
  const [showExplanation, setShowExplanation] = useState(false);
  const periodLabel = useMemo(
    () => mode === 'historical' ? 'Histórico' : getWeekLabel(weekStart, weekEnd),
    [mode, weekEnd, weekStart]
  );
  const isHistorical = mode === 'historical';

  return (
    <section className="px-6 md:px-12 max-w-[1800px] mx-auto mb-20" aria-labelledby="top-vista-heading">
      <div className="border-y border-[#d2d2d7] py-8 md:py-10">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-5 mb-7">
          <div>
            <div className="flex items-center gap-2 text-[#0066FF] mb-2">
              <Trophy size={17}/>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Impacto editorial</span>
            </div>
            <h2 id="top-vista-heading" className="font-serif italic text-3xl md:text-5xl font-bold">Top VISTA</h2>
            <p className="text-sm text-[#6e6e73] mt-2">
              {isHistorical ? 'Todo el impacto acumulado de Global Insight y las editoriales independientes.' : 'Global Insight y editoriales independientes bajo una misma fórmula semanal.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="h-10 px-4 bg-[#f5f5f7] rounded-lg flex items-center text-[10px] font-black uppercase tracking-widest text-[#6e6e73]">{periodLabel}</span>
            <button type="button" onClick={() => setShowExplanation(true)} title="Cómo funciona el Top VISTA" aria-label="Cómo funciona el Top VISTA" className="w-10 h-10 rounded-full border border-[#d2d2d7] bg-white hover:bg-[#f5f5f7] flex items-center justify-center transition-colors">
              <Info size={17}/>
            </button>
          </div>
        </header>

        {loading ? (
          <div className="min-h-48 flex items-center justify-center gap-3 text-[#86868b]">
            <Activity size={18} className="animate-spin"/>
            <span className="text-xs font-bold uppercase tracking-widest">Calculando puntajes</span>
          </div>
        ) : ranking.length > 0 ? (
          <div className="divide-y divide-[#d2d2d7] border-y border-[#d2d2d7]">
            {ranking.map((publisher, index) => (
              <div key={publisher.key} className="grid grid-cols-[38px_minmax(0,1fr)_auto] lg:grid-cols-[50px_minmax(220px,1.2fr)_minmax(360px,1fr)_86px] gap-3 md:gap-5 items-center py-5">
                <span className={`font-serif italic text-3xl text-center ${index === 0 ? 'text-[#0066FF]' : 'text-[#86868b]'}`}>{index + 1}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-bold text-base md:text-lg truncate">{publisher.name}</h3>
                    {publisher.type === 'official' ? (
                      <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-[#0066FF] text-[8px] font-black uppercase tracking-wider"><ShieldCheck size={10}/>Oficial</span>
                    ) : (
                      <span className="hidden sm:inline-flex flex-shrink-0 px-2 py-1 rounded-full bg-[#f5f5f7] text-[#6e6e73] text-[8px] font-black uppercase tracking-wider">Independiente</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[#86868b] font-bold uppercase tracking-wider mt-1">{publisher.evaluatedEditions ?? publisher.editions} {(publisher.evaluatedEditions ?? publisher.editions) === 1 ? 'edición evaluada' : 'ediciones evaluadas'}</p>
                  <div className="lg:hidden flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] font-bold text-[#6e6e73]">
                    <span className="flex items-center gap-1"><Eye size={12}/>{formatMetric.format(publisher.views)}</span>
                    <span className="flex items-center gap-1"><Heart size={12}/>{formatMetric.format(publisher.likes)}</span>
                    <span className="flex items-center gap-1"><Users size={12}/>{formatMetric.format(publisher.followers)}</span>
                  </div>
                </div>

                <div className="hidden lg:grid grid-cols-4 gap-5">
                  {[
                    ['Lecturas', publisher.views, Eye],
                    ['Likes', publisher.likes, Heart],
                    ['Seguidores', publisher.followers, Users],
                    ['Publicaciones', publisher.editions, Newspaper]
                  ].map(([label, value, Icon]) => (
                    <div key={label}>
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-[#86868b]"><Icon size={11}/>{label}</span>
                      <p className="font-bold text-lg mt-1">{formatMetric.format(value)}</p>
                    </div>
                  ))}
                </div>

                <div
                  className="text-right"
                  title={publisher.breakdown ? `Alcance ${publisher.breakdown.reach}/40 · Interacción ${publisher.breakdown.interaction}/30 · Comunidad ${publisher.breakdown.community}/20 · Actividad ${publisher.breakdown.activity}/10` : undefined}
                >
                  <p className="text-[9px] font-black uppercase tracking-widest text-[#86868b]">Puntaje</p>
                  <p className="font-bold text-2xl md:text-3xl tabular-nums">{publisher.score}</p>
                  <p className="text-[9px] font-bold text-[#86868b]">/ 100</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="min-h-48 border-y border-dashed border-[#d2d2d7] flex flex-col items-center justify-center text-center px-6">
            <Newspaper size={28} className="text-[#b7b7bd] mb-3"/>
            <p className="font-bold">{isHistorical ? 'El Top VISTA espera sus primeras publicaciones.' : 'La clasificación de esta semana aún está abierta.'}</p>
            <p className="text-sm text-[#86868b] mt-1">{isHistorical ? 'Aparecerá con la primera edición aprobada.' : 'Aparecerá con la primera edición aprobada entre lunes y domingo.'}</p>
          </div>
        )}
      </div>

      {showExplanation && <RankingExplanation mode={mode} onClose={() => setShowExplanation(false)}/>}
    </section>
  );
}
