/**
 * ResetPasswordPage.tsx
 *
 * Shown after user clicks the "Reset Password" email link.
 * At this point Supabase has already established a session
 * via the recovery token. We just need to call updateUser.
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Verify we have a valid recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // No session — the recovery link was not followed correctly
        toast.error("Invalid or expired reset link. Please request a new one.");
        navigate("/login", { replace: true });
        return;
      }
      setSessionReady(true);
    });
  }, [navigate]);

  const validatePassword = (): string | null => {
    if (!password) return "Password is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  };

  const handleReset = async () => {
    const validationError = validatePassword();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        if (error.message.includes("same password")) {
          toast.error("New password must be different from your current password.");
        } else {
          toast.error(error.message ?? "Failed to reset password. Please try again.");
        }
        return;
      }

      setDone(true);
      // Sign out after reset so user signs in fresh with new password
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/login", { replace: true });
      }, 3000);

    } catch (err: any) {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (): { label: string; color: string; width: string } => {
    if (!password) return { label: "", color: "", width: "0%" };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) return { label: "Weak", color: "bg-destructive", width: "33%" };
    if (score <= 3) return { label: "Fair", color: "bg-yellow-500", width: "66%" };
    return { label: "Strong", color: "bg-green-500", width: "100%" };
  };

  const strength = passwordStrength();

  if (!sessionReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary mb-4">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-heading font-bold">CA Munim</h1>
          <p className="text-sm text-muted-foreground mt-1">Set a new password</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">

          {done ? (
            <div className="text-center space-y-4 py-4">
              <div className="h-16 w-16 rounded-full bg-green-100 mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <h2 className="text-xl font-heading font-bold">Password Updated!</h2>
              <p className="text-sm text-muted-foreground">
                Your password has been changed successfully.
                <br />
                Taking you to sign in...
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="text-lg font-heading font-semibold">Reset Your Password</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose a strong password for your CA Munim account.
                </p>
              </div>

              {/* New password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
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

                {/* Password strength bar */}
                {password && (
                  <div className="space-y-1 mt-2">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                        style={{ width: strength.width }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Strength: <span className="font-medium">{strength.label}</span>
                    </p>
                  </div>
                )}

                <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                  <li className={password.length >= 8 ? "text-green-600" : ""}>
                    {password.length >= 8 ? "✓" : "·"} At least 8 characters
                  </li>
                  <li className={/[A-Z]/.test(password) ? "text-green-600" : ""}>
                    {/[A-Z]/.test(password) ? "✓" : "·"} One uppercase letter
                  </li>
                  <li className={/[0-9]/.test(password) ? "text-green-600" : ""}>
                    {/[0-9]/.test(password) ? "✓" : "·"} One number
                  </li>
                </ul>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className={`pr-10 ${
                      confirmPassword && confirmPassword !== password
                        ? "border-destructive"
                        : confirmPassword && confirmPassword === password
                        ? "border-green-500"
                        : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs text-destructive">Passwords do not match.</p>
                )}
                {confirmPassword && confirmPassword === password && (
                  <p className="text-xs text-green-600">✓ Passwords match.</p>
                )}
              </div>

              <Button
                onClick={handleReset}
                disabled={loading || !password || !confirmPassword}
                className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Updating password...</>
                ) : (
                  "Set New Password"
                )}
              </Button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel — back to Sign In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
