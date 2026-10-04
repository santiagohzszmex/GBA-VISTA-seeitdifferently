import React, { useEffect, useState } from "react";
import { networkRpc } from "../../hooks/useNetworkServers";
import StudioSummary from "../network/StudioSummary";
import "../../studios/studios.css";
export default function StudioDirectory() {
  const [studios, setStudios] = useState([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    networkRpc("vista_studio_directory")
      .then((data) => {
        if (active) setStudios(data || []);
      })
      .catch(() => {
        if (active) setError("No pudimos abrir los estudios.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);
  return (
    <section className="vn-directory ds-directory-heading" id="estudios">
      <p className="vn-eyebrow">Las personas detrás de los mundos</p>
      <div className="flex flex-wrap justify-between gap-4 items-center mb-6">
        <h2>Estudios de la comunidad.</h2>
        <a className="vn-button vn-button-quiet" href="/?workspace=studios">
          Registrar estudio gratis
        </a>
      </div>
      {loading ? (
        <p className="vn-note" role="status">
          Abriendo estudios…
        </p>
      ) : error ? (
        <p className="vn-error" role="alert">
          {error}
          <button
            className="vn-link ml-3"
            onClick={() => setRetry((n) => n + 1)}
          >
            Reintentar
          </button>
        </p>
      ) : studios.length ? (
        <div className="ds-grid">
          {studios.map((s) => (
            <StudioSummary key={s.id} studio={s} />
          ))}
        </div>
      ) : (
        <p className="vn-note">
          Presenta tu estudio, reúne a los colaboradores y publica tu
          portafolio. El registro es gratuito con GBA ID.
        </p>
      )}
    </section>
  );
}
