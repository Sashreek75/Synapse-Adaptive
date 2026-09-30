"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase/client";
import { flags } from "@/env";

type Result = { error?: string; info?: string; needsConfirmation?: boolean };

interface AuthState {
  ready: boolean;
  configured: boolean;
  email: string | null;
  signInWithGoogle: () => Promise<Result>;
  signUpEmail: (email: string, password: string) => Promise<Result>;
  signInEmail: (email: string, password: string) => Promise<Result>;
  resendConfirmation: (email: string) => Promise<Result>;
  sendReset: (email: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const notConfigured: Result = { error: "Sign-in isn't configured yet. Add your Supabase keys to .env.local (see SETUP)." };

/** Translate raw Supabase errors into calm, actionable messages. */
function friendly(message: string): Result {
  const m = message.toLowerCase();
  if (m.includes("provider is not enabled") || m.includes("unsupported provider")) {
    return { error: "Google sign-in isn't enabled for this project yet — in Supabase, open Authentication → Providers → Google and enable it with your OAuth credentials." };
  }
  if (m.includes("email not confirmed")) {
    return { error: "This email hasn't been confirmed yet. Check your inbox (and spam) for the confirmation link.", needsConfirmation: true };
  }
  if (m.includes("invalid login credentials")) {
    return { error: "That email/password combination didn't match. If you signed up with Google, use “Continue with Google” instead." };
  }
  if (m.includes("signups not allowed") || m.includes("signup is disabled") || m.includes("signups are disabled")) {
    return { error: "New sign-ups are currently disabled for this project — in Supabase, open Authentication → Sign In / Up and allow new users to sign up." };
  }
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("for security purposes")) {
    return { error: "Supabase's built-in mailer is rate-limited (a couple of emails per hour). Wait a bit and try again, or configure custom SMTP in Supabase for development." };
  }
  if (m.includes("is invalid") && m.includes("email")) {
    return { error: "Supabase rejected this email address. Some projects block certain domains — check Authentication → Sign In / Up restrictions, or try another address." };
  }
  return { error: message };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) { setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setEmail(data.session?.user?.email ?? null); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setEmail(session?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle(): Promise<Result> {
    const supabase = getSupabase();
    if (!supabase) return notConfigured;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    return error ? friendly(error.message) : {};
  }
  async function signUpEmail(em: string, password: string): Promise<Result> {
    const supabase = getSupabase();
    if (!supabase) return notConfigured;
    const { data, error } = await supabase.auth.signUp({ email: em, password, options: { emailRedirectTo: `${window.location.origin}/login` } });
    if (error) return friendly(error.message);
    // Supabase quirk: signing up an EXISTING confirmed email returns a fake
    // user with an empty identities array instead of an error.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return { error: "An account with this email already exists — try signing in instead, or reset your password." };
    }
    if (data.user && !data.session) return { info: "Almost there — check your email for the confirmation link, then sign in.", needsConfirmation: true };
    return {};
  }
  async function signInEmail(em: string, password: string): Promise<Result> {
    const supabase = getSupabase();
    if (!supabase) return notConfigured;
    const { error } = await supabase.auth.signInWithPassword({ email: em, password });
    return error ? friendly(error.message) : {};
  }
  async function resendConfirmation(em: string): Promise<Result> {
    const supabase = getSupabase();
    if (!supabase) return notConfigured;
    const { error } = await supabase.auth.resend({ type: "signup", email: em, options: { emailRedirectTo: `${window.location.origin}/login` } });
    return error ? friendly(error.message) : { info: "Confirmation email re-sent — give it a minute and check spam too." };
  }
  async function sendReset(em: string): Promise<Result> {
    const supabase = getSupabase();
    if (!supabase) return notConfigured;
    const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: `${window.location.origin}/update-password` });
    return error ? friendly(error.message) : { info: "If that email exists, a reset link is on its way." };
  }
  async function updatePassword(password: string): Promise<Result> {
    const supabase = getSupabase();
    if (!supabase) return notConfigured;
    const { error } = await supabase.auth.updateUser({ password });
    return error ? friendly(error.message) : { info: "Password updated — you're all set." };
  }
  async function signOut() {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
    setEmail(null);
  }

  return (
    <AuthContext.Provider value={{ ready, configured: flags.authLive, email, signInWithGoogle, signUpEmail, signInEmail, resendConfirmation, sendReset, updatePassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
