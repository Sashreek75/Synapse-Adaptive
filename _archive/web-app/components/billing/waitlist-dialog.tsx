"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { SynapseOrb } from "@/components/synapse/orb";
import { Button } from "@/components/ui/primitives";
import { PLANS } from "@/lib/billing/plans";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Upgrade waitlist dialog — shown instead of Stripe checkout while billing
 * isn't live. Synapse's voice, one email field, never a dead end.
 */
export function WaitlistDialog({
  plan,
  open,
  onClose,
  defaultEmail,
}: {
  plan: "pro" | "max";
  open: boolean;
  onClose: () => void;
  defaultEmail?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  // Fresh state each time the dialog opens; prefill signed-in email.
  useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? "");
      setStatus("idle");
      setError(null);
    }
  }, [open, defaultEmail]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const planName = PLANS[plan].name;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending" || status === "done") return; // no double-submit
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError("That email doesn't look quite right — mind checking it?");
      return;
    }
    setError(null);
    setStatus("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value, plan }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setStatus("done");
      } else {
        setStatus("idle");
        setError("Couldn't reach the list — try again in a moment.");
      }
    } catch {
      setStatus("idle");
      setError("Couldn't reach the list — try again in a moment.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${planName} waitlist`}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border bg-surface p-6 shadow-soft sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3.5 top-3.5 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <SynapseOrb size={48} state={status === "sending" ? "thinking" : "idle"} />

          {status === "done" ? (
            <>
              <h2 className="mt-4 text-lg font-semibold text-ink">You&apos;re on the list</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                You&apos;re on the list — I&apos;ll let you know the moment it opens.
              </p>
              <Button variant="outline" className="mt-5 w-full" onClick={onClose}>
                Back to my plans
              </Button>
            </>
          ) : (
            <>
              <h2 className="mt-4 text-lg font-semibold text-ink">{planName} is almost ready</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Payments open soon — leave your email and you&apos;ll be first in, at launch pricing.
              </p>
              <form onSubmit={submit} className="mt-5 w-full space-y-3" noValidate>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="you@example.com"
                  autoFocus
                  className="w-full rounded-xl border bg-surface-2 px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-orange-400"
                  aria-invalid={!!error}
                />
                {error && <p className="text-left text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
                <Button type="submit" className="w-full" disabled={status === "sending"}>
                  {status === "sending" ? "Adding you…" : "Join the waitlist"}
                </Button>
              </form>
              <p className="mt-3 text-xs text-muted">No spam — one email when {planName} opens, that&apos;s it.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
