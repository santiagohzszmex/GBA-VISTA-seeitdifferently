import React, { useEffect, useState } from "react";
import { networkRpc } from "../hooks/useNetworkServers";
import { studioLink } from "../studios/studioData";
import { safeUrl } from "../network/serverData";
export default function StudioAdminTab() {
  const [items, setItems] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await networkRpc("vista_admin_studios"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const review = async (studio) => {
    setBusy(true);
    setError("");
    try {
      await networkRpc("vista_review_studio", {
        p_id: studio.id,
        p_hidden: !studio.hidden,
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section>
      <header className="flex justify-between gap-4 mb-6">
        <div>
          <h3 className="font-serif italic text-3xl">Estudios registrados.</h3>
          <p className="text-sm text-neutral-500 mt-3">
            El registro es gratuito. Puedes ocultar un perfil para revisar su
            contenido y restaurarlo después.
          </p>
        </div>
        <button
          className="text-xs text-neutral-400"
          onClick={refresh}
          disabled={loading || busy}
        >
          Actualizar
        </button>
      </header>
      {error && (
        <p className="text-red-300 text-sm mb-5" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="text-sm text-neutral-500" role="status">
          Abriendo estudios…
        </p>
      ) : !items.length ? (
        <p className="text-sm text-neutral-500">
          Todavía no hay estudios registrados.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((s) => (
            <article key={s.id} className="border border-white/10 p-6 rounded">
              <div className="flex items-center gap-4">
                {safeUrl(s.logo_url) && (
                  <img
                    src={safeUrl(s.logo_url)}
                    alt=""
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                <div>
                  <strong>{s.nombre}</strong>
                  <p className="text-xs text-neutral-500 mt-2">
                    @{s.owner_handle} · {s.hidden ? "Oculto" : "Visible"}
                  </p>
                </div>
              </div>
              <p className="text-sm text-neutral-400 mt-4 whitespace-pre-wrap">
                {s.descripcion}
              </p>
              <div className="flex gap-5 mt-5">
                <a
                  className="text-xs text-emerald-300"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={studioLink(s.slug)}
                >
                  Ver perfil
                </a>
                <button
                  className="text-xs border border-white/15 rounded px-4 py-2"
                  disabled={busy}
                  onClick={() => review(s)}
                >
                  {s.hidden ? "Restaurar perfil" : "Ocultar perfil"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
