import React, { useState } from 'react';
import {
  AtSign,
  Check,
  Copy,
  ExternalLink,
  Inbox,
  LockKeyhole,
  Mail,
  Send,
} from 'lucide-react';
import { GBA_MAIL } from '../config/mail';

export default function CommunicationsTab() {
  const [copiedAddress, setCopiedAddress] = useState('');

  const copyAddress = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedAddress(address);
      window.setTimeout(() => setCopiedAddress(''), 1800);
    } catch (error) {
      console.error('No se pudo copiar la dirección de correo:', error);
    }
  };

  return (
    <section className="max-w-6xl mx-auto" aria-labelledby="communications-title">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/10 pb-8 mb-8">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-emerald-400 mb-3">
            <Mail size={15} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Correo institucional</span>
          </div>
          <h2 id="communications-title" className="text-3xl md:text-4xl font-bold tracking-tight">
            Comunicaciones GBA
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-400">
            Acceso operativo a las identidades públicas de GBA, GIMG y VISTA Partners.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href={GBA_MAIL.composeUrl}
            target="_blank"
            rel="noreferrer"
            className="h-11 px-4 rounded-lg border border-white/15 text-neutral-200 hover:bg-white/5 transition-colors inline-flex items-center gap-2 text-xs font-bold"
          >
            <Send size={15} /> Nuevo mensaje
          </a>
          <a
            href={GBA_MAIL.inboxUrl}
            target="_blank"
            rel="noreferrer"
            className="h-11 px-4 rounded-lg bg-white text-black hover:bg-neutral-200 transition-colors inline-flex items-center gap-2 text-xs font-black"
          >
            <Inbox size={15} /> Abrir bandeja <ExternalLink size={14} />
          </a>
        </div>
      </div>

      <div className="grid gap-px rounded-lg overflow-hidden border border-white/10 bg-white/10">
        {GBA_MAIL.institutionalAddresses.map((identity) => (
          <article
            key={identity.address}
            className="min-h-24 bg-[#101010] px-5 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-4 min-w-0">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${identity.primary ? 'bg-emerald-400 text-black' : 'bg-white/5 text-neutral-400'}`}>
                <AtSign size={18} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-sm text-white">{identity.label}</h3>
                  {identity.primary && (
                    <span className="rounded px-2 py-1 bg-emerald-400/10 text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                      Principal
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-300 mt-1 break-all">{identity.address}</p>
                <p className="text-xs text-neutral-600 mt-1">{identity.description}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => copyAddress(identity.address)}
              className="h-10 px-3 rounded-lg border border-white/10 hover:bg-white/5 text-neutral-400 hover:text-white transition-colors inline-flex items-center justify-center gap-2 text-xs font-bold shrink-0"
              aria-label={`Copiar ${identity.address}`}
            >
              {copiedAddress === identity.address ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
              {copiedAddress === identity.address ? 'Copiado' : 'Copiar'}
            </button>
          </article>
        ))}
      </div>

      <div className="mt-8 py-5 border-y border-white/10 flex items-start gap-4 text-neutral-500">
        <LockKeyhole size={18} className="shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-neutral-300">Sesión protegida por Zoho Mail</p>
          <p className="text-xs leading-5 mt-1 max-w-3xl">
            Esta fase abre el correo en una pestaña segura. VISTA no almacena contraseñas ni puede leer mensajes hasta incorporar la conexión privada del servidor.
          </p>
        </div>
      </div>
    </section>
  );
}
