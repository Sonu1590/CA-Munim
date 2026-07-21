import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Best-effort adoption signal for the installable PWA (vite.config.ts's
// VitePWA, display: "standalone") — there was previously no way to tell how
// many users have installed the app vs. just using it in a browser tab.
// Logs three moments via the log_pwa_usage_event RPC (firm_id/user_id
// derived server-side from the caller's session, not asserted by the
// client — see the pwa_usage_events migration): a session starting already
// in standalone display mode, the browser offering the install prompt, and
// the user completing that install. Deliberately does not call
// event.preventDefault() on beforeinstallprompt — that would defer (and
// require the app to manually re-trigger) the browser's native install UI,
// which is a UX change beyond "add a usage signal." Failures are swallowed
// — this is telemetry, not a feature, and must never surface an error or
// block rendering if a write fails.
function isStandaloneDisplayMode(): boolean {
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone === true;
}

async function logPwaEvent(eventType: "standalone_launch" | "prompt_shown" | "installed") {
  try {
    await supabase.rpc("log_pwa_usage_event", { p_event_type: eventType, p_user_agent: navigator.userAgent });
  } catch {
    // Best-effort telemetry — never let a failed write here affect the app.
  }
}

export function usePwaUsageSignal() {
  useEffect(() => {
    // Once per browser session (not once per page nav within the app) so a
    // user navigating between pages doesn't generate a launch event per page.
    const sessionKey = "ca-munim-pwa-launch-logged";
    if (isStandaloneDisplayMode() && !sessionStorage.getItem(sessionKey)) {
      sessionStorage.setItem(sessionKey, "1");
      logPwaEvent("standalone_launch");
    }

    const onBeforeInstallPrompt = () => {
      logPwaEvent("prompt_shown");
    };
    const onAppInstalled = () => {
      logPwaEvent("installed");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);
}
