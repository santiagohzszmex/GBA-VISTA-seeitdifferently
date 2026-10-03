import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, Film, Globe2, Link2, Loader2, Newspaper, ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import PartnerEmblem from '../components/network/PartnerEmblem';
import { ADMIN_KEYS, COUNTRIES, OPTIONS, STORAGE_KEY, SURVEY_KEY, SURVEY_PATH, SURVEY_VERSION, cleanAnswers, countryName, optionLabel, stepError, stepsFor } from '../survey/questionnaire';
import '../survey/survey.css';

const COPY = {
  roles:['Primero, tu perspectiva','¿Cómo vives\neste mundo?','¿Juegas, administras un servidor o cuentas sus historias? Puedes elegir varias opciones.'],
  vista:['Conoce VISTA','See it\ndifferently.','VISTA es la plataforma de GBA para descubrir historias, contenido y comunidades de Minecraft geopolítico. Tu opinión ayudará a definir su siguiente capítulo.'],
  country:['Tu comunidad','¿Desde dónde\nnos acompañas?','El país nos ayuda a entender a nuestras comunidades. También puedes preferir no responder.'],
  frequency:['Tu relación con VISTA','¿Cada cuánto\nnos encontramos?','Cuéntanos con qué frecuencia visitas VISTA. Si acabas de llegar, también queremos escucharte.'],
  content:['El siguiente capítulo','¿Qué te gustaría\nencontrar aquí?','Elige hasta tres tipos de contenido que te gustaría ver más en VISTA.'],
  server_info:['Muchos mundos','¿Qué necesitas\npara elegir uno?','Cuando buscas un servidor, ¿qué información te ayuda más a decidir? Elige hasta tres opciones.'],
  partners:['Conoce GBA Partners','Un lugar para\ntu comunidad.','GBA Partners es nuestra propuesta de promoción para servidores: espacios destacados en Network, claramente identificados como patrocinados.'],
  placements:['Para quienes administran','¿Qué considerarías\npara tu servidor?','Puedes elegir varias opciones. Las fichas gratuitas están en piloto; las campañas de contenido siguen en evaluación.'],
  goal:['Tu objetivo','¿Qué esperas\nde la promoción?','Elige el resultado principal que buscarías al pagar por promocionar tu servidor.'],
  budget:['Tu presupuesto','¿Cuánto tendría\nsentido para ti?','Piensa en un presupuesto mensual. Todavía estamos definiendo la propuesta: responder no implica contratar.'],
  payment:['A tu manera','¿Cómo preferirías\npagar?','Puedes elegir varios medios. Esta encuesta no solicita información bancaria ni procesa cobros.'],
  comment:['Tu voz','¿Qué cambiarías\no agregarías?','Un espacio para lo que no te preguntamos. Este comentario es opcional.'],
  review:['Una última mirada','Esta es\ntu perspectiva.','Revisa tus respuestas antes de enviarlas. Puedes volver y cambiar cualquier opción.'],
};
const CHAPTERS={roles:'Tu perspectiva',vista:'Conoce VISTA',country:'Tu comunidad',frequency:'Tu comunidad',content:'Tu VISTA',server_info:'Tu VISTA',partners:'Conoce Partners',placements:'Tu servidor',goal:'Tu servidor',budget:'Tu servidor',payment:'Tu servidor',comment:'Tu voz',review:'Revisión'};

function readDraft() {
  try {
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
    if(saved?.version===SURVEY_VERSION && typeof saved.token==='string' && saved.answers && typeof saved.answers==='object' && !Array.isArray(saved.answers)) return saved;
  } catch {}
  return {version:SURVEY_VERSION,token:crypto.randomUUID(),answers:{},step:'roles',submitted:false};
}

