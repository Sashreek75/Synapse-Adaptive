"use client";

/**
 * FOUNDER ADMIN — a private overview of the whole user base, behind a password.
 *
 * The password is verified server-side by /api/admin/stats (which also does the cross-user
 * aggregation with the Supabase service role, since RLS blocks the browser from reading other
 * users' rows). This page just gates the UI, allows 5 attempts, and renders what the server returns.
 */

import { useState } from "react";
import { Lock, ShieldCheck, Users, UserCheck, Activity, MessageCircle, CalendarCheck, LayoutGrid, Compass, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { SynapseOrb } from "@/components/synapse/orb";

const MAX_TRIES = 5;

interface Totals {
  accounts: number; withData: number; onboarded: number; active7: number; active30: number;
  totalCheckIns: number; avgCheckIns: number; totalChat: number; totalSpaces: number; withAspiration: number; authListable: boolean;
}
interface AdminUser { id: string; name: string; email: string; onboardedAt: string | null; checkIns: number; chat: number; aspiration: string; lastActive: string | null; joined: string | null; }
interface Stats { ok: boolean; configured: boolean; generatedAt?: string; totals?: Totals; focusAreas?: [string, number][]; users?: AdminUser[]; }

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Stats | null>(null);

  const remaining = MAX_TRIES - attempts;

  async function unlock() {
    if (locked || loading || !password.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/stats", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.status === 401) {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= MAX_TRIES) { setLocked(true); setError("Too many attempts. Reload the page to try again."); }
        else setError(`Incorrect password. ${MAX_TRIES - next} ${MAX_TRIES - next === 1 ? "try" : "tries"} left.`);
        setPassword("");
        return;
      }
      if (!res.ok) { setError("Something went wrong reaching the server."); return; }
      setData((await res.json()) as Stats);
    } catch {
      setError("Couldn't reach the server.");
    } finally { setLoading(false); }
  }

  async function refresh() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/stats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      if (res.ok) setData((await res.json()) as Stats);
    } catch {} finally { setLoading(false); }
  }

  /* ── Locked / password gate ─────────────────────────────────────────── */
  if (!data) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col items-center justify-center px-5 text-center">
        <SynapseOrb size={64} />
        <h1 className="mt-5 flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
          <Lock className="h-5 w-5 text-orange-500" /> Founder access
        </h1>
        <p className="mt-2 text-sm text-muted">This area is private. Enter the password to see how Synapse is doing.</p>

        <div className="mt-6 w-full rounded-2xl border bg-surface p-5 shadow-soft">
          <input
            type="password"
            autoFocus
            value={password}
            disabled={locked}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && unlock()}
            placeholder="Password"
            className="w-full rounded-xl border bg-surface px-4 py-3 text-center text-ink placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 disabled:opacity-50"
          />
          <Button onClick={unlock} disabled={locked || loading || !password.trim()} className="mt-3 w-full justify-center">
            {loading ? "Checking…" : "Unlock"} <ShieldCheck className="h-4 w-4" />
          </Button>
          {error && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4" /> {error}
            </p>
          )}
          {!error && !locked && attempts === 0 && <p className="mt-3 text-xs text-muted">{MAX_TRIES} attempts allowed.</p>}
          {!locked && attempts > 0 && !error && <p className="mt-3 text-xs text-muted">{remaining} {remaining === 1 ? "try" : "tries"} left.</p>}
        </div>

        <a href="/dashboard" className="mt-6 text-xs text-muted hover:text-ink">← Back to Synapse</a>
      </div>
    );
  }

  /* ── Not configured (no Supabase in this env) ───────────────────────── */
  if (!data.configured) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center">
        <SynapseOrb size={56} className="mx-auto" />
        <h1 className="mt-4 text-xl font-semibold text-ink">No cross-user data yet</h1>
        <p className="mt-2 text-sm text-muted">Supabase isn&apos;t configured in this environment, so there are no accounts to report on. Once the app is connected to your Supabase project, this page will fill in automatically.</p>
      </div>
    );
  }

  const t = data.totals!;
  const users = data.users ?? [];
  const areas = data.focusAreas ?? [];
  const maxArea = areas.length ? areas[0][1] : 1;
  const onboardPct = t.withData ? Math.round((t.onboarded / t.withData) * 100) : 0;
  const activePct = t.withData ? Math.round((t.active7 / t.withData) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SynapseOrb size={40} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Founder dashboard</h1>
            <p className="text-sm text-muted">How Synapse is doing across everyone using it.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Refresh</Button>
      </header>

      {/* KPIs */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi icon={Users} label="Total accounts" value={t.accounts} tone="navy" />
        <Kpi icon={UserCheck} label="Completed onboarding" value={t.onboarded} suffix={`· ${onboardPct}%`} tone="orange" />
        <Kpi icon={Activity} label="Active this week" value={t.active7} suffix={`· ${activePct}%`} tone="orange" />
        <Kpi icon={Activity} label="Active this month" value={t.active30} tone="navy" />
        <Kpi icon={CalendarCheck} label="Check-ins (total)" value={t.totalCheckIns} tone="navy" />
        <Kpi icon={CalendarCheck} label="Avg check-ins / user" value={t.avgCheckIns} tone="orange" />
        <Kpi icon={MessageCircle} label="Chat messages" value={t.totalChat} tone="navy" />
        <Kpi icon={Compass} label="Have an aspiration set" value={t.withAspiration} tone="orange" />
        <Kpi icon={LayoutGrid} label="Spaces built" value={t.totalSpaces} tone="navy" />
      </div>

      {/* Focus areas */}
      {areas.length > 0 && (
        <section className="mt-8 rounded-2xl border bg-surface p-5 shadow-soft">
          <h2 className="text-sm font-semibold text-ink">What people are working on</h2>
          <div className="mt-4 space-y-2.5">
            {areas.map(([label, n]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-44 shrink-0 truncate text-sm text-muted">{label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.max(4, (n / maxArea) * 100)}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-medium text-ink">{n}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Users table */}
      <section className="mt-8 overflow-hidden rounded-2xl border bg-surface shadow-soft">
        <div className="flex items-center justify-between border-b bg-surface-2 px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">Everyone ({users.length})</h2>
          {!t.authListable && <span className="text-[11px] text-muted">Emails need the auth admin API enabled</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Working toward</th>
                <th className="px-4 py-2.5 text-right">Check-ins</th>
                <th className="px-4 py-2.5 text-right">Chats</th>
                <th className="px-4 py-2.5">Joined</th>
                <th className="px-4 py-2.5">Last active</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 font-medium text-ink">{u.name}{!u.onboardedAt && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">setup incomplete</span>}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{u.email}</td>
                  <td className="max-w-[16rem] truncate px-4 py-2.5 text-muted" title={u.aspiration}>{u.aspiration || "—"}</td>
                  <td className="px-4 py-2.5 text-right text-ink">{u.checkIns}</td>
                  <td className="px-4 py-2.5 text-right text-ink">{u.chat}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDate(u.joined)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDate(u.lastActive)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted">No users with data yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Note: this reflects the cloud-synced record (profile, check-ins, chat, aspirations, spaces). Goals and
        commitments currently live on each user&apos;s device and aren&apos;t synced, so they aren&apos;t
        counted here yet — say the word and I&apos;ll add them to the sync so they show up too.
        {data.generatedAt && <> · Generated {new Date(data.generatedAt).toLocaleString()}.</>}
      </p>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, suffix, tone }: { icon: typeof Users; label: string; value: number | string; suffix?: string; tone: "orange" | "navy" }) {
  return (
    <div className="rounded-2xl border bg-surface p-4 shadow-soft">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${tone === "orange" ? "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300" : "bg-navy-100 text-navy-600 dark:bg-navy-500/15 dark:text-navy-300"}`}>
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-2.5 text-2xl font-semibold tracking-tight text-ink">{value} {suffix && <span className="text-xs font-normal text-muted">{suffix}</span>}</p>
      <p className="text-[12px] text-muted">{label}</p>
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
}
