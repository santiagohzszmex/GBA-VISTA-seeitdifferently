import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Beaker,
  BookOpenCheck,
  BrainCircuit,
  Briefcase,
  Check,
  Cpu,
  ExternalLink,
  FilePlus2,
  Gauge,
  History,
  MemoryStick,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const LAYERS = {
  research: {
    label: 'ANIMA Research',
    shortLabel: 'Research',
    icon: Beaker,
    color: '#38bdf8',
    mission: 'Demostrar qué técnicas reducen memoria, cómputo y costo sin perder calidad.'
  },
  runtime: {
    label: 'ANIMA Runtime',
    shortLabel: 'Runtime',
    icon: Cpu,
    color: '#a3e635',
    mission: 'Convertir hallazgos validados en decisiones automáticas adaptadas al hardware.'
  },
  services: {
    label: 'ANIMA Services',
    shortLabel: 'Services',
    icon: Briefcase,
    color: '#f59e0b',
    mission: 'Empaquetar capacidades comprobadas como pilotos y servicios responsables.'
  }
};

const PHASES = [
  'Tesis y medición',
  'Líneas base',
  'Prototipos locales',
  'Runtime integrado',
  'Validación externa',
  'Producto'
];

const STATUS_LABELS = {
  draft: 'Borrador',
  baseline: 'Línea base',
  running: 'En ejecución',
  analyzing: 'En análisis',
  validated: 'Validado',
  failed: 'No concluyente',
  paused: 'Pausado'
};

const LAYER_STATUS_LABELS = {
  planned: 'Planeado',
  researching: 'Investigación',
  building: 'Construcción',
  pilot: 'Piloto',
  operational: 'Operativo',
  paused: 'Pausado'
};

const LOG_TYPE_LABELS = {
  note: 'Nota',
  checkpoint: 'Checkpoint',
  metric: 'Métrica',
  decision: 'Decisión',
  incident: 'Incidente'
};

const blankExperiment = {
  experiment_code: '',
  title: '',
  layer: 'research',
  phase: 0,
  status: 'draft',
  hypothesis: '',
  model_name: '',
  dataset_name: '',
  hardware: '',
  ram_limit_gb: '',
  cpu_threads: '',
  baseline_peak_ram_gb: '',
  peak_ram_gb: '',
  baseline_duration_minutes: '',
  duration_minutes: '',
  tokens_per_second: '',
  energy_wh: '',
  quality_metric: '',
  quality_value: '',
  cost_mxn: '',
  resumable: true,
  reproducible: false,
  result_summary: '',
  evidence_url: ''
};

const numericFields = [
  'phase',
  'ram_limit_gb',
  'cpu_threads',
  'baseline_peak_ram_gb',
  'peak_ram_gb',
  'baseline_duration_minutes',
  'duration_minutes',
  'tokens_per_second',
  'energy_wh',
  'quality_value',
  'cost_mxn'
];

const nullableFields = [
  'model_name',
  'dataset_name',
  'hardware',
  'ram_limit_gb',
  'cpu_threads',
  'baseline_peak_ram_gb',
  'peak_ram_gb',
  'baseline_duration_minutes',
  'duration_minutes',
  'tokens_per_second',
  'energy_wh',
  'quality_metric',
  'quality_value',
  'cost_mxn',
  'result_summary',
  'evidence_url'
];

const percent = value => `${Math.round(Number(value) || 0)}%`;
const formatNumber = (value, suffix = '') => value === null || value === undefined
  ? '—'
  : `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(Number(value))}${suffix}`;

function FieldLabel({ children }) {
  return <span className="block text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1.5">{children}</span>;
}

function IconButton({ label, children, className = '', ...props }) {
  return (
    <button type="button" title={label} aria-label={label} className={`anima-icon-button ${className}`} {...props}>
      {children}
    </button>
  );
}