function WorldScene({step,index,reduced}) {
  return <div className={`vs-world vs-world-${step}`} aria-hidden="true">
    <motion.div className="vs-orbit" animate={{rotate:index*11,x:step==='vista'?60:0,scale:step==='partners'?1.12:1}} transition={{duration:reduced?0:1.1,ease:[.22,1,.36,1]}}>
      <svg viewBox="0 0 600 600" fill="none"><circle cx="300" cy="300" r="248"/><ellipse cx="300" cy="300" rx="130" ry="248"/><ellipse cx="300" cy="300" rx="40" ry="248"/><ellipse cx="300" cy="300" rx="248" ry="130"/><ellipse cx="300" cy="300" rx="248" ry="42"/><path d="M52 300H548M300 52V548"/></svg>
    </motion.div><span className="vs-world-caption">MINECRAFT GEOPOLÍTICO · MUCHAS PERSPECTIVAS</span>
  </div>;
}
function EditorialScene({partners=false}) {
  return <div className={`vs-editorial ${partners?'vs-editorial-partners':''}`}>
    {partners?<>
      <div className="vs-partner-intro"><PartnerEmblem size={68}/><span>GBA<br/><strong>Partners</strong></span></div>
      <div className="vs-space-preview"><div className="vs-preview-label">Hero · Espacio patrocinado</div><Globe2 size={32}/><span className="vs-preview-title">Tu mundo.<br/>Su próxima historia.</span><span className="vs-preview-link">Conocer el servidor <ArrowUpRight size={13}/></span></div>
      <div className="vs-explanation"><strong>Más presencia en Network.</strong><p>Una ficha gratuita para participar. Opciones de pago para destacar en el directorio o aparecer en un hero de pantalla completa.</p><p>Las campañas siguen en evaluación. Los espacios pagados llevarán su identificación de patrocinio.</p></div>
    </>:<>
      <div className="vs-newspaper"><span>VISTA · PRENSA</span><h2>Las historias<br/>de nuestros mundos.</h2><div className="vs-paper-rule"/><div className="vs-paper-columns"><p>Naciones, decisiones y comunidades. La actualidad contada por quienes la viven.</p><p>Periódicos y portadas para mirar los geopolíticos desde otras perspectivas.</p></div><Newspaper size={22}/></div>
      <div className="vs-media-strip"><Film size={18}/><div><strong>Videos y tutoriales.</strong><span>Contenido original y aportaciones de la comunidad.</span></div></div>
      <div className="vs-media-strip"><Globe2 size={18}/><div><strong>Network.</strong><span>Fichas de servidores para descubrir dónde jugar.</span></div></div>
    </>}
  </div>;
}
function ChoiceList({name,answers,onChange,max}) {
  const reduced=useReducedMotion();
  const multi=['roles','content','server_info','placements','payment'].includes(name);
  const selected=answers[name]||(multi?[]:'');
  function choose(value) {
    if(!multi) {onChange(name,value);return;}
    if(selected.includes(value)) onChange(name,selected.filter(item=>item!==value));
    else if(!max||selected.length<max) onChange(name,[...selected,value]);
  }
  const hasOther=multi?selected.includes('other'):selected==='other';
  return <><div className="vs-choices" role="group" aria-label={COPY[name]?.[2]||'Opciones'}>
    {OPTIONS[name].map(([value,label],index)=>{
      const active=multi?selected.includes(value):selected===value;
      return <motion.button key={value} type="button" className="vs-choice" aria-pressed={active} onClick={()=>choose(value)} disabled={Boolean(multi&&max&&selected.length>=max&&!active)} initial={{opacity:reduced?1:0,y:reduced?0:12}} animate={{opacity:1,y:0}} transition={{delay:reduced?0:index*.035,duration:reduced?0:.25}}><span className="vs-choice-number">{String(index+1).padStart(2,'0')}</span><span>{label}</span><span className={`vs-choice-mark ${multi?'':'vs-choice-radio'}`} aria-hidden="true">{active&&<Check size={13}/>}</span></motion.button>;
    })}
  </div>{max&&<p className="vs-selection-count" aria-live="polite">{selected.length} de {max} opciones seleccionadas</p>}
  {hasOther&&<label className="vs-field">Cuéntanos cuál<input value={answers[`${name}_other`]||''} maxLength={200} onChange={e=>onChange(`${name}_other`,e.target.value)}/></label>}</>;
}
function Review({answers,onEdit}) {
  const keys=['roles','country','frequency','content','server_info',...(answers.roles?.includes('admin')?['placements','goal','budget_status','payment']:[]),'comment'];
  const labels={roles:'Tu perfil',country:'País',frequency:'Visitas a VISTA',content:'Contenido',server_info:'Elegir servidor',placements:'Partners',goal:'Objetivo',budget_status:'Presupuesto mensual',payment:'Medios de pago',comment:'Tu comentario'};
  return <div className="vs-review">{keys.map(key=>{
    let value=answers[key];
    let display=Array.isArray(value)?value.map(v=>optionLabel(key,v)).join(' · '):key==='country'?countryName(value):key==='comment'?(value||'Sin comentario'):optionLabel(key,value);
    if(key==='budget_status'&&value==='amount') display=`${Number(answers.budget_amount).toLocaleString('es-MX')} ${answers.currency==='OTHER'?answers.currency_other:answers.currency}`;
    const other=answers[`${key}_other`];
    return <button type="button" key={key} onClick={()=>onEdit(key==='budget_status'?'budget':key)}><span>{labels[key]}</span><strong>{display}{other?` · ${other}`:''}</strong><ArrowLeft size={13} aria-label="Editar respuesta"/></button>;
  })}</div>;
}
export default function SurveyPage({previewMode=false}) {
  const {user}=useAuth();
  const reduced=useReducedMotion();
  const [draft,setDraft]=useState(readDraft);
  const [definition,setDefinition]=useState(null);
  const [loadError,setLoadError]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [direction,setDirection]=useState(1);
  const [copied,setCopied]=useState(false);
  const [honeypot,setHoneypot]=useState('');
  const headingRef=useRef(null),submitLock=useRef(false);
  const answers=draft.answers,steps=stepsFor(answers);
  const step=steps.includes(draft.step)?draft.step:'roles';
  const index=steps.indexOf(step);
  const [eyebrow,title,description]=COPY[step];
  const questionSteps=steps.filter(s=>!['vista','partners','review'].includes(s));
  const questionNumber=questionSteps.indexOf(step)+1;
  const loadDefinition=async()=>{
    setLoadError('');
    if(previewMode){setDefinition({version:1,is_open:true});return;}
    const {data,error:failed}=await supabase.from('vista_surveys').select('key,version,is_open').eq('key',SURVEY_KEY).single();
    if(failed)setLoadError('No pudimos abrir la encuesta. Inténtalo de nuevo en unos momentos.');else setDefinition(data);
  };
  useEffect(()=>{loadDefinition();const original=document.title;document.title='Tu perspectiva · VISTA | See it differently';return()=>{document.title=original;};},[previewMode]);
  useEffect(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(draft));}catch{}},[draft]);
  useEffect(()=>{headingRef.current?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});},[step,draft.submitted]);
  const change=(name,value)=>{
    setError('');
    setDraft(current=>{
      const changed={...current.answers,[name]:value};
      if(name==='roles'&&!value.includes('admin')) ADMIN_KEYS.forEach(key=>delete changed[key]);
      return {...current,answers:changed};
    });
  };
  function go(target,dir=1) {setError('');setDirection(dir);setDraft(current=>({...current,step:target}));}
  async function submit() {
    if(submitLock.current)return;
    const cleaned=cleanAnswers(answers);
    if(cleaned.budget_status==='amount') cleaned.budget_amount=Number(cleaned.budget_amount);
    if(cleaned.currency_other)cleaned.currency_other=cleaned.currency_other.toUpperCase();
    for(const s of stepsFor(cleaned)){const problem=stepError(s,cleaned);if(problem){go(s,-1);setError(problem);return;}}
    if(previewMode){setError('Vista de desarrollo: el envío está desactivado.');return;}
    submitLock.current=true;setBusy(true);setError('');
    try {
      const {data,error:failed}=await supabase.rpc('vista_submit_survey',{p_token:draft.token,p_answers:cleaned,p_version:SURVEY_VERSION,p_honeypot:honeypot});
      if(failed)throw failed;
      if(!data?.received)throw new Error('Respuesta sin confirmar');
      setDraft(current=>({...current,answers:cleaned,submitted:true}));
    } catch(failed) {
      const message=failed.message||'';
      setError(/Survey closed/.test(message)?'Esta encuesta ya cerró. Tus respuestas siguen guardadas en este dispositivo.':/version changed/.test(message)?'La encuesta cambió. Actualiza la página antes de enviar.':/Too many/.test(message)?'Recibimos muchos envíos desde esta conexión. Espera unos minutos y vuelve a intentar.':'No pudimos confirmar el envío. Tus respuestas están guardadas; puedes reintentar sin duplicarlas.');
    } finally {setBusy(false);submitLock.current=false;}
  }
  function next(){const problem=stepError(step,answers);if(problem){setError(problem);return;}if(step==='review')submit();else go(steps[index+1]);}
  const share=async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}${SURVEY_PATH}`);setCopied(true);}catch{setError('Puedes copiar el enlace desde la barra de direcciones.');}};
  const success=draft.submitted;
  return <div className={`vs-page ${reduced?'vs-reduced':''}`}>
    <WorldScene step={success?'success':step} index={index} reduced={reduced}/>
    <header className="vs-header"><a href="/" className="vs-wordmark" aria-label="VISTA, inicio">VISTA.</a><span className="vs-brand-line">See it differently.</span><a href="/" className="vs-exit">Volver a VISTA <ArrowUpRight size={13}/></a></header>
    {previewMode&&<p className="vs-dev">Vista de desarrollo · El envío está desactivado</p>}
    <main className="vs-main">
      {success?<motion.section className="vs-success" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
        <CheckCircle2 size={40}/><p className="vs-eyebrow">Respuesta recibida</p><h1 ref={headingRef} tabIndex={-1}>Gracias por mirar<br/>con nosotros.</h1><p>Tu perspectiva ya forma parte del siguiente capítulo de VISTA. Responder no implica contratar ni pagar.</p><div className="vs-success-actions"><button type="button" className="vs-primary" onClick={share}>{copied?<Check size={16}/>:<Link2 size={16}/>} {copied?'Enlace copiado':'Compartir la encuesta'}</button><a href="/" className="vs-secondary">Explorar VISTA <ArrowRight size={16}/></a></div>
      </motion.section>:loadError?<section className="vs-state"><h1>No pudimos conectar.</h1><p role="alert">{loadError}</p><button type="button" className="vs-primary" onClick={loadDefinition}>Reintentar</button></section>:!definition?<section className="vs-state" role="status"><Loader2 className="vs-spinner" size={24}/><p>Preparando tu perspectiva…</p></section>:!definition.is_open?<section className="vs-state"><p className="vs-eyebrow">Encuesta cerrada</p><h1>Gracias por<br/>acompañarnos.</h1><p>Terminó la recepción de respuestas para esta encuesta.</p><a href="/" className="vs-secondary">Volver a VISTA <ArrowRight size={16}/></a></section>:<>
        <nav className="vs-chapter" aria-label="Progreso de la encuesta"><span>{CHAPTERS[step]}</span><span>{questionNumber>0?`Pregunta ${questionNumber} de ${questionSteps.length}`:step==='review'?'Antes de enviar':'Una pausa para conocer'}</span><div role="progressbar" aria-label="Progreso" aria-valuenow={Math.round((index+1)/steps.length*100)} aria-valuemin={0} aria-valuemax={100}><motion.span animate={{width:`${(index+1)/steps.length*100}%`}} transition={{duration:reduced?0:.5}}/></div></nav>
        <AnimatePresence mode="wait" initial={false}><motion.section key={step} className={`vs-stage ${['vista','partners'].includes(step)?'vs-stage-story':''}`} initial={{opacity:0,x:reduced?0:direction*35}} animate={{opacity:1,x:0}} exit={{opacity:0,x:reduced?0:direction*-25}} transition={{duration:reduced?0:.3,ease:[.22,1,.36,1]}} onAnimationComplete={()=>headingRef.current?.focus({preventScroll:true})}>
          <div className="vs-copy"><p className="vs-eyebrow">{eyebrow}</p><h1 ref={headingRef} tabIndex={-1} aria-label={title.replaceAll('\n',' ')}>{title.split('\n').map((line,i)=><span className="vs-title-mask" aria-hidden="true" key={line}><motion.span initial={{y:reduced?0:'110%'}} animate={{y:0}} transition={{delay:i*.09,duration:reduced?0:.65,ease:[.22,1,.36,1]}}>{line}</motion.span></span>)}</h1><p className="vs-description">{description}</p></div>
          <div className="vs-answer">
            {['roles','frequency','content','server_info','placements','goal','payment'].includes(step)&&<ChoiceList name={step} answers={answers} onChange={change} max={['content','server_info'].includes(step)?3:undefined}/>}
            {step==='vista'&&<EditorialScene/>}{step==='partners'&&<EditorialScene partners/>}
            {step==='country'&&<><label className="vs-field">País<select value={answers.country||''} onChange={e=>change('country',e.target.value)}><option value="" disabled>Elige una opción</option><option value="none">Prefiero no responder</option>{COUNTRIES.map(([code,label])=><option key={code} value={code}>{label}</option>)}<option value="other">Otro país</option></select></label>{answers.country==='other'&&<label className="vs-field">¿Cuál?<input maxLength={200} value={answers.country_other||''} onChange={e=>change('country_other',e.target.value)}/></label>}</>}
            {step==='budget'&&<><ChoiceList name="budget_status" answers={answers} onChange={change}/>{answers.budget_status==='amount'&&<div className="vs-budget"><label className="vs-field">Cantidad mensual<input type="number" min="0" max="10000000" step="0.01" inputMode="decimal" value={answers.budget_amount??''} onChange={e=>change('budget_amount',e.target.value)}/></label><label className="vs-field">Moneda<select value={answers.currency||''} onChange={e=>change('currency',e.target.value)}><option value="" disabled>Elige una moneda</option><option value="MXN">MXN · Peso mexicano</option><option value="USD">USD · Dólar estadounidense</option><option value="EUR">EUR · Euro</option><option value="OTHER">Otra moneda</option></select></label>{answers.currency==='OTHER'&&<label className="vs-field">Código de moneda (por ejemplo COP)<input maxLength={3} value={answers.currency_other||''} onChange={e=>change('currency_other',e.target.value.toUpperCase())}/></label>}</div>}</>}
            {step==='comment'&&<label className="vs-field">Tu comentario <span>Opcional</span><textarea rows={5} maxLength={2000} value={answers.comment||''} onChange={e=>change('comment',e.target.value)} placeholder="Te escuchamos."/><small>{(answers.comment||'').length} / 2000</small></label>}
            {step==='review'&&<><Review answers={answers} onEdit={target=>go(target,-1)}/><p className="vs-privacy"><ShieldCheck size={16}/>{user?'Tu respuesta se asociará con tu GBA ID.':'Respondes sin cuenta; no pedimos nombre ni correo.'} Solo el equipo autorizado de GBA puede consultar las respuestas.</p></>}
          </div>
        </motion.section></AnimatePresence>
        <label className="vs-honeypot" aria-hidden="true">Sitio de contacto<input tabIndex={-1} autoComplete="off" value={honeypot} onChange={e=>setHoneypot(e.target.value)}/></label>
        {error&&<p className="vs-error" role="alert">{error}</p>}
        <footer className="vs-navigation"><button type="button" className="vs-back" onClick={()=>go(steps[index-1],-1)} disabled={index===0||busy}><ArrowLeft size={16}/> Atrás</button><span className="vs-anonymous">Sin registro obligatorio<br/>Tu borrador se guarda en este dispositivo</span><button type="button" className="vs-primary" onClick={next} disabled={busy}>{busy?<><Loader2 size={16} className="vs-spinner"/> Enviando…</>:step==='review'?<>Enviar respuestas <Check size={16}/></>:step==='comment'&&!answers.comment?<>Continuar sin comentario <ArrowRight size={16}/></>:step==='vista'?<>Dar mi opinión <ArrowRight size={16}/></>:<>Continuar <ArrowRight size={16}/></>}</button></footer>
      </>}
    </main><footer className="vs-bottom"><span>GBA · GLOBAL INSIGHT</span><span>Tu perspectiva. Nuestro siguiente capítulo.</span></footer>
  </div>;
}
