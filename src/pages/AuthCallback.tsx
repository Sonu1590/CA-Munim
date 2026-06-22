/**
 * AuthCallback.tsx
 * 
 * Handles all Supabase email redirect links:
 * - Email confirmation after signup
 * - Password reset links
 * - Magic links
 * 
 * Supabase redirects to this URL with tokens in the hash fragment:
 * /auth/callback#access_token=...&type=signup
 * /auth/callback#access_token=...&type=recovery
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type CallbackState = "processing" | "confirmed" | "recovery" | "error";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [state, setState] = useState<CallbackState>("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Parse the hash fragment from the URL
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.replace("#", "?").slice(1));
        const type = params.get("type");
        const errorDescription = params.get("error_description");

        if (errorDescription) {
          // Link expired or already used
          setState("error");
          setMessage(
            errorDescription.includes("expired")
              ? "This link has expired. Please request a new one."
              : decodeURIComponent(errorDescription)
          );
          return;
        }

        // Let Supabase process the token from the URL hash
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setState("error");
          setMessage("Invalid or expired link. Please try again.");
          return;
        }

        if (type === "recovery") {
          // Password reset flow — go to reset password page
          // The session is already set, ResetPasswordPage will use it
          setState("recovery");
          setTimeout(() => navigate("/reset-password", { replace: true }), 1500);
          return;
        }

        if (type === "signup" || type === "email_change") {
          // Email confirmed successfully
          setState("confirmed");
          setMessage("Email verified! Taking you to your dashboard...");

          // Check if onboarding is complete
          if (data.session?.user) {
            const { data: staffRow } = await supabase
              .from("staff")
              .select("firm_id, firms(onboarding_complete)")
              .eq("auth_user_id", data.session.user.id)
              .maybeSingle();

            const onboardingDone = (staffRow?.firms as any)?.onboarding_complete;
            setTimeout(() => {
              navigate(onboardingDone ? "/" : "/onboarding", { replace: true });
            }, 2000);
          } else {
            setTimeout(() => navigate("/login", { replace: true }), 2000);
          }
          return;
        }

        // Unknown type — just go to dashboard if logged in
        if (data.session) {
          navigate("/", { replace: true });
        } else {
          navigate("/login", { replace: true });
        }

      } catch (err) {
        console.error("Auth callback error:", err);
        setState("error");
        setMessage("Something went wrong. Please try signing in again.");
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center space-y-5 shadow-sm">

        {state === "processing" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <h2 className="text-xl font-heading font-bold">Verifying your link...</h2>
            <p className="text-sm text-muted-foreground">Please wait a moment.</p>
          </>
        )}

        {state === "confirmed" && (
          <>
            <div className="h-16 w-16 rounded-full bg-green-100 mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <h2 className="text-xl font-heading font-bold">Email Verified!</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
          </>
        )}

        {state === "recovery" && (
          <>
            <div className="h-16 w-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-primary" />
            </div>
            <h2 className="text-xl font-heading font-bold">Link verified</h2>
            <p className="text-sm text-muted-foreground">
              Taking you to the password reset screen...
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <div className="h-16 w-16 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
              <XCircle className="h-9 w-9 text-destructive" />
            </div>
            <h2 className="text-xl font-heading font-bold">Link Problem</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate("/login", { replace: true })}
              className="mt-4 text-sm font-medium text-primary hover:underline"
            >
              Back to Sign In →
            </button>
          </>
        )}

      </div>
    </div>
  );
}
