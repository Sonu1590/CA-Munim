import { useEffect, useState, useCallback } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  useLocation,
} from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

import Index from "./pages/Index.tsx";
import Clients from "./pages/Clients.tsx";
import ClientProfile from "./pages/ClientProfile.tsx";
import Tasks from "./pages/Tasks.tsx";
import Documents from "./pages/Documents.tsx";
import WhatsApp from "./pages/WhatsApp.tsx";
import Billing from "./pages/Billing.tsx";
import Reports from "./pages/Reports.tsx";
import Settings from "./pages/Settings.tsx";
import PenaltyCalculator from "./pages/PenaltyCalculator.tsx";
import UploadPortal from "./pages/UploadPortal.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import OnboardingPage from "./pages/OnboardingPage.tsx";
import { GlobalSearch } from "./components/common/GlobalSearch";
import { FinancialYearProvider } from "@/context/financialYear";
import AuthCallback from "./pages/AuthCallback.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";

const queryClient = new QueryClient();

// ── Auth status type — single source of truth ────────────────────────────────
type AuthStatus = "loading" | "unauthenticated" | "onboarding" | "ready" | "error";

// ── Route guard ──────────────────────────────────────────────────────────────
function ProtectedRoute({ status, children }: { status: AuthStatus; children: React.ReactNode }) {
  const location = useLocation();

  if (status === "loading" || status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  if (status === "onboarding") {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}

// ── Inner app ────────────────────────────────────────────────────────────────
function AppRoutes() {
  const [status, setStatus] = useState<AuthStatus>("loading");

  /**
   * Repairs missing firm/staff rows when the signup trigger's own error
   * handler swallowed a failure. Delegates to the ensure_my_firm() RPC
   * (SECURITY DEFINER, scoped to auth.uid()) instead of inserting directly —
   * a direct client insert can't satisfy firm-row RLS since firm ids are
   * server-generated, not derived from the user id. Silent — never throws,
   * never blocks the user.
   */
  const bootstrapMissingRecords = async (): Promise<void> => {
    const { error } = await supabase.rpc("ensure_my_firm");
    if (error) console.error("bootstrapMissingRecords:", error.message);
  };

  /**
   * THE SINGLE AUTH RESOLUTION PATH.
   * staff(auth_user_id) → firm(onboarding_complete)
   * No alternate paths. No fallbacks that hide bugs.
   */
  const resolveStatus = useCallback(async (session: Session | null) => {
    if (!session?.user) {
      setStatus("unauthenticated");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("staff")
        .select("firm_id, firms(onboarding_complete)")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (error) {
        // A query error (e.g. transient network issue) is not the same as
        // "this user has no firm yet" — don't force them into the
        // onboarding form, which could overwrite a real firm profile with
        // blank data if unknowingly resubmitted.
        console.error("resolveStatus error:", error.message);
        setStatus("error");
        return;
      }

      if (!data) {
        // Trigger failed — bootstrap silently then go to onboarding
        await bootstrapMissingRecords();
        setStatus("onboarding");
        return;
      }

      const complete = (data.firms as any)?.onboarding_complete;
      setStatus(complete === true ? "ready" : "onboarding");

    } catch (err) {
      console.error("resolveStatus unexpected:", err);
      setStatus("error");
    }
  }, []);

  const retryResolveStatus = () => {
    setStatus("loading");
    supabase.auth.getSession().then(({ data: { session } }) => resolveStatus(session));
  };

  useEffect(() => {
    // Initial session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      resolveStatus(session);
    });

    // All future auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveStatus(session);
    });

    return () => subscription.unsubscribe();
  }, [resolveStatus]);

  // Global loading screen — shown once on initial load
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading CA Munim...</p>
        </div>
      </div>
    );
  }

  // Couldn't resolve account status (e.g. transient network issue) — retry
  // rather than silently routing into onboarding.
  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3 text-center max-w-sm">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">
            Something went wrong while loading your account. This is usually a temporary network issue.
          </p>
          <Button onClick={retryResolveStatus}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {status === "ready" && <GlobalSearch />}
      <Routes>
        {/* Public */}
        <Route path="/upload/:token" element={<UploadPortal />} />

        {/* Login — bounces away if already authenticated */}
        <Route
          path="/login"
          element={
            status === "unauthenticated" ? <AuthPage /> :
            status === "onboarding" ? <Navigate to="/onboarding" replace /> :
            <Navigate to="/" replace />
          }
        />

        {/* Onboarding — only when logged in + incomplete */}
        <Route
          path="/onboarding"
          element={
            status === "unauthenticated" ? <Navigate to="/login" replace /> :
            status === "ready" ? <Navigate to="/" replace /> :
            <OnboardingPage onComplete={() => setStatus("ready")} />
          }
        />

        {/* Protected app pages */}
        {[
          { path: "/", element: <Index /> },
          { path: "/clients", element: <Clients /> },
          { path: "/clients/:id", element: <ClientProfile /> },
          { path: "/tasks", element: <Tasks /> },
          { path: "/documents", element: <Documents /> },
          { path: "/whatsapp", element: <WhatsApp /> },
          { path: "/billing", element: <Billing /> },
          { path: "/reports", element: <Reports /> },
          { path: "/settings", element: <Settings /> },
          { path: "/penalty-calculator", element: <PenaltyCalculator /> },
        ].map(({ path, element }) => (
          <Route
            key={path}
            path={path}
            element={<ProtectedRoute status={status}>{element}</ProtectedRoute>}
          />
        ))}

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute status={status}>
              <Navigate to="/" replace />
            </ProtectedRoute>
          }
        />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

// ── Root ─────────────────────────────────────────────────────────────────────
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <FinancialYearProvider>
          <AppRoutes />
        </FinancialYearProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
