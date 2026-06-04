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
import { Loader2 } from "lucide-react";
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

const queryClient = new QueryClient();

// ── Auth status type — single source of truth ────────────────────────────────
type AuthStatus = "loading" | "unauthenticated" | "onboarding" | "ready";

// ── Route guard ──────────────────────────────────────────────────────────────
function ProtectedRoute({ status, children }: { status: AuthStatus; children: React.ReactNode }) {
  const location = useLocation();

  if (status === "loading") {
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
   * Creates missing firms + staff rows when the signup trigger fails.
   * Silent — never throws, never blocks the user.
   */
  const bootstrapMissingRecords = async (session: Session): Promise<void> => {
    try {
      const userId = session.user.id;
      const email = session.user.email ?? "";
      const metadata = session.user.user_metadata ?? {};
      const caName = String(metadata.ca_name || metadata.full_name || metadata.name || email.split("@")[0] || "").trim();
      const firmName = String(metadata.firm_name || "").trim();
      const displayName = firmName || caName || email.split("@")[0];
      const icaiNumber = String(metadata.icai_number || "").trim();
      const practiceType = metadata.practice_type === "solo" ? "solo" : "firm";
      let firmId: string | null = null;

      const { data: existingFirm } = await supabase
        .from("firms")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingFirm?.id) {
        firmId = existingFirm.id;
      } else {
        const { data: newFirm } = await supabase
          .from("firms")
          .insert({
            name: displayName,
            ca_name: caName || null,
            icai_number: icaiNumber || null,
            email,
            practice_type: practiceType,
            onboarding_complete: false,
          })
          .select("id")
          .single();
        firmId = newFirm?.id ?? null;
      }

      if (!firmId) return;

      await supabase.from("staff").upsert(
        { firm_id: firmId, name: caName || email.split("@")[0], email, auth_user_id: userId, role: "admin", active: true },
        { onConflict: "auth_user_id" }
      );
    } catch (err) {
      console.error("bootstrapMissingRecords:", err);
    }
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
        console.error("resolveStatus error:", error.message);
        setStatus("onboarding");
        return;
      }

      if (!data) {
        // Trigger failed — bootstrap silently then go to onboarding
        await bootstrapMissingRecords(session);
        setStatus("onboarding");
        return;
      }

      const complete = (data.firms as any)?.onboarding_complete;
      setStatus(complete === true ? "ready" : "onboarding");

    } catch (err) {
      console.error("resolveStatus unexpected:", err);
      setStatus("onboarding");
    }
  }, []);

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
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
