"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { AnimatedBackground } from "@/components/ui/animated-background";
import { useAuth } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setMsg(null);
    const r = await updatePassword(password);
    setBusy(false);
    if (r.error) setMsg({ kind: "error", text: r.error });
    else { setMsg({ kind: "info", text: r.info ?? "Updated." }); setTimeout(() => router.push("/dashboard"), 1200); }
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-5">
      <AnimatedBackground variant="hero" />
      <div className="w-full max-w-md rounded-3xl border bg-surface/80 p-8 text-center shadow-lift glass sa-rise">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-navy-900 text-white"><Brain className="h-6 w-6" /></span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-ink">Set a new password</h1>
        <p className="mt-2 text-sm text-muted">You followed a reset link — choose a new password below.</p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="New password"
          className="mt-6 w-full rounded-xl border bg-surface px-4 py-3 text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400" />
        {msg && <p className={cn("mt-3 rounded-xl px-3 py-2 text-sm", msg.kind === "error" ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700")}>{msg.text}</p>}
        <Button className="mt-4 w-full" onClick={submit} disabled={busy || password.length < 6}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}</Button>
      </div>
    </div>
  );
}
