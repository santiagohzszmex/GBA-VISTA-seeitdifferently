import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import ReviewPanel from "../recruitment/Admin";
import "../recruitment/recruitment.css";
export default function RecruitmentTab({ previewMode = false }) {
  const { user } = useAuth();
  const [access, setAccess] = useState(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (previewMode) return;
    let active = true;
    setAccess(null);
    setError("");
    supabase
      .rpc("gimg_recruitment_access")
      .then(({ data, error: failed }) => {
        if (!active) return;
        if (failed)
          setError("No pudimos comprobar el acceso a las solicitudes.");
        else setAccess(data);
      })
      .catch(() => {
        if (active)
          setError("No pudimos comprobar el acceso a las solicitudes.");
      });
    return () => {
      active = false;
    };
  }, [user?.id, previewMode, attempt]);
  return (
    <div className="rg-review-host">
      {!previewMode && !access ? (
        <section className="rg-panel">
          <p>{error || "Abriendo las solicitudes de GIMG…"}</p>
          {error && (
            <button
              className="rg-button"
              onClick={() => setAttempt((v) => v + 1)}
            >
              Reintentar
            </button>
          )}
        </section>
      ) : previewMode || access.reviewer ? (
        <ReviewPanel
          key={user?.id || "preview"}
          user={user}
          director={previewMode || access.director}
          previewMode={previewMode}
        />
      ) : (
        <section className="rg-panel">
          <h2>Acceso del equipo de selección</h2>
          <p>
            Tu cuenta no tiene permiso para revisar esta convocatoria. Dirección
            puede incorporar tu GBA ID.
          </p>
        </section>
      )}
    </div>
  );
}
