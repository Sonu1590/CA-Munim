import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2, Eye, EyeOff, LogIn } from "lucide-react";
import { toast } from "sonner";

const getAuthErrorMessage = (error: any) => {
  const message = (error?.message ?? error?.error ?? String(error ?? "")).toString();
  const lower = message.toLowerCase();
  if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
    return "Please verify your email first. Check your inbox for the confirmation link.";
  }
  if (lower.includes("already registered") || lower.includes("user already registered") || lower.includes("duplicate") || lower.includes("email")) {
    return "An account with this email already exists. Please sign in instead.";
  }
  if (lower.includes("invalid login credentials") || lower.includes("invalid password") || lower.includes("invalid email")) {
    return "Invalid credentials. If you just signed up, please verify your email and try again.";
  }
  if (lower.includes("row-level security") || lower.includes("policy")) {
    return "Unable to create your account because of permissions. Please try again or contact support.";
  }
  return message || "Something went wrong. Please try again.";
};

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [firmName, setFirmName] = useState("");
  const [icaiNumber, setIcaiNumber] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname ?? "/";

  const checkExistingEmail = async (email: string) => {
    const { data: firm, error: firmError } = await supabase
      .from("firms")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (firm) return true;
    if (firmError) {
      console.warn("Error checking existing firm email before signup:", firmError);
      return false;
    }

    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id")
      .eq("email", email)
      .limit(1)
      .maybeSingle();

    if (staff) return true;
    if (staffError) {
      console.warn("Error checking existing staff email before signup:", staffError);
      return false;
    }

    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      toast.error("Please enter your email and password.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        setEmail("");
        setPassword("");
        navigate(from, { replace: true });
      } else {
        const exists = await checkExistingEmail(normalizedEmail);
        if (exists) {
          toast.error("An account with this email already exists. Please sign in instead.");
          return;
        }

        const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password });
        if (error) throw error;

        if (!data.user) {
          setInfoMessage("Verification email sent. Please verify your email before signing in.");
          setPassword("");
          await new Promise((resolve) => setTimeout(resolve, 0));
          toast.success("Verification email sent. Please check your inbox and verify before signing in.");
          toast.info("Check your email for a confirmation link before signing in.");
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const profileUpdates = fullName.trim() || firmName.trim() || icaiNumber.trim()
          ? {
              name: firmName.trim() || fullName.trim() || normalizedEmail.split("@")[0],
              ca_name: fullName.trim() || normalizedEmail.split("@")[0],
              icai_number: icaiNumber.trim() || null,
            }
          : { name: normalizedEmail.split("@")[0] };

        await supabase
          .from("firms")
          .update(profileUpdates)
          .eq("email", normalizedEmail);

        toast.success("Account created! Complete your profile to get started.");
        setEmail("");
        setPassword("");
        setFullName("");
        setFirmName("");
        setIcaiNumber("");
        navigate("/onboarding", { replace: true });
      }
    } catch (err: any) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary mb-4">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">CA Munim</h1>
          <p className="text-sm text-muted-foreground mt-1">Your digital practice manager</p>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border p-1 mb-6">
            <button
              type="button"
              onClick={() => {
            setMode("login");
            setEmail("");
            setPassword("");
            setFullName("");
            setFirmName("");
            setIcaiNumber("");
            setInfoMessage("");
          }}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                mode === "login"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
              setMode("signup");
              setEmail("");
              setPassword("");
              setFullName("");
              setFirmName("");
              setIcaiNumber("");
              setInfoMessage("");
            }}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${
                mode === "signup"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Your Name *</Label>
                  <Input
                    id="fullName"
                    placeholder="CA Priya Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="firmName">Firm Name</Label>
                  <Input
                    id="firmName"
                    placeholder="Sharma & Associates"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    autoComplete="organization"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="icaiNumber">ICAI Membership Number</Label>
                  <Input
                    id="icaiNumber"
                    placeholder="123456"
                    value={icaiNumber}
                    onChange={(e) => setIcaiNumber(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@yourfirm.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setInfoMessage("");
                }}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={mode === "signup" ? "Min. 8 characters" : "Your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          {infoMessage && (
            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
              {infoMessage}
            </div>
          )}

          <div className="mt-4 text-center text-xs text-muted-foreground">or continue with</div>
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full h-11 mt-3 gap-2"
          >
            <LogIn className="h-4 w-4" />
            Continue with Google
          </Button>

          {/* Forgot password */}
          {mode === "login" && (
            <button
              type="button"
              onClick={async () => {
                if (!email) { toast.error("Enter your email address first."); return; }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: window.location.origin + "/reset-password",
                });
                if (error) toast.error(error.message);
                else toast.success("Password reset email sent. Check your inbox.");
              }}
              className="w-full text-center text-xs text-muted-foreground hover:text-foreground mt-4 block"
            >
              Forgot password?
            </button>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Your data is secured with row-level encryption.
          <br />© {new Date().getFullYear()} CA Munim
        </p>
      </div>
    </div>
  );
}
