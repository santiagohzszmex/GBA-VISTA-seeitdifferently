import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, FileText, Share2 } from 'lucide-react';
import KeynoteSpotlight from '../components/keynotes/KeynoteSpotlight';
import MarkdownPublication from '../components/keynotes/MarkdownPublication';
import { useKeynotes } from '../hooks/useKeynotes';
import { useKeynoteShare } from '../hooks/useKeynoteShare';
import CreditsPanel from '../components/social/CreditsPanel';
import ConversationPanel from '../components/social/ConversationPanel';

const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', {
  day: 'numeric', month: 'long', year: 'numeric'
});

function ShareButton({ keynote, compact = false }) {
  const { shareKeynote, shareStatus } = useKeynoteShare(keynote);
  return (
    <button
      type="button"
      onClick={shareKeynote}
      title="Compartir Keynote"
      className={`${compact ? 'w-11 px-0' : 'px-4'} h-11 rounded-md border border-[#d2d2d7] bg-white inline-flex items-center justify-center gap-2 text-xs font-bold hover:border-[#86868b] transition-colors`}
    >
      {shareStatus === 'idle' ? <Share2 size={16}/> : <Check size={16} className="text-emerald-600"/>}
      {!compact && (shareStatus === 'copied' ? 'Enlace copiado' : shareStatus === 'shared' ? 'Compartida' : 'Compartir')}
    </button>
  );
}

function KeynoteArticle({ keynote, onBack }) {
  return (
    <article className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] px-6 md:px-12 py-14 md:py-20">
      <div className="max-w-4xl mx-auto">
        <header className="border-b border-[#d2d2d7]/70 pb-10">
          <div className="flex items-center justify-between gap-4 mb-12">
            <button type="button" onClick={onBack} className="h-11 px-4 rounded-md border border-[#d2d2d7] bg-white inline-flex items-center gap-2 text-xs font-bold"><ArrowLeft size={16}/>Archivo</button>
            <ShareButton keynote={keynote}/>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#0066FF]">GBA Keynote</p>
          <h1 className="font-serif italic text-4xl md:text-7xl leading-[1.05] mt-5">{keynote.title}</h1>
          <p className="flex items-center gap-2 mt-6 text-sm text-[#86868b]"><CalendarDays size={15}/>{formatDate(keynote.keynote_date)}</p>
          <p className="font-serif italic text-xl md:text-2xl leading-9 text-[#4a4a4f] mt-10 max-w-3xl">{keynote.summary}</p>
        </header>
        <div className="pt-5"><MarkdownPublication>{keynote.content_markdown}</MarkdownPublication></div>
        <div className="pb-20">
          <CreditsPanel subjectType="keynote" subjectId={keynote.id}/>
          <ConversationPanel subjectType="keynote" subjectId={keynote.id}/>
        </div>
      </div>
    </article>
  );
}

export default function Keynotes({ initialSlug = null, onSelectionChange, onBackHome }) {
  const { keynotes, loading, error, fetchPublishedKeynotes } = useKeynotes();
  const [selectedSlug, setSelectedSlug] = useState(initialSlug);

  useEffect(() => { fetchPublishedKeynotes(); }, [fetchPublishedKeynotes]);
  useEffect(() => { if (initialSlug) setSelectedSlug(initialSlug); }, [initialSlug]);

  const selected = useMemo(() => keynotes.find(keynote => keynote.slug === selectedSlug) || null, [keynotes, selectedSlug]);
  const latest = keynotes[0] || null;
  const selectKeynote = slug => {
    setSelectedSlug(slug || null);
    onSelectionChange?.(slug || null);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-[#86868b]">Cargando Keynotes...</div>;
  if (selected) return <KeynoteArticle keynote={selected} onBack={() => selectKeynote(null)}/>;

  return (
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] pb-24">
      <header className="px-6 md:px-12 pt-16 md:pt-24 pb-12 max-w-[1500px] mx-auto">
        <button type="button" onClick={onBackHome} className="h-11 px-4 rounded-md border border-[#d2d2d7] bg-white inline-flex items-center gap-2 text-xs font-bold mb-12"><ArrowLeft size={16}/>Inicio</button>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#0066FF]">Archivo público de GBA</p>
        <h1 className="font-serif italic text-5xl md:text-7xl tracking-tight mt-4">GBA Keynote.</h1>
      </header>

      {latest && <KeynoteSpotlight keynote={latest} onOpen={item => selectKeynote(item.slug)}/>}

      <main className="max-w-[1200px] mx-auto px-6 md:px-12 pt-14">
        <div className="flex items-center gap-3 pb-5 border-b border-[#d2d2d7]"><FileText size={17}/><h2 className="text-sm font-black uppercase tracking-[0.18em]">Todas las Keynotes</h2></div>
        {error && !keynotes.length ? <p className="py-16 text-center text-[#86868b]">{error}</p> : keynotes.length ? (
          <div className="divide-y divide-[#d2d2d7]/70">
            {keynotes.map(keynote => (
              <article key={keynote.id} className="py-8 grid md:grid-cols-[150px_minmax(0,1fr)_150px] gap-5 md:gap-8 items-start">
                <time className="text-xs font-bold text-[#86868b]">{formatDate(keynote.keynote_date)}</time>
                <div className="min-w-0"><h3 className="font-serif italic text-2xl md:text-3xl">{keynote.title}</h3><p className="text-sm leading-6 text-[#6e6e73] mt-3 line-clamp-3">{keynote.summary}</p></div>
                <div className="flex items-center gap-2 md:justify-end"><ShareButton keynote={keynote} compact/><button type="button" onClick={() => selectKeynote(keynote.slug)} className="h-11 px-4 rounded-md bg-[#1d1d1f] text-white inline-flex items-center gap-2 text-xs font-bold">Ver completa<ArrowUpRight size={14}/></button></div>
              </article>
            ))}
          </div>
        ) : <div className="py-20 text-center border-b border-[#d2d2d7]"><p className="font-serif italic text-2xl">La primera Keynote aparecerá aquí.</p></div>}
      </main>
    </div>
  );
}
