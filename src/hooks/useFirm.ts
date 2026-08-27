import { useEffect, useState } from "react";
import { fetchFirmProfileFromSupabase } from "@/data/Settings";

/**
 * Small read-only hook for the current user's firm name, for places that
 * need it inline (e.g. a message preview) and shouldn't hardcode or guess
 * one. Reuses fetchFirmProfileFromSupabase (already used by Settings/
 * WhatsApp) rather than a new query — same fetch, no new failure surface.
 * Never falls back to any specific firm's name on error/loading — only the
 * neutral "Your CA" placeholder callers should show meanwhile.
 */
export function useFirm() {
  const [firmName, setFirmName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchFirmProfileFromSupabase()
      .then((profile) => {
        if (!cancelled) setFirmName(profile.firmName || "");
      })
      .catch(() => {
        if (!cancelled) setFirmName("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { firmName, loading };
}
