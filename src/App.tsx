import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";

import Index from "./pages/Index.tsx";
import Clients from "./pages/Clients.tsx";
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

// ── Auth + onboarding guard ──────────────────────────────────────────────────
function ProtectedRoute({
  session,
  onboardingComplete,
  children,
}: {
  session: Session | null;
  onboardingComplete: boolean | null;
  children: React.ReactNode;
}) {
  const location = useLocation();

  // Not logged in → go to login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Logged in but onboarding not done → go to onboarding
  if (onboardingComplete === false) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

// ── Inner app (has router context) ──────────────────────────────────────────
function AppRoutes() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);

  // Check if onboarding is complete for this user
  const checkOnboarding = async (userId: string) => {
    setCheckingOnboarding(true);

    try {
      const { data: firmData, error: firmError } = await supabase
        .from("firms")
        .select("onboarding_complete")
        .eq("id", userId)
        .single();

      if (firmData && !firmError) {
        setOnboardingComplete(Boolean(firmData.onboarding_complete));
        return;
      }

      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("firm_id, firms(onboarding_complete)")
        .eq("auth_user_id", userId)
        .single();

      if (staffError) {
        console.warn("Unable to check onboarding status via staff record:", staffError);
      }

      const complete = (staffData?.firms as any)?.onboarding_complete ?? false;
      setOnboardingComplete(Boolean(complete));
    } catch (err) {
      console.warn("Error checking onboarding status:", err);
      setOnboardingComplete(false);
    } finally {
      setCheckingOnboarding(false);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) checkOnboarding(session.user.id);
      else setOnboardingComplete(null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) checkOnboarding(session.user.id);
      else { setOnboardingComplete(null); setCheckingOnboarding(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show spinner while checking session or onboarding status
  if (session === undefined || (session && checkingOnboarding)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {session && onboardingComplete && <GlobalSearch />}
      <Routes>
        {/* ── Fully public ── */}
        <Route path="/upload/:token" element={<UploadPortal />} />

        {/* ── Auth — redirect to / if already logged in ── */}
        <Route
          path="/login"
          element={
            session
              ? onboardingComplete
                ? <Navigate to="/" replace />
                : <Navigate to="/onboarding" replace />
              : <AuthPage />
          }
        />

        {/* ── Onboarding — only for logged-in users who haven't completed it ── */}
        <Route
          path="/onboarding"
          element={
            !session
              ? <Navigate to="/login" replace />
              : onboardingComplete
              ? <Navigate to="/" replace />
              : <OnboardingPage onComplete={() => setOnboardingComplete(true)} />
          }
        />

        {/* ── Protected app routes ── */}
        {[
          { path: "/", element: <Index /> },
          { path: "/clients", element: <Clients /> },
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
            element={
              <ProtectedRoute session={session} onboardingComplete={onboardingComplete}>
                {element}
              </ProtectedRoute>
            }
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
