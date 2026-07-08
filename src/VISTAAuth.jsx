import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, ChevronLeft, ArrowRight, Loader2, AlertCircle, KeyRound, AtSign } from 'lucide-react';
import { supabase } from './supabaseClient';

function AllianceLogo() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="hover:scale-105 transition-transform duration-300">
      <circle cx="12" cy="12" r="10.5" className="fill-blue-600" />
      <path d="M 9 1.94 Q 11 13 22.45 13 L 9 13 Z" className="fill-emerald-500" />
      <line x1="9" y1="1.5" x2="9" y2="22.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="9" y1="13" x2="22.5" y2="13" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 9 1.94 Q 11 13 22.45 13" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function PinIndicators({ length }) {
  return (
    <div className="flex justify-center gap-5 my-8">
      {[0, 1, 2, 3].map((index) => (
        <motion.div
          key={index}
          initial={{ scale: 0.9 }}
          animate={{ scale: length > index ? 1.1 : 1, backgroundColor: length > index ? "#1d1d1f" : "#fbfbfd" }}
          className={`w-4 h-4 rounded-full border-2 ${length > index ? "border-[#1d1d1f]" : "border-[#d2d2d7]"} transition-colors duration-150`}
        />
      ))}
    </div>
  );
}

export default function VISTAAuth({ onLogin }) {
  const [flow, setFlow] = useState('login'); 
  // step: 'username' | 'discord' | 'phrase' | 'pin'
  const [step, setStep] = useState('username'); 
  
  const [nombre, setNombre] = useState('');
  const [discordId, setDiscordId] = useState('');
  const [frase, setFrase] = useState('');
  const [pin, setPin] = useState('');
  const pinInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const normalizePin = (value) => value.replace(/\D/g, '').slice(0, 4);

  // Limpiar errores si el usuario se mueve entre pantallas
  useEffect(() => {
    setError('');
    setPin('');
    if (step === 'username') {
      setFrase('');
      setDiscordId('');
    }
  }, [flow, step]);

  // Autoguardado del PIN
  useEffect(() => {
    if (step === 'pin' && pin.length === 4 && !loading) {
      procesarPIN();
    }
  }, [pin, step]);

  useEffect(() => {
    if (step !== 'pin' || loading) return;

    const focusTimer = window.setTimeout(() => {
      pinInputRef.current?.focus({ preventScroll: true });
    }, 80);

    return () => window.clearTimeout(focusTimer);
  }, [step, loading, error]);

  // ==========================================
  // EL "ROUTER" DE PANTALLAS
  // ==========================================
  const handleNextStep = async (e) => {
    e.preventDefault(); 
    setError('');
    setLoading(true);

    try {
      if (step === 'username') {
        if (!nombre.trim()) return;

        if (flow === 'register') {
          const { data } = await supabase.from('usuarios').select('nombre').eq('nombre', nombre.trim()).maybeSingle();
          if (data) {
            setError('Este GBA ID ya está en uso.');
            setLoading(false);
            return;
          }
          setStep('discord'); // Nuevo paso agregado al registro
        } 
        else if (flow === 'recover') {
          const { data } = await supabase.from('usuarios').select('nombre').eq('nombre', nombre.trim()).maybeSingle();
          if (!data) {
            setError('Este GBA ID no existe.');
            setLoading(false);
            return;
          }
          setStep('phrase'); 
        } 
        else {
          setStep('pin');
        }
      } 
      else if (step === 'discord') {
        if (!discordId.trim()) {
          setError('El usuario de Discord es obligatorio.');
          setLoading(false);
          return;
        }
        setStep('phrase');
      }
      else if (step === 'phrase') {
        if (!frase.trim()) {
          setError('La frase de seguridad es obligatoria.');
          setLoading(false);
          return;
        }
        setStep('pin'); 
      }
    } catch (err) {
      setError('Ocurrió un error. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // PROCESAMIENTO FINAL
  // ==========================================
  const getPhantomEmail = (id) => `${id.toLowerCase().replace(/\s+/g, '')}@gba.com`;
  const getSecurePassword = (codigo) => `GBA-${codigo}-SecureVault`;

  const procesarPIN = async () => {
    setLoading(true);
    setError('');

    const email = getPhantomEmail(nombre);
    const password = getSecurePassword(pin);

    try {
      if (flow === 'login') {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) {
          setError('GBA ID o clave incorrectos.');
          setPin('');
          setLoading(false);
          return;
        }
        const { data: userData } = await supabase.from('usuarios').select('*').eq('id', data.user.id).single();
        onLogin(userData || data.user);
      } 
      
      else if (flow === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email, password, options: { data: { nombre: nombre.trim() } }
        });

        if (signUpError) throw signUpError;

        setTimeout(async () => {
          // Guardamos la frase secreta Y el Discord ID juntos
          await supabase.from('usuarios')
            .update({ 
              frase_seguridad: frase.trim().toLowerCase(),
              discord_id: discordId.trim()
            })
            .eq('id', data.user.id);

          const { data: newUserData } = await supabase.from('usuarios').select('*').eq('id', data.user.id).single();
          onLogin(newUserData || data.user);
        }, 1000);
      } 
      
      else if (flow === 'recover') {
        const { data: exito, error: rpcError } = await supabase.rpc('reset_pin_seguro', {
          p_nombre: nombre.trim(),
          p_frase: frase.trim().toLowerCase(),
          p_nuevo_pin: pin
        });

        if (rpcError || !exito) {
          setError('La frase de seguridad es incorrecta.');
          setPin('');
          setStep('phrase'); 
          setLoading(false);
          return;
        }

        const { data: authData } = await supabase.auth.signInWithPassword({ email, password });
        const { data: userData } = await supabase.from('usuarios').select('*').eq('id', authData.user.id).single();
        onLogin(userData || authData.user);
      }

    } catch (err) {
      console.error(err);
      setError('Error de conexión con la base de datos.');
      setPin('');
      setLoading(false);
    }
  };

  // ==========================================
  // MANEJO DE TEXTOS EN PANTALLA
  // ==========================================
  const getTitles = () => {
    if (step === 'username') {
      if (flow === 'login') return { title: 'Accede a VISTA con tu GBA ID.', subtitle: 'Tu GBA ID (Nombre de usuario)' };
      if (flow === 'register') return { title: 'Crea tu GBA ID.', subtitle: 'Tu GBA ID (Nombre de usuario)' };
      if (flow === 'recover') return { title: 'Recuperación de Acceso.', subtitle: 'Ingresa tu GBA ID' };
    }
    if (step === 'discord') {
      return { title: 'Vincula tu cuenta de Discord.' };
    }
    if (step === 'phrase') {
      if (flow === 'register') return { title: 'Configura tu Frase de Seguridad.' };
      if (flow === 'recover') return { title: 'Verificación de Identidad.' };
    }
    if (step === 'pin') {
      if (flow === 'login') return { title: 'Introduce tu clave de seguridad.' };
      if (flow === 'register') return { title: 'Crea tu clave de acceso.' };
      if (flow === 'recover') return { title: 'Crea tu nueva clave de acceso.' };
    }
    return { title: '', subtitle: '' };
  };

  const titles = getTitles();

  return (
    <div className="min-h-screen bg-[#fbfbfd] flex flex-col items-center justify-center px-6 selection:bg-[#1d1d1f] selection:text-white relative">
      
      {/* Botón "Volver" con lógica actualizada para incluir Discord */}
      {step !== 'username' && (
        <button 
          onClick={() => {
            if (step === 'pin') {
              if (flow !== 'login') setStep('phrase');
              else setStep('username');
            } else if (step === 'phrase') {
              if (flow === 'register') setStep('discord');
              else setStep('username'); 
            } else if (step === 'discord') {
              setStep('username');
            }
          }}
          className="absolute top-12 left-6 md:left-12 text-[#86868b] hover:text-[#1d1d1f] flex items-center gap-1 text-sm transition-colors font-medium z-10"
        >
          <ChevronLeft size={16} /> Volver
        </button>
      )}

      {/* Botón "Cancelar" */}
      {(flow === 'recover' || flow === 'register') && step === 'username' && (
        <button 
          onClick={() => setFlow('login')}
          className="absolute top-12 left-6 md:left-12 text-[#86868b] hover:text-[#1d1d1f] flex items-center gap-1 text-sm transition-colors font-medium z-10"
        >
          <ChevronLeft size={16} /> Cancelar
        </button>
      )}

      <AnimatePresence mode="wait">
        <motion.div 
          key={flow + '-' + step}
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm text-center"
        >
          <div className="flex justify-center mb-6"><AllianceLogo /></div>
          <span className="text-[10px] font-bold tracking-[0.3em] text-[#86868b] uppercase block mb-2">
            Global Insight Media Group
          </span>
          <h1 className="font-serif italic text-3xl md:text-4xl text-[#1d1d1f] mb-10 tracking-tight leading-tight">
            {titles.title}
          </h1>

          {/* ESTADO 1: PANTALLA DE USUARIO */}
          {step === 'username' && (
            <form onSubmit={handleNextStep} className="space-y-6 text-left">
              <div className="relative border-b border-[#d2d2d7] focus-within:border-[#1d1d1f] transition-colors pb-1">
                <User className="absolute left-0 top-3 text-[#86868b]" size={20} strokeWidth={1.5} />
                <input 
                  type="text" placeholder={titles.subtitle} 
                  className="w-full bg-transparent py-3 pl-10 text-lg focus:outline-none placeholder:text-[#86868b]/60 text-[#1d1d1f] font-medium"
                  value={nombre} onChange={(e) => setNombre(e.target.value)}
                  disabled={loading} autoFocus required
                />
              </div>
              {error && <div className="flex items-center gap-2 text-red-500 text-sm font-medium pt-2"><AlertCircle size={16} /> {error}</div>}
              <button 
                type="submit" disabled={loading || !nombre.trim()}
                className="w-full bg-[#1d1d1f] text-white py-4 rounded-full font-medium hover:bg-black transition-all flex justify-center items-center gap-2 shadow-md disabled:opacity-30"
              >
                Continuar <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* ESTADO EXTRA: DISCORD ID (Solo en registro) */}
          {step === 'discord' && (
            <form onSubmit={handleNextStep} className="space-y-6 text-left">
              <p className="text-sm text-[#86868b] mb-4">
                Ingresa tu usuario de Discord. Esto nos permitirá identificarte en la comunidad de GlobalBank Alliance.
              </p>
              <div className="relative border-b border-[#d2d2d7] focus-within:border-[#1d1d1f] transition-colors pb-1">
                <AtSign className="absolute left-0 top-3 text-[#86868b]" size={20} strokeWidth={1.5} />
                <input 
                  type="text" placeholder="Usuario de Discord (ej. santiago#1234)" 
                  className="w-full bg-transparent py-3 pl-10 text-lg focus:outline-none placeholder:text-[#86868b]/60 text-[#1d1d1f] font-medium"
                  value={discordId} onChange={(e) => setDiscordId(e.target.value)}
                  disabled={loading} autoFocus required
                />
              </div>
              {error && <div className="flex items-center gap-2 text-red-500 text-sm font-medium pt-2"><AlertCircle size={16} /> {error}</div>}
              <button 
                type="submit" disabled={loading || !discordId.trim()}
                className="w-full bg-[#1d1d1f] text-white py-4 rounded-full font-medium hover:bg-black transition-all flex justify-center items-center gap-2 shadow-md disabled:opacity-30"
              >
                Continuar <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* ESTADO 2: FRASE DE SEGURIDAD */}
          {step === 'phrase' && (
            <form onSubmit={handleNextStep} className="space-y-6 text-left">
              <p className="text-sm text-[#86868b] mb-4">
                {flow === 'register' 
                  ? "Escribe una palabra o frase corta que solo tú conozcas. Esta será tu única forma de recuperar tu cuenta si olvidas el PIN."
                  : "Ingresa la Frase de Seguridad que configuraste al crear tu cuenta para verificar tu identidad."}
              </p>
              <div className="relative border-b border-[#d2d2d7] focus-within:border-[#1d1d1f] transition-colors pb-1">
                <KeyRound className="absolute left-0 top-3 text-[#86868b]" size={20} strokeWidth={1.5} />
                <input 
                  type="text" placeholder="Frase de Seguridad" 
                  className="w-full bg-transparent py-3 pl-10 text-lg focus:outline-none placeholder:text-[#86868b]/60 text-[#1d1d1f] font-medium"
                  value={frase} onChange={(e) => setFrase(e.target.value)}
                  disabled={loading} autoFocus required
                />
              </div>
              {error && <div className="flex items-center gap-2 text-red-500 text-sm font-medium pt-2"><AlertCircle size={16} /> {error}</div>}
              <button 
                type="submit" disabled={loading || !frase.trim()}
                className="w-full bg-[#1d1d1f] text-white py-4 rounded-full font-medium hover:bg-black transition-all flex justify-center items-center gap-2 shadow-md disabled:opacity-30"
              >
                {flow === 'register' ? 'Guardar Frase' : 'Verificar'} <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* ESTADO 3: PIN DE SEGURIDAD */}
          {step === 'pin' && (
            <form 
              onSubmit={(e) => {
                e.preventDefault(); 
                if (pin.length === 4 && !loading) procesarPIN();
              }} 
              className="flex flex-col items-center relative"
            >
              <p className="text-sm text-[#86868b] font-medium">
                GBA ID: <span className="text-[#1d1d1f] font-bold">{nombre}</span>
              </p>
              <div
                className="relative w-full cursor-text"
                onClick={() => pinInputRef.current?.focus({ preventScroll: true })}
              >
                <PinIndicators length={pin.length} />
                <input
                  ref={pinInputRef}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  name="gba-pin"
                  aria-label="Clave de seguridad de 4 dígitos"
                  autoComplete={flow === 'login' ? 'current-password' : 'new-password'}
                  enterKeyHint="done"
                  className="absolute inset-0 h-full w-full cursor-text opacity-0"
                  value={pin}
                  onChange={(e) => setPin(normalizePin(e.target.value))}
                  disabled={loading}
                  autoFocus
                  required
                />
              </div>
              {loading && <Loader2 className="animate-spin text-[#86868b] mt-2" size={24} />}
              {error && <div className="flex items-center gap-2 text-red-500 text-sm font-medium mt-4"><AlertCircle size={16} /> {error}</div>}
              
              {flow === 'login' && !loading && (
                <button 
                  type="button"
                  onClick={() => { setFlow('recover'); setStep('username'); }}
                  className="mt-6 text-sm text-[#86868b] hover:text-[#1d1d1f] transition-colors font-medium underline underline-offset-4"
                >
                  ¿Olvidaste tu clave?
                </button>
              )}
              
              <p className="text-[#86868b]/60 text-xs mt-6 font-medium tracking-wide">
                Ingresa tu clave de 4 dígitos
              </p>
            </form>
          )}

          {/* FOOTER: CAMBIO LOGIN / REGISTRO */}
          {step === 'username' && flow !== 'recover' && (
            <button 
              onClick={() => setFlow(flow === 'login' ? 'register' : 'login')} 
              disabled={loading}
              className="mt-10 text-sm text-[#86868b] hover:text-[#1d1d1f] transition-colors font-medium border-b border-transparent hover:border-[#1d1d1f] pb-0.5"
            >
              {flow === 'login' ? '¿No tienes cuenta? Crea tu GBA ID' : '¿Ya tienes un GBA ID? Inicia sesión'}
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
