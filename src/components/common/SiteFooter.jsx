import React from 'react';
import { ArrowUpRight, Mail } from 'lucide-react';
import { GBA_MAIL } from '../../config/mail';
import { VISTA_PUBLIC_ORIGIN } from '../../utils/publicUrl';

const contactOrder = ['contacto@gba.software', 'prensa@gba.software', 'partners@gba.software'];

export default function SiteFooter() {
  const contacts = contactOrder
    .map(address => GBA_MAIL.institutionalAddresses.find(item => item.address === address))
    .filter(Boolean);

  return (
    <footer className="bg-[#111111] text-white border-t border-white/10" aria-label="Información de VISTA">
      <div className="max-w-[1500px] mx-auto px-6 md:px-12 py-12 md:py-16">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.5fr)_minmax(220px,0.75fr)_minmax(220px,0.75fr)]">
          <div className="max-w-xl">
            <p className="font-serif italic text-4xl leading-none">VISTA</p>
            <p className="mt-5 text-sm font-bold text-white">Una plataforma de Global Insight Media Group.</p>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Publicación y contenido para comunidades geopolíticas de Minecraft.
            </p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-5">Contacto</p>
            <div className="space-y-4">
              {contacts.map(contact => (
                <a
                  key={contact.address}
                  href={`mailto:${contact.address}`}
                  className="group flex items-start gap-3 text-sm text-neutral-300 hover:text-white transition-colors"
                >
                  <Mail size={15} className="mt-0.5 shrink-0 text-neutral-600 group-hover:text-emerald-400" />
                  <span>
                    <span className="block text-xs font-bold text-white">{contact.label}</span>
                    <span className="block mt-1 break-all">{contact.address}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 mb-5">Sitios oficiales</p>
            <div className="space-y-3">
              <a
                href={VISTA_PUBLIC_ORIGIN}
                className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 text-sm text-neutral-300 hover:text-white transition-colors"
              >
                VISTA <ArrowUpRight size={15} />
              </a>
              <a
                href="https://gba.software"
                className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 text-sm text-neutral-300 hover:text-white transition-colors"
              >
                gba.software <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-5 border-t border-white/10 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-600">
          2026 Global Insight Media Group
        </div>
      </div>
    </footer>
  );
}
