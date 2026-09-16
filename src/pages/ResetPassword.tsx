import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Loader2 } from "lucide-react";

type Phase = "verifying" | "ready" | "invalid";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("verifying");
  const [problem, setProblem] = useState("");
  const navigate = useNavigate();
  const ready = phase === "ready";

  useEffect(() => {
    let cancelled = false;

    // New-style links carry the one-time token hash; we exchange it here so
    // mail scanners pre-fetching the URL can't burn the token first.
    const url = new URL(window.location.href);
    const tokenHash = url.searchParams.get("token_hash");
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const urlError = hash.get("error_description") || hash.get("error") ||
      url.searchParams.get("error_description");

    const fail = (msg: string) => {
      if (cancelled) return;
      setProblem(msg);
      setPhase("invalid");
    };

    if (urlError) {
      fail(decodeURIComponent(urlError.replace(/\+/g, " ")));
      return;
    }

    if (tokenHash) {
      supabase.auth
        .verifyOtp({ type: "recovery", token_hash: tokenHash })
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error || !data.session) {
            fail(error?.message || "This reset link is no longer valid.");
            return;
          }
          window.history.replaceState({}, "", "/reset-password");
          setPhase("ready");
        });
      return;
    }

    // Legacy hash links: Supabase establishes the session itself.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setPhase("ready");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) setPhase("ready");
      else fail("This reset link is invalid, expired, or has already been used.");
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success("Password updated! Redirecting…");
      setTimeout(() => navigate("/dashboard"), 1200);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center mb-4">
            <Logo size="lg" />
          </div>
          <p className="text-muted-foreground">Set a new password</p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>
              {ready
                ? "Enter a new password for your account."
                : "Open this page from the reset link in your email. If you got here by mistake, request a new link from the sign-in page."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loading || !ready}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters. Passwords are checked against known data breaches.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={loading || !ready}
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-accent to-primary"
                disabled={loading || !ready}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Updating…
                  </>
                ) : "Update password"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
            ← Back to sign in
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
