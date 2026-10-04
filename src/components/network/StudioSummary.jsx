import React from "react";
import { ArrowUpRight, Building2 } from "lucide-react";
import { safeUrl } from "../../network/serverData";
import { studioLink } from "../../studios/studioData";
export default function StudioSummary({ studio }) {
  return (
    <a href={studioLink(studio.slug)} className="ds-summary">
      <span className="ds-avatar">
        {safeUrl(studio.logo_url) ? (
          <img src={safeUrl(studio.logo_url)} alt="" />
        ) : (
          <Building2 size={24} />
        )}
      </span>
      <span className="min-w-0">
        <strong className="block text-sm">{studio.nombre}</strong>
        <p className="vn-note line-clamp-2">
          {studio.rank || studio.descripcion}
        </p>
      </span>
      <ArrowUpRight size={16} className="shrink-0 ml-auto" />
    </a>
  );
}
