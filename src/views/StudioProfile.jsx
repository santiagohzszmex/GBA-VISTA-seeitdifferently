import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Building2, Users } from "lucide-react";
import { networkRpc } from "../hooks/useNetworkServers";
import { safeUrl } from "../network/serverData";
import { profileLink, serverLink, studioLink } from "../studios/studioData";
import "../components/network/network.css";
export default function StudioProfile({ slug }) {
  const [studio, setStudio] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    networkRpc("vista_development_studio", { p_slug: slug })
      .then((data) => {
        if (active) setStudio(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, retry]);
  return (
    <main className="vn ds-profile">
      <div className="ds-container">
        <a className="vn-link mb-8" href="/?network=1">
          <ArrowLeft size={15} />
          Volver a Network
        </a>
        {loading ? (
          <p role="status" className="vn-note py-16">
            Abriendo estudio…
          </p>
        ) : error ? (
          <div role="alert" className="vn-error">
            {error}
            <button
              className="vn-button mt-4"
              onClick={() => setRetry((n) => n + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : !studio ? (
          <div className="vn-empty">
            <h1>Estudio no disponible.</h1>
            <p>El perfil puede estar retirado o el enlace haber cambiado.</p>
          </div>
        ) : (
          <>
            {safeUrl(studio.portada_url) && (
              <img
                className="ds-profile-cover"
                src={safeUrl(studio.portada_url)}
                alt={`Portada de ${studio.nombre}`}
              />
            )}
            <header className="ds-profile-heading">
              <span className="ds-avatar ds-avatar-large">
                {safeUrl(studio.logo_url) ? (
                  <img src={safeUrl(studio.logo_url)} alt="" />
                ) : (
                  <Building2 size={40} />
                )}
              </span>
              <div>
                <p className="vn-eyebrow">
                  Estudio de desarrollo · VISTA Network
                </p>
                <h1>{studio.nombre}</h1>
                <p className="ds-description">{studio.descripcion}</p>
              </div>
            </header>
            <div className="vn-actions">
              {[
                ["website_url", "Sitio web"],
                ["discord_url", "Discord"],
                ["support_url", "Apoyar el estudio"],
              ].map(
                ([key, label]) =>
                  safeUrl(studio[key]) && (
                    <a
                      key={key}
                      className="vn-button vn-button-quiet"
                      href={safeUrl(studio[key])}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {label}
                      <ArrowUpRight size={14} />
                    </a>
                  ),
              )}
            </div>
            {studio.support_url && (
              <p className="vn-note">
                El apoyo se realiza en una plataforma externa y llega al
                estudio.
              </p>
            )}
            <section className="ds-section">
              <p className="vn-eyebrow">Mundos creados por el equipo</p>
              <h2>Sus servidores.</h2>
              {studio.servers.length ? (
                <div className="ds-grid">
                  {studio.servers.map((s) => (
                    <a
                      key={s.id}
                      href={serverLink(s.slug)}
                      className="ds-project"
                    >
                      {safeUrl(s.portada_url) && (
                        <img
                          loading="lazy"
                          src={safeUrl(s.portada_url)}
                          alt=""
                        />
                      )}
                      <div>
                        <strong>{s.nombre}</strong>
                        <p className="vn-note">{s.headline || s.descripcion}</p>
                        <span className="vn-link mt-4">
                          Explorar servidor
                          <ArrowUpRight size={14} />
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="vn-note">
                  Todavía no hay servidores publicados vinculados a este
                  estudio.
                </p>
              )}
            </section>
            <section className="ds-section">
              <p className="vn-eyebrow">Otros proyectos</p>
              <h2>Portafolio.</h2>
              {studio.portfolio.length ? (
                <div className="ds-grid">
                  {studio.portfolio.map((p, i) => (
                    <article key={i} className="ds-project">
                      {safeUrl(p.image_url) && (
                        <img loading="lazy" src={safeUrl(p.image_url)} alt="" />
                      )}
                      <div>
                        <strong>{p.title}</strong>
                        <p className="vn-note whitespace-pre-wrap">
                          {p.description}
                        </p>
                        {safeUrl(p.url) && (
                          <a
                            href={safeUrl(p.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="vn-link mt-4"
                          >
                            Ver proyecto
                            <ArrowUpRight size={14} />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="vn-note">
                  El equipo aún no ha añadido proyectos a su portafolio.
                </p>
              )}
            </section>
            <section className="ds-section">
              <p className="vn-eyebrow">
                <Users size={14} className="inline mr-2" />
                Las personas detrás
              </p>
              <h2>Colaboradores.</h2>
              <div className="ds-grid">
                {studio.members.map((m, i) => {
                  const content = (
                    <>
                      <span className="ds-avatar">
                        {(m.name || "GB").slice(0, 2).toUpperCase()}
                      </span>
                      <span>
                        <strong className="block text-sm">{m.name}</strong>
                        <p className="vn-note">{m.rank || "Colaboración"}</p>
                        {m.handle && (
                          <span className="vn-link text-xs mt-2">
                            Ver perfil y créditos
                            <ArrowUpRight size={12} />
                          </span>
                        )}
                      </span>
                    </>
                  );
                  return m.handle ? (
                    <a
                      key={m.handle}
                      className="ds-summary"
                      href={profileLink(m.handle)}
                    >
                      {content}
                    </a>
                  ) : (
                    <div key={i} className="ds-summary">
                      {content}
                    </div>
                  );
                })}
              </div>
              <p className="vn-note">
                Participaciones confirmadas con GBA ID. Los enlaces respetan la
                visibilidad de cada perfil.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