function StatusPill({ status }) {
  const active = status === 'running' || status === 'analyzing' || status === 'validated';
  return (
    <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider ${active ? 'text-lime-300' : 'text-neutral-500'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-lime-300' : 'bg-neutral-600'}`}/>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export default function AnimaTab() {
  const { user } = useAuth();
  const [activeArea, setActiveArea] = useState('overview');
  const [layers, setLayers] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(blankExperiment);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [layerFilter, setLayerFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [logForm, setLogForm] = useState({ event_type: 'note', message: '' });

  const selected = experiments.find(experiment => experiment.id === selectedId) || null;

  const loadRegistry = async (clearNotice = true) => {
    setLoading(true);
    if (clearNotice) setNotice(null);
    const [layersResult, experimentsResult] = await Promise.all([
      supabase.from('anima_layers').select('*').order('display_order'),
      supabase.from('anima_experiments').select('*').order('created_at', { ascending: false })
    ]);
    const error = layersResult.error || experimentsResult.error;
    if (error) {
      console.warn('ANIMA registry unavailable:', error);
      setNotice({ type: 'error', message: 'El registro de ANIMA aún no está disponible. Ejecuta la migración 202607310001_anima_registry.sql.' });
    } else {
      const nextExperiments = experimentsResult.data || [];
      setLayers(layersResult.data || []);
      setExperiments(nextExperiments);
      setSelectedId(current => nextExperiments.some(item => item.id === current) ? current : nextExperiments[0]?.id || null);
    }
    setLoading(false);
  };

  const loadLogs = async experimentId => {
    if (!experimentId) {
      setLogs([]);
      return;
    }
    const { data, error } = await supabase
      .from('anima_experiment_logs')
      .select('*')
      .eq('experiment_id', experimentId)
      .order('created_at', { ascending: false });
    if (!error) setLogs(data || []);
  };

  useEffect(() => {
    loadRegistry();
  }, []);

  useEffect(() => {
    loadLogs(selectedId);
  }, [selectedId]);

  const nextCode = useMemo(() => {
    const largest = experiments.reduce((max, experiment) => {
      const match = experiment.experiment_code?.match(/(\d+)$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, 0);
    return `ANIMA-${String(largest + 1).padStart(3, '0')}`;
  }, [experiments]);

  const metrics = useMemo(() => {
    const active = experiments.filter(item => ['baseline', 'running', 'analyzing'].includes(item.status)).length;
    const validated = experiments.filter(item => item.status === 'validated').length;
    const reproducible = experiments.filter(item => item.reproducible).length;
    const reductions = experiments
      .filter(item => Number(item.baseline_peak_ram_gb) > 0 && item.peak_ram_gb !== null)
      .map(item => ((Number(item.baseline_peak_ram_gb) - Number(item.peak_ram_gb)) / Number(item.baseline_peak_ram_gb)) * 100);
    return {
      active,
      validated,
      reproducible,
      averageReduction: reductions.length ? reductions.reduce((sum, item) => sum + item, 0) / reductions.length : 0
    };
  }, [experiments]);

  const filteredExperiments = useMemo(() => experiments.filter(experiment => {
    const matchesLayer = layerFilter === 'all' || experiment.layer === layerFilter;
    const haystack = `${experiment.experiment_code} ${experiment.title} ${experiment.model_name || ''}`.toLowerCase();
    return matchesLayer && haystack.includes(search.trim().toLowerCase());
  }), [experiments, layerFilter, search]);

  const persist = async (operation, message, reload = true) => {
    setSaving(true);
    setNotice(null);
    try {
      const { data, error } = await operation();
      if (error) throw error;
      setNotice({ type: 'success', message });
      if (reload) await loadRegistry(false);
      return data;
    } catch (error) {
      console.error(error);
      setNotice({ type: 'error', message: error.message || 'No fue posible guardar el registro.' });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...blankExperiment, experiment_code: nextCode });
    setActiveArea('form');
  };

  const openEdit = experiment => {
    const next = { ...blankExperiment, ...experiment };
    numericFields.forEach(field => {
      next[field] = experiment[field] ?? '';
    });
    setForm(next);
    setEditingId(experiment.id);
    setActiveArea('form');
  };

  const submitExperiment = async event => {
    event.preventDefault();
    const payload = { ...form };
    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.created_by;
    delete payload.updated_by;
    nullableFields.forEach(field => {
      payload[field] = payload[field] === '' ? null : payload[field];
    });
    numericFields.forEach(field => {
      if (payload[field] !== null && payload[field] !== '') payload[field] = Number(payload[field]);
    });
    payload.updated_by = user?.id || null;
    payload.updated_at = new Date().toISOString();

    const operation = editingId
      ? () => supabase.from('anima_experiments').update(payload).eq('id', editingId).select().single()
      : () => supabase.from('anima_experiments').insert({ ...payload, created_by: user?.id || null }).select().single();
    const saved = await persist(operation, editingId ? 'Experimento actualizado.' : 'Experimento registrado.');
    if (saved) {
      setSelectedId(saved.id);
      setEditingId(null);
      setForm(blankExperiment);
      setActiveArea('registry');
    }
  };

  const deleteExperiment = async experiment => {
    if (!window.confirm(`¿Eliminar ${experiment.experiment_code}? También se eliminará su bitácora.`)) return;
    const deleted = await persist(
      () => supabase.from('anima_experiments').delete().eq('id', experiment.id).select(),
      'Experimento eliminado.'
    );
    if (deleted) setSelectedId(null);
  };

  const saveLayer = async layer => {
    await persist(
      () => supabase.from('anima_layers').update({
        status: layer.status,
        progress: Number(layer.progress),
        current_focus: layer.current_focus || null,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString()
      }).eq('id', layer.id),
      `${LAYERS[layer.layer_key].label} actualizado.`
    );
  };

  const updateLayerLocal = (id, changes) => setLayers(current => current.map(layer => layer.id === id ? { ...layer, ...changes } : layer));

  const addLog = async event => {
    event.preventDefault();
    if (!selected || !logForm.message.trim()) return;
    const saved = await persist(
      () => supabase.from('anima_experiment_logs').insert({
        experiment_id: selected.id,
        event_type: logForm.event_type,
        message: logForm.message.trim(),
        created_by: user?.id || null
      }).select(),
      'Entrada añadida a la bitácora.',
      false
    );
    if (saved) {
      setLogForm({ event_type: 'note', message: '' });
      await loadLogs(selected.id);
    }
  };

  const renderOverview = () => (
    <div className="space-y-10">
      <section className="grid grid-cols-2 xl:grid-cols-4 border-y border-white/10 divide-x divide-white/10">
        {[
          ['Activos', metrics.active, Activity],
          ['Validados', metrics.validated, BookOpenCheck],
          ['Reproducibles', metrics.reproducible, RefreshCw],
          ['Reducción RAM media', percent(metrics.averageReduction), MemoryStick]
        ].map(([label, value, Icon]) => (
          <div key={label} className="px-4 py-5 md:px-6 first:pl-0">
            <Icon size={16} className="text-neutral-500 mb-4"/>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600 mt-1">{label}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="flex items-end justify-between gap-4 mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Operating model</p>
            <h3 className="text-2xl font-serif italic font-bold mt-1">Las tres capas de ANIMA</h3>
          </div>
          <span className="hidden md:block text-[10px] uppercase tracking-widest text-neutral-600">De evidencia a producto</span>
        </div>
        <div className="grid xl:grid-cols-3 border-y border-white/10 divide-y xl:divide-y-0 xl:divide-x divide-white/10">
          {layers.map(layer => {
            const definition = LAYERS[layer.layer_key];
            if (!definition) return null;
            const Icon = definition.icon;
            return (
              <article key={layer.id} className="py-6 xl:px-7 first:pl-0 last:pr-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Icon size={19} style={{ color: definition.color }}/>
                    <div>
                      <h4 className="font-bold">{definition.label}</h4>
                      <p className="text-[9px] uppercase tracking-widest text-neutral-600">Capa {layer.display_order}</p>
                    </div>
                  </div>
                  <IconButton label={`Guardar ${definition.label}`} onClick={() => saveLayer(layer)} disabled={saving}><Save size={15}/></IconButton>
                </div>
                <p className="text-xs leading-5 text-neutral-400 mt-5 min-h-10">{definition.mission}</p>
                <label className="block mt-5"><FieldLabel>Estado</FieldLabel><select value={layer.status} onChange={event => updateLayerLocal(layer.id, { status: event.target.value })} className="anima-input">{Object.entries(LAYER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="block mt-4"><FieldLabel>Foco actual</FieldLabel><input value={layer.current_focus || ''} onChange={event => updateLayerLocal(layer.id, { current_focus: event.target.value })} className="anima-input" placeholder="Próximo resultado comprobable"/></label>
                <label className="block mt-4">
                  <div className="flex justify-between"><FieldLabel>Madurez</FieldLabel><span className="text-[10px] tabular-nums text-neutral-400">{layer.progress}%</span></div>
                  <input type="range" min="0" max="100" step="5" value={layer.progress} onChange={event => updateLayerLocal(layer.id, { progress: event.target.value })} className="w-full accent-white"/>
                </label>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2"><History size={16} className="text-cyan-300"/><h3 className="text-sm font-black uppercase tracking-widest">Registro reciente</h3></div>
          <button type="button" onClick={() => setActiveArea('registry')} className="text-[10px] font-black uppercase tracking-widest text-neutral-500 hover:text-white">Ver todo</button>
        </div>
        {experiments.length ? (
          <div className="border-y border-white/10 divide-y divide-white/10">
            {experiments.slice(0, 5).map(experiment => <ExperimentRow key={experiment.id} experiment={experiment} onOpen={() => { setSelectedId(experiment.id); setActiveArea('registry'); }}/>) }
          </div>
        ) : (
          <EmptyRegistry onCreate={openNew}/>
        )}
      </section>
    </div>
  );

  const renderRegistry = () => (
    <div className="grid xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] gap-10">
      <section className="min-w-0 xl:border-r xl:border-white/10 xl:pr-10">
        <div className="flex flex-col md:flex-row gap-3 mb-5">
          <label className="relative flex-1"><Search size={15} className="absolute left-3 top-3.5 text-neutral-600"/><input value={search} onChange={event => setSearch(event.target.value)} className="anima-input pl-9" placeholder="Buscar experimento"/></label>
          <select value={layerFilter} onChange={event => setLayerFilter(event.target.value)} className="anima-input md:w-40"><option value="all">Todas las capas</option>{Object.entries(LAYERS).map(([value, layer]) => <option key={value} value={value}>{layer.shortLabel}</option>)}</select>
        </div>
        <div className="border-y border-white/10 divide-y divide-white/10">
          {filteredExperiments.map(experiment => (
            <button key={experiment.id} type="button" onClick={() => setSelectedId(experiment.id)} className={`w-full text-left py-4 px-3 border-l-2 transition-colors ${selectedId === experiment.id ? 'border-cyan-300 bg-white/[0.04]' : 'border-transparent hover:bg-white/[0.025]'}`}>
              <div className="flex justify-between gap-3">
                <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-widest" style={{ color: LAYERS[experiment.layer]?.color }}>{experiment.experiment_code} · {LAYERS[experiment.layer]?.shortLabel}</p><h4 className="font-bold text-sm mt-1 truncate">{experiment.title}</h4></div>
                <StatusPill status={experiment.status}/>
              </div>
              <p className="text-[10px] text-neutral-600 mt-2">Fase {experiment.phase} · {PHASES[experiment.phase]}</p>
            </button>
          ))}
          {!filteredExperiments.length && <div className="py-12 text-center text-xs text-neutral-600">No hay registros para este filtro.</div>}
        </div>
      </section>

      <section className="min-w-0">
        {selected ? (
          <>
            <div className="flex items-start justify-between gap-5 border-b border-white/10 pb-6">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: LAYERS[selected.layer]?.color }}>{selected.experiment_code} · {LAYERS[selected.layer]?.label}</p>
                <h3 className="text-2xl font-serif italic font-bold mt-2">{selected.title}</h3>
                <div className="mt-3"><StatusPill status={selected.status}/></div>
              </div>
              <div className="flex gap-2"><IconButton label="Editar experimento" onClick={() => openEdit(selected)}><Pencil size={15}/></IconButton><IconButton label="Eliminar experimento" onClick={() => deleteExperiment(selected)} className="hover:text-red-400"><Trash2 size={15}/></IconButton></div>
            </div>

            <div className="py-6 border-b border-white/10">
              <FieldLabel>Hipótesis</FieldLabel>
              <p className="text-sm leading-6 text-neutral-300">{selected.hypothesis}</p>
              {selected.result_summary && <><div className="mt-5"><FieldLabel>Resultado</FieldLabel></div><p className="text-sm leading-6 text-neutral-400">{selected.result_summary}</p></>}
              {selected.evidence_url && <a href={selected.evidence_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-cyan-300 mt-5 hover:text-white"><ExternalLink size={14}/>Abrir evidencia</a>}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 border-b border-white/10 divide-x divide-white/10 py-6">
              <Metric label="RAM pico" value={formatNumber(selected.peak_ram_gb, ' GB')}/>
              <Metric label="Línea base" value={formatNumber(selected.baseline_peak_ram_gb, ' GB')}/>
              <Metric label="Duración" value={formatNumber(selected.duration_minutes, ' min')}/>
              <Metric label="Costo" value={selected.cost_mxn === null ? '—' : `$${formatNumber(selected.cost_mxn)}`}/>
            </div>

            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4 py-6 border-b border-white/10 text-xs">
              <Detail label="Modelo" value={selected.model_name}/><Detail label="Dataset" value={selected.dataset_name}/><Detail label="Hardware" value={selected.hardware}/><Detail label="Restricción" value={`${formatNumber(selected.ram_limit_gb, ' GB RAM')} · ${formatNumber(selected.cpu_threads, ' threads')}`}/><Detail label="Rendimiento" value={formatNumber(selected.tokens_per_second, ' tok/s')}/><Detail label={selected.quality_metric || 'Calidad'} value={formatNumber(selected.quality_value)}/><Detail label="Reanudable" value={selected.resumable ? 'Sí' : 'No'}/><Detail label="Reproducible" value={selected.reproducible ? 'Sí' : 'Pendiente'}/>
            </div>

            <div className="pt-6">
              <div className="flex items-center gap-2 mb-4"><History size={15} className="text-neutral-500"/><h4 className="text-xs font-black uppercase tracking-widest">Bitácora</h4></div>
              <form onSubmit={addLog} className="grid md:grid-cols-[140px_minmax(0,1fr)_44px] gap-2 mb-5">
                <select value={logForm.event_type} onChange={event => setLogForm({ ...logForm, event_type: event.target.value })} className="anima-input">{Object.entries(LOG_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
                <input required value={logForm.message} onChange={event => setLogForm({ ...logForm, message: event.target.value })} className="anima-input" placeholder="Qué cambió, qué mediste o qué decidiste"/>
                <IconButton label="Añadir a la bitácora" className="h-11" onClick={addLog} disabled={saving}><Plus size={16}/></IconButton>
              </form>
              <div className="divide-y divide-white/10 border-y border-white/10">
                {logs.map(log => <div key={log.id} className="py-4"><div className="flex justify-between gap-4"><span className="text-[9px] font-black uppercase tracking-widest text-cyan-300">{LOG_TYPE_LABELS[log.event_type]}</span><time className="text-[9px] text-neutral-600">{new Date(log.created_at).toLocaleString('es-MX')}</time></div><p className="text-xs leading-5 text-neutral-400 mt-2">{log.message}</p></div>)}
                {!logs.length && <p className="text-xs text-neutral-600 py-8 text-center">Sin entradas todavía.</p>}
              </div>
            </div>
          </>
        ) : <EmptyRegistry onCreate={openNew}/>}
      </section>
    </div>
  );

  const renderForm = () => (
    <form onSubmit={submitExperiment} className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-6 border-b border-white/10 pb-6 mb-7">
        <div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Scientific record</p><h3 className="text-2xl font-serif italic font-bold mt-1">{editingId ? 'Editar experimento' : 'Nuevo experimento'}</h3><p className="text-xs text-neutral-500 mt-2">Una afirmación solo avanza cuando tiene una línea base y evidencia comparable.</p></div>
        <IconButton label="Cerrar formulario" onClick={() => setActiveArea('registry')}><X size={16}/></IconButton>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 lg:divide-x divide-white/10">
        <fieldset className="space-y-4">
          <legend className="text-xs font-black uppercase tracking-widest mb-5">Identidad</legend>
          <div className="grid grid-cols-2 gap-3"><label><FieldLabel>Código</FieldLabel><input required value={form.experiment_code} onChange={event => setForm({ ...form, experiment_code: event.target.value.toUpperCase() })} className="anima-input" placeholder="ANIMA-001"/></label><label><FieldLabel>Capa</FieldLabel><select value={form.layer} onChange={event => setForm({ ...form, layer: event.target.value })} className="anima-input">{Object.entries(LAYERS).map(([value, layer]) => <option key={value} value={value}>{layer.shortLabel}</option>)}</select></label></div>
          <label><FieldLabel>Título</FieldLabel><input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="anima-input" placeholder="Qué se está probando"/></label>
          <label><FieldLabel>Hipótesis verificable</FieldLabel><textarea required rows="5" value={form.hypothesis} onChange={event => setForm({ ...form, hypothesis: event.target.value })} className="anima-input resize-none" placeholder="Si aplicamos X, entonces Y cambia frente a la línea base..."/></label>
          <div className="grid grid-cols-2 gap-3"><label><FieldLabel>Fase</FieldLabel><select value={form.phase} onChange={event => setForm({ ...form, phase: event.target.value })} className="anima-input">{PHASES.map((phase, index) => <option key={phase} value={index}>{index} · {phase}</option>)}</select></label><label><FieldLabel>Estado</FieldLabel><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value })} className="anima-input">{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
        </fieldset>

        <fieldset className="space-y-4 lg:pl-8">
          <legend className="text-xs font-black uppercase tracking-widest mb-5">Entorno y límites</legend>
          <label><FieldLabel>Modelo</FieldLabel><input value={form.model_name} onChange={event => setForm({ ...form, model_name: event.target.value })} className="anima-input" placeholder="Arquitectura y tamaño"/></label>
          <label><FieldLabel>Dataset</FieldLabel><input value={form.dataset_name} onChange={event => setForm({ ...form, dataset_name: event.target.value })} className="anima-input" placeholder="Nombre y versión"/></label>
          <label><FieldLabel>Hardware</FieldLabel><input value={form.hardware} onChange={event => setForm({ ...form, hardware: event.target.value })} className="anima-input" placeholder="CPU, GPU, RAM y nodo"/></label>
          <div className="grid grid-cols-2 gap-3"><label><FieldLabel>Límite RAM (GB)</FieldLabel><input min="0" step="0.1" type="number" value={form.ram_limit_gb} onChange={event => setForm({ ...form, ram_limit_gb: event.target.value })} className="anima-input"/></label><label><FieldLabel>CPU threads</FieldLabel><input min="1" step="1" type="number" value={form.cpu_threads} onChange={event => setForm({ ...form, cpu_threads: event.target.value })} className="anima-input"/></label></div>
          <div className="flex gap-6 pt-2"><label className="anima-check"><input type="checkbox" checked={form.resumable} onChange={event => setForm({ ...form, resumable: event.target.checked })}/>Reanudable</label><label className="anima-check"><input type="checkbox" checked={form.reproducible} onChange={event => setForm({ ...form, reproducible: event.target.checked })}/>Reproducible</label></div>
        </fieldset>

        <fieldset className="space-y-4 lg:pl-8">
          <legend className="text-xs font-black uppercase tracking-widest mb-5">Medición</legend>
          <div className="grid grid-cols-2 gap-3"><label><FieldLabel>RAM base (GB)</FieldLabel><input min="0" step="0.1" type="number" value={form.baseline_peak_ram_gb} onChange={event => setForm({ ...form, baseline_peak_ram_gb: event.target.value })} className="anima-input"/></label><label><FieldLabel>RAM ANIMA (GB)</FieldLabel><input min="0" step="0.1" type="number" value={form.peak_ram_gb} onChange={event => setForm({ ...form, peak_ram_gb: event.target.value })} className="anima-input"/></label></div>
          <div className="grid grid-cols-2 gap-3"><label><FieldLabel>Tiempo base (min)</FieldLabel><input min="0" step="0.1" type="number" value={form.baseline_duration_minutes} onChange={event => setForm({ ...form, baseline_duration_minutes: event.target.value })} className="anima-input"/></label><label><FieldLabel>Tiempo ANIMA (min)</FieldLabel><input min="0" step="0.1" type="number" value={form.duration_minutes} onChange={event => setForm({ ...form, duration_minutes: event.target.value })} className="anima-input"/></label></div>
          <div className="grid grid-cols-2 gap-3"><label><FieldLabel>Tokens / segundo</FieldLabel><input min="0" step="0.01" type="number" value={form.tokens_per_second} onChange={event => setForm({ ...form, tokens_per_second: event.target.value })} className="anima-input"/></label><label><FieldLabel>Energía (Wh)</FieldLabel><input min="0" step="0.01" type="number" value={form.energy_wh} onChange={event => setForm({ ...form, energy_wh: event.target.value })} className="anima-input"/></label></div>
          <div className="grid grid-cols-2 gap-3"><label><FieldLabel>Métrica calidad</FieldLabel><input value={form.quality_metric} onChange={event => setForm({ ...form, quality_metric: event.target.value })} className="anima-input" placeholder="Loss, accuracy..."/></label><label><FieldLabel>Resultado</FieldLabel><input type="number" step="0.0001" value={form.quality_value} onChange={event => setForm({ ...form, quality_value: event.target.value })} className="anima-input"/></label></div>
          <label><FieldLabel>Costo estimado (MXN)</FieldLabel><input min="0" step="0.01" type="number" value={form.cost_mxn} onChange={event => setForm({ ...form, cost_mxn: event.target.value })} className="anima-input"/></label>
        </fieldset>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 border-t border-white/10 mt-8 pt-7">
        <label><FieldLabel>Resumen del resultado</FieldLabel><textarea rows="4" value={form.result_summary} onChange={event => setForm({ ...form, result_summary: event.target.value })} className="anima-input resize-none" placeholder="Qué ocurrió y qué decisión permite tomar"/></label>
        <label><FieldLabel>Enlace de evidencia</FieldLabel><input type="url" value={form.evidence_url} onChange={event => setForm({ ...form, evidence_url: event.target.value })} className="anima-input" placeholder="Repositorio, notebook, reporte o artefacto"/></label>
      </div>
      <div className="flex justify-end gap-3 mt-7"><button type="button" onClick={() => setActiveArea('registry')} className="anima-secondary">Cancelar</button><button type="submit" disabled={saving} className="anima-primary"><Save size={15}/>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Registrar experimento'}</button></div>
    </form>
  );

  return (
    <div>
      <style>{`.anima-input{width:100%;min-height:44px;background:#050505;border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:10px 12px;color:white;font-size:12px;outline:none}.anima-input:focus{border-color:#67e8f9}.anima-input option{background:#0a0a0a}.anima-icon-button{width:40px;height:40px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.1);border-radius:6px;color:#737373;transition:.2s}.anima-icon-button:hover{color:white;border-color:rgba(255,255,255,.25)}.anima-icon-button:disabled{opacity:.4}.anima-primary,.anima-secondary{min-height:44px;border-radius:6px;padding:0 18px;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;gap:8px}.anima-primary{background:white;color:#050505}.anima-secondary{border:1px solid rgba(255,255,255,.12);color:#a3a3a3}.anima-primary:disabled{opacity:.45}.anima-check{display:flex;align-items:center;gap:8px;color:#a3a3a3;font-size:11px;font-weight:700}.anima-check input{accent-color:#67e8f9}`}</style>
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 border border-cyan-300/30 bg-cyan-300/5 rounded-md flex items-center justify-center flex-shrink-0"><BrainCircuit size={21} className="text-cyan-300"/></div>
          <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">GBA Artificial Intelligence R&D</p><h2 className="text-3xl font-serif italic font-bold mt-1">ANIMA Control Room</h2><p className="text-sm text-neutral-500 mt-2 max-w-2xl">Investigación medible para ejecutar y adaptar modelos bajo límites reales de memoria, CPU, energía y presupuesto.</p></div>
        </div>
        <button type="button" onClick={openNew} className="anima-primary self-start lg:self-auto"><FilePlus2 size={15}/>Nuevo experimento</button>
      </div>

      <div className="flex items-center gap-1 border-b border-white/10 mb-8 overflow-x-auto" role="tablist" aria-label="Áreas de ANIMA">
        {[['overview', 'Resumen', BarChart3], ['registry', 'Experimentos', Gauge]].map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={activeArea === id} onClick={() => setActiveArea(id)} className={`h-11 px-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border-b-2 whitespace-nowrap ${activeArea === id ? 'border-cyan-300 text-white' : 'border-transparent text-neutral-600 hover:text-neutral-300'}`}><Icon size={14}/>{label}</button>)}
        {activeArea === 'form' && <button type="button" role="tab" aria-selected="true" className="h-11 px-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border-b-2 border-cyan-300 text-white whitespace-nowrap"><FilePlus2 size={14}/>{editingId ? 'Edición' : 'Nuevo registro'}</button>}
      </div>

      {notice && <div className={`mb-7 border-l-2 px-4 py-3 text-xs ${notice.type === 'error' ? 'border-red-500 bg-red-500/5 text-red-300' : 'border-lime-400 bg-lime-400/5 text-lime-200'}`}><div className="flex items-center gap-2">{notice.type === 'error' ? <X size={14}/> : <Check size={14}/>}<span>{notice.message}</span></div></div>}

      {loading ? <div className="min-h-72 flex items-center justify-center text-neutral-600"><RefreshCw size={22} className="animate-spin"/></div> : activeArea === 'overview' ? renderOverview() : activeArea === 'form' ? renderForm() : renderRegistry()}
    </div>
  );
}

function ExperimentRow({ experiment, onOpen }) {
  return (
    <button type="button" onClick={onOpen} className="w-full grid md:grid-cols-[120px_minmax(0,1fr)_150px_150px] gap-3 items-center py-4 text-left hover:bg-white/[0.025] transition-colors">
      <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: LAYERS[experiment.layer]?.color }}>{experiment.experiment_code}</span>
      <span className="min-w-0"><span className="font-bold text-sm block truncate">{experiment.title}</span><span className="text-[10px] text-neutral-600 block mt-1 truncate">{experiment.model_name || 'Modelo por definir'}</span></span>
      <span className="text-[10px] text-neutral-500">Fase {experiment.phase} · {PHASES[experiment.phase]}</span>
      <span className="md:justify-self-end"><StatusPill status={experiment.status}/></span>
    </button>
  );
}

function Metric({ label, value }) {
  return <div className="px-4 first:pl-0"><p className="text-base font-bold tabular-nums truncate">{value}</p><p className="text-[8px] font-black uppercase tracking-widest text-neutral-600 mt-1">{label}</p></div>;
}

function Detail({ label, value }) {
  return <div className="flex justify-between gap-5 border-b border-white/5 pb-3"><span className="text-neutral-600">{label}</span><span className="text-neutral-300 text-right">{value || '—'}</span></div>;
}

function EmptyRegistry({ onCreate }) {
  return <div className="min-h-56 border-y border-dashed border-white/10 flex flex-col items-center justify-center text-center px-6"><BrainCircuit size={25} className="text-neutral-700 mb-3"/><p className="font-bold text-sm text-neutral-300">ANIMA todavía no tiene experimentos</p><p className="text-xs text-neutral-600 mt-1 mb-5 max-w-md">El primer registro debe establecer una hipótesis, sus límites y una línea base comparable.</p><button type="button" onClick={onCreate} className="anima-secondary"><Plus size={14}/>Crear registro</button></div>;
}
