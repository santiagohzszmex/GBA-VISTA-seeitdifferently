import React, { useEffect, useState } from "react";
import { networkRpc } from "../../hooks/useNetworkServers";
import StudioSummary from "../network/StudioSummary";
import { serverLink } from "../../studios/studioData";
import "../../studios/studios.css";
export default function ProfileStudios({ userId }) {
  const [data, setData] = useState({ studios: [], servers: [] }),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData({ studios: [], servers: [] });
    setError("");
    networkRpc("vista_profile_studios", { p_user_id: userId })
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active)
          setError(
            "No pudimos cargar los estudios y servidores de este perfil.",
          );
      });
    return () => {
      active = false;
    };
  }, [userId]);
  if (error)
    return (
      <p role="alert" className="vn-error mt-8">
        {error}
      </p>
    );
  if (!data.studios.length && !data.servers.length) return null;
  return (
    <section className="vn ds-section">
      <p className="vn-eyebrow">Participaciones confirmadas con GBA ID</p>
      <h2>Estudios y desarrollo.</h2>
      <div className="ds-grid">
        {data.studios.map((s) => (
          <StudioSummary key={s.id} studio={s} />
        ))}
        {data.servers.map((s) => (
          <a key={s.id} className="ds-summary" href={serverLink(s.slug)}>
            <span>
              <strong className="block text-sm">{s.nombre}</strong>
              <span className="vn-note">Desarrollo del servidor</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
