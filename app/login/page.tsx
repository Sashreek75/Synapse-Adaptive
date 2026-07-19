"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { SynapseOrb } from "@/components/synapse/orb";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "reset";

interface AuthStatus {
  configured: boolean;
  reachable: boolean;
  emailEnabled?: boolean;
  googleEnabled?: boolean;
  signupDisabled?: boolean;
  autoconfirm?: boolean;
}

export default function LoginPage() {
  const router = useRouter();
  const { configured, email: signedIn, signInWithGoogle, signInEmail, signUpEmail, resendConfirmation, sendReset, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [status, setStatus] = useState<AuthStatus | null>(null);

  // Auth doctor — ask the server what this Supabase project actually allows,
  // so failures are explained instead of silent.
  useEffect(() => {
    if (!configured) return;
    fetch("/api/auth-status").then((r) => r.json()).then(setStatus).catch(() => {});
  }, [configured]);

  const warnings: string[] = [];
  if (status?.configured && status.reachable === false) {
    warnings.push("Your Supabase project couldn't be reached with the keys in .env.local — double-check the project URL and anon key, and that the project isn't paused (free-tier projects pause after a week of inactivity).");
  }
  if (status?.reachable) {
    if (mode === "signup" && status.signupDisabled) warnings.push("This Supabase project has new sign-ups disabled. Enable them in Supabase → Authentication → Sign In / Up → “Allow new users to sign up”.");
    if (status.emailEnabled === false) warnings.push("Email/password sign-in is disabled in Supabase → Authentication → Providers → Email.");
    if (status.googleEnabled === false) warnings.push("Google sign-in isn't enabled in Supabase → Authentication → Providers → Google (add your OAuth Client ID + secret). Also add this app's URL to Authentication → URL Configuration → Redirect URLs.");
    if (mode === "signup" && status.autoconfirm === false) warnings.push("Email confirmations are ON, and Supabase's built-in mailer sends only ~2 emails/hour. For development, consider Supabase → Authentication → Sign In / Up → turning off “Confirm email”, or configure custom SMTP.");
  }

  async function submit() {
    setMsg(null); setNeedsConfirm(false); setBusy(true);
    try {
      if (mode === "reset") {
        const r = await sendReset(email);
        setMsg(r.error ? { kind: "error", text: r.error } : { kind: "info", text: r.info ?? "" });
      } else if (mode === "signup") {
        const r = await signUpEmail(email, password);
        if (r.error) { setMsg({ kind: "error", text: r.error }); setNeedsConfirm(!!r.needsConfirmation); }
        else if (r.info) { setMsg({ kind: "info", text: r.info }); setNeedsConfirm(!!r.needsConfirmation); }
        else router.push("/dashboard");
      } else {
        const r = await signInEmail(email, password);
        if (r.error) { setMsg({ kind: "error", text: r.error }); setNeedsConfirm(!!r.needsConfirmation); }
        else router.push("/dashboard");
      }
    } finally { setBusy(false); }
  }

  async function google() {
    setMsg(null); setBusy(true);
    try {
      const r = await signInWithGoogle();
      // On success the browser redirects — reaching here with an error means it didn't.
      if (r.error) setMsg({ kind: "error", text: r.error });
    } finally { setBusy(false); }
  }

  async function resend() {
    setBusy(true);
    try {
      const r = await resendConfirmation(email);
      setMsg(r.error ? { kind: "error", text: r.error } : { kind: "info", text: r.info ?? "" });
    } finally { setBusy(false); }
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-5">
      <AnimatedBackground variant="hero" />
      <div className="w-full max-w-md rounded-3xl border bg-surface/80 p-8 shadow-lift glass sa-rise">
        <div className="text-center">
          <div className="mx-auto w-fit"><SynapseOrb size={48} /></div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">
            {mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted">Your adaptive AI partner — with you anywhere you sign in.</p>
        </div>

        {signedIn ? (
          <div className="mt-6 text-center">
            <p className="text-sm text-muted">Signed in as <span className="font-medium text-ink">{signedIn}</span></p>
            <Button className="mt-3 w-full" onClick={() => router.push("/dashboard")}>Continue <ArrowRight className="h-4 w-4" /></Button>
            <button onClick={signOut} className="mt-3 w-full text-sm text-muted hover:text-ink">Sign out / use a different account</button>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {warnings.length > 0 && (
              <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-500/25 dark:bg-orange-500/10">
                {warnings.map((wr) => (
                  <p key={wr} className="flex items-start gap-2 text-xs leading-relaxed text-orange-800 dark:text-orange-200">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {wr}
                  </p>
                ))}
              </div>
            )}

            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email"
              className="w-full rounded-xl border bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400" />
            {mode !== "reset" && (
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="Password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full rounded-xl border bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400" />
            )}
            {mode === "signup" && password.length > 0 && password.length < 6 && (
              <p className="text-xs text-muted">Passwords need at least 6 characters.</p>
            )}
            {msg && <p className={cn("rounded-xl px-3 py-2 text-sm", msg.kind === "error" ? "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300")}>{msg.text}</p>}
            {needsConfirm && (
              <button onClick={resend} disabled={busy || !email} className="w-full text-sm text-navy-500 hover:underline disabled:opacity-50">
                Resend the confirmation email
              </button>
            )}

            <Button className="w-full" onClick={submit} disabled={busy || !email || (mode !== "reset" && !password)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
            </Button>

            {mode !== "reset" && configured && status?.googleEnabled !== false && (
              <>
                <div className="flex items-center gap-3 py-1 text-xs text-muted"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
                <Button variant="outline" className="w-full" onClick={google} disabled={busy}>Continue with Google</Button>
              </>
            )}

            <div className="flex items-center justify-between pt-1 text-sm">
              {mode === "signin" ? (
                <>
                  <button className="text-navy-500 hover:underline" onClick={() => { setMode("signup"); setMsg(null); setNeedsConfirm(false); }}>Create account</button>
                  <button className="text-muted hover:underline" onClick={() => { setMode("reset"); setMsg(null); setNeedsConfirm(false); }}>Forgot password?</button>
                </>
              ) : (
                <button className="text-navy-500 hover:underline" onClick={() => { setMode("signin"); setMsg(null); setNeedsConfirm(false); }}>← Back to sign in</button>
              )}
            </div>

            {!configured && (
              <p className="text-xs text-muted">Accounts aren&apos;t configured yet (add Supabase keys). You can still <button className="text-navy-500 underline" onClick={() => router.push("/onboarding")}>continue on this device</button>.</p>
            )}
          </div>
        )}
        <p className="mt-6 text-center text-[11px] text-muted">General wellness &amp; education — never diagnosis or treatment.</p>
      </div>
    </div>
  );
}
