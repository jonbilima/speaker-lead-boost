import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { Loader2 } from "lucide-react";

/* "confirm": a reset link arrived and we are waiting for a person to press the
 * button. "code": the customer is typing the 6-digit code from the email. */
type Phase = "verifying" | "confirm" | "code" | "ready" | "invalid";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>("verifying");
  const [problem, setProblem] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ready = phase === "ready";

  /* A banned account can be issued reset links forever and can never use one:
   * verifyOtp rejects every token with "User is banned". Offering the resend
   * form here put lapsed members on a treadmill — request, receive, fail,
   * repeat — with the reason printed directly above the button that couldn't
   * possibly work. A ban is a billing state, so say so and point at the fix. */
  const membershipEnded = /banned/i.test(problem);

  // Sending someone back to /auth to retype their address is three steps for a
  // customer who is already stuck. Mint the replacement from this page instead.
  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = resendEmail.trim();
    if (!addr) {
      toast.error("Enter the email address you bought with.");
      return;
    }
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("auth-email", {
        body: { action: "recovery", email: addr },
      });
      if (error) throw error;
      if (data?.error) toast.error(data.error);
      else { setResent(true); toast.success("New link sent. Check your email."); }
    } catch (err: any) {
      toast.error(err?.message || "Couldn't send the link. Email support@nextmic.ai and we'll get you in.");
    }
    setResending(false);
  };

  useEffect(() => {
    const prefill = searchParams.get("email");
    if (prefill) setResendEmail(prefill);
  }, [searchParams]);

  /* Spend the link's one-time token only when a person presses the button.
   * Microsoft 365 and other corporate mail filters open every link in a
   * headless browser that runs our JavaScript. When this page verified on
   * load, the scanner used the token up before the email was even delivered,
   * so customers on business domains got "link no longer valid" on every
   * fresh link, in every browser. Scanners load pages; they don't press
   * buttons. */
  const handleConfirmLink = async () => {
    if (!tokenHash) return;
    setChecking(true);
    const { data, error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
    setChecking(false);
    if (error || !data.session) {
      setProblem(error?.message || "This reset link is no longer valid.");
      setPhase("invalid");
      return;
    }
    window.history.replaceState({}, "", "/reset-password");
    setPhase("ready");
  };

  // The 6-digit code in the email is the scanner-proof path: nothing can use
  // it up except the person typing it.
  const handleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const addr = resendEmail.trim();
    const token = code.replace(/\s+/g, "");
    if (!addr || !token) {
      toast.error("Enter your email and the code from the email.");
      return;
    }
    setChecking(true);
    const { data, error } = await supabase.auth.verifyOtp({ type: "recovery", email: addr, token });
    setChecking(false);
    if (error || !data.session) {
      toast.error(/banned/i.test(error?.message ?? "")
        ? error!.message
        : "That code didn't work. Check it matches your most recent email, or send yourself a new one.");
      if (/banned/i.test(error?.message ?? "")) { setProblem(error!.message); setPhase("invalid"); }
      return;
    }
    window.history.replaceState({}, "", "/reset-password");
    setPhase("ready");
  };

  useEffect(() => {
    let cancelled = false;

    const url = new URL(window.location.href);
    const linkToken = url.searchParams.get("token_hash");
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

    if (linkToken) {
      setTokenHash(linkToken);
      setPhase("confirm");
      return;
    }

    // Arrived from the "enter your code" link in the email (no token in it).
    if (url.searchParams.get("code") === "1") {
      setPhase("code");
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
      // The recovery session can lapse between landing here and submitting.
      // Drop into the resend path rather than leaving a dead form on screen.
      if (/session|expired|jwt|token/i.test(error.message)) {
        setProblem("Your reset link expired before the password was saved.");
        setPhase("invalid");
      }
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success("Password updated! Redirecting…");
      setTimeout(() => navigate("/dashboard"), 1200);
    }
  };

  const codeForm = (
    <form onSubmit={handleCode} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code-email">Your email</Label>
        <Input
          id="code-email"
          type="email"
          autoComplete="email"
          value={resendEmail}
          onChange={(e) => setResendEmail(e.target.value)}
          required
          disabled={checking}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="reset-code">Code from the email</Label>
        <Input
          id="reset-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          disabled={checking}
        />
      </div>
      <Button type="submit" className="w-full bg-gradient-to-r from-accent to-primary" disabled={checking}>
        {checking ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking…</>) : "Continue"}
      </Button>
    </form>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center mb-4">
            <Logo size="lg" />
          </div>
          <p className="text-muted-foreground">
            {phase !== "invalid"
              ? "Set a new password"
              : membershipEnded ? "Your membership has ended" : "Let's get you back in"}
          </p>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle>Reset password</CardTitle>
            <CardDescription>
              {phase === "ready"
                ? "Enter a new password for your account."
                : phase === "verifying"
                  ? "Checking your reset link…"
                  : phase === "confirm"
                    ? "Press the button to choose your new password."
                    : phase === "code"
                      ? "Enter your email and the 6-digit code from your reset email."
                      : membershipEnded
                    ? "Your NextMIC membership has ended, so sign-in is switched off for this account. A new password won't reopen it — restarting your membership will, and everything you bought outright is still here waiting."
                    : resent
                      ? "We've sent a new link. Open it as soon as it arrives — for your security it's only good for about an hour."
                      : `${problem} If you have the 6-digit code from your reset email, enter it below. Otherwise we'll send you a fresh one.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {phase === "invalid" ? (
              membershipEnded ? (
                <div className="space-y-4">
                  <Button
                    className="w-full bg-gradient-to-r from-accent to-primary"
                    onClick={() => { window.location.href = "https://launch.nextmic.ai"; }}
                  >
                    Restart my membership
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Think this is a mistake, or already restarted and still locked out? Email{" "}
                    <a className="underline" href="mailto:support@nextmic.ai">support@nextmic.ai</a>{" "}
                    and we'll sort it out the same day.
                  </p>
                </div>
              ) : resent ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Nothing after a few minutes? Check your spam folder for a message from{" "}
                    <span className="font-medium">receipts@nextmic.ai</span>, or email{" "}
                    <a className="underline" href="mailto:support@nextmic.ai">support@nextmic.ai</a>{" "}
                    and we'll get you in.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => setResent(false)}>
                    Send it again
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                {codeForm}
                <div className="border-t pt-6">
                <form onSubmit={handleResend} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="resend-email">Your email</Label>
                    <Input
                      id="resend-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      required
                      disabled={resending}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use the address you bought with.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-accent to-primary"
                    disabled={resending}
                  >
                    {resending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Sending…
                      </>
                    ) : "Send me a new link"}
                  </Button>
                </form>
                </div>
                </div>
              )
            ) : phase === "confirm" ? (
              <Button
                className="w-full bg-gradient-to-r from-accent to-primary"
                onClick={handleConfirmLink}
                disabled={checking}
              >
                {checking ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking…</>) : "Set my password"}
              </Button>
            ) : phase === "code" ? (
              codeForm
            ) : phase === "verifying" ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Verifying reset link…
              </div>
            ) : (
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
            )}
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
