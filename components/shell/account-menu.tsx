"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings as SettingsIcon, User, LogIn } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";

export function AccountMenu() {
  const { email, signOut, configured } = useAuth();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const initial = (email?.[0] || "").toUpperCase();

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Account"
        className="grid h-9 w-9 place-items-center rounded-full bg-navy-900 text-sm font-semibold text-white">
        {email ? initial : <User className="h-4 w-4" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border bg-surface p-2 shadow-lift">
            <div className="px-3 py-2 text-xs text-muted">
              {email ? <>Signed in as<br /><span className="font-medium text-ink">{email}</span></> : "Using Synapse on this device"}
            </div>
            <div className="my-1 h-px bg-line" />
            <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface-2"><SettingsIcon className="h-4 w-4 text-muted" /> Settings</Link>
            {email ? (
              <button onClick={async () => { await signOut(); setOpen(false); router.replace("/"); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface-2"><LogOut className="h-4 w-4 text-muted" /> Sign out</button>
            ) : (
              <Link href="/login" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink hover:bg-surface-2"><LogIn className="h-4 w-4 text-muted" /> {configured ? "Sign in" : "Account"}</Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
