import { useCallback, useEffect, useRef, useState } from "react";
import { networkRpc } from "./useNetworkServers";
export function useDevelopmentStudios() {
  const [data, setData] = useState({
    studios: [],
    invitations: [],
    developerRequests: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const [workspace, developerRequests] = await Promise.all([
        networkRpc("vista_studios_workspace"),
        networkRpc("vista_my_developer_requests"),
      ]);
      if (id === request.current) setData({ ...workspace, developerRequests });
    } catch (e) {
      if (id === request.current)
        setError(e.message || "No pudimos abrir tus estudios.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    return () => {
      request.current++;
    };
  }, [refresh]);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", visible);
    return () => window.removeEventListener("focus", visible);
  }, [refresh]);
  const update = (studio) =>
    setData((current) => ({
      ...current,
      studios: [studio, ...current.studios.filter((s) => s.id !== studio.id)],
    }));
  return { ...data, loading, error, refresh, update };
}
