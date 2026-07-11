import * as Sentry from "@sentry/react";

// Opt-in: does nothing unless VITE_SENTRY_DSN is set. There's no DSN
// checked into this repo (Sentry requires an account this project doesn't
// have yet) — add one to .env to activate. Once active, Sentry's own
// window.onerror/unhandledrejection hooks plus the ErrorBoundary below
// cover uncaught exceptions; this does not retrofit try/catch blocks
// across the app to explicitly report already-handled errors.
export function initErrorMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info("[errorMonitoring] VITE_SENTRY_DSN not set — error monitoring disabled.");
    }
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

export const ErrorBoundary = Sentry.ErrorBoundary;
