import React from 'react';
import { ArrowUpRight, CalendarDays, FileText } from 'lucide-react';

const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

export default function KeynoteSpotlight({ keynote, onOpen }) {
  if (!keynote) return null;

  return (
    <section className="border-y border-[#292929] bg-[#111] text-white" aria-label="GBA Keynote más reciente">
      <div className="max-w-[1500px] mx-auto px-6 md:px-12 py-10 md:py-14 grid lg:grid-cols-[220px_minmax(0,1fr)_180px] gap-7 lg:gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#6fa2ff]"><FileText size={14}/>GBA Keynote</span>
          <span className="mt-4 flex items-center gap-2 text-xs text-white/55"><CalendarDays size={14}/>{formatDate(keynote.keynote_date)}</span>
        </div>

        <div className="min-w-0">
          <h2 className="font-serif italic text-3xl md:text-5xl leading-tight">{keynote.title}</h2>
          <p className="mt-4 text-sm md:text-base leading-7 text-white/65 max-w-3xl line-clamp-3">{keynote.summary}</p>
        </div>

        <button type="button" onClick={() => onOpen?.(keynote)} className="h-12 px-5 rounded-md bg-white text-[#111] inline-flex items-center justify-center gap-2 text-xs font-black justify-self-start lg:justify-self-end hover:bg-[#e8e8e8] transition-colors">
          Ver completa<ArrowUpRight size={16}/>
        </button>
      </div>
    </section>
  );
}
