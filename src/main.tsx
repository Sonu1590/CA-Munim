import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initErrorMonitoring, ErrorBoundary } from "@/lib/errorMonitoring";

initErrorMonitoring();

const fallback = (
  <div className="flex min-h-screen items-center justify-center p-6 text-center">
    <div className="space-y-2">
      <p className="text-lg font-semibold">Something went wrong.</p>
      <p className="text-sm text-muted-foreground">Please refresh the page. If this keeps happening, contact support.</p>
    </div>
  </div>
);

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary fallback={fallback}>
    <App />
  </ErrorBoundary>
);
