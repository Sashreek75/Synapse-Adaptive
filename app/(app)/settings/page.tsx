"use client";

import Link from "next/link";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, Bell, User, ShieldCheck, LogIn, LogOut, Sparkles } from "lucide-react";
import { Card, CardBody, SectionLabel, Button } from "@/components/ui/primitives";
import { useHealth } from "@/components/providers/health-store";
import { useAuth } from "@/components/providers/auth-provider";

export default function SettingsPage() {
  const { profile, checkIns, reset, resetTour } = useHealth();
  const { configured, email, signInWithGoogle, signOut } = useAuth();
  const router = useRouter();
  const [notifs, setNotifs] = useState({ weekly: true, milestones: true, nudges: false });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.replace("/"); // back to the landing page — no lingering on the dashboard
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ profile, checkIns, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "synapse-adaptive-data.json"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>

      <Card className="sa-rise"><CardBody>
        <SectionLabel className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Account</SectionLabel>
        {email ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">Signed in as <span className="font-medium text-ink">{email}</span></p>
            <Button variant="outline" size="sm" onClick={handleSignOut} disabled={signingOut}><LogOut className="h-4 w-4" /> {signingOut ? "Signing out…" : "Sign out"}</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">{configured ? "Not signed in — your data is on this device." : "Running on this device. Connect Supabase to enable Google sign-in (see SETUP)."}</p>
            {configured && <Button size="sm" onClick={signInWithGoogle}><LogIn className="h-4 w-4" /> Sign in with Google</Button>}
          </div>
        )}
      </CardBody></Card>

      <Card className="sa-rise-2"><CardBody>
        <SectionLabel className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Your profile</SectionLabel>
        {profile.onboardedAt ? (
          <dl className="space-y-2 text-sm">
            <Row label="Name" value={profile.displayName || "—"} />
            <Row label="Recovery" value={profile.conditionLabel || "—"} />
            <Row label="Stage" value={profile.recoveryStage} />
            <Row label="Goals" value={profile.goals.join(", ") || "—"} />
          </dl>
        ) : (
          <p className="text-muted">You haven&apos;t set up your profile yet.</p>
        )}
        <div className="mt-4">
          <Link href="/onboarding"><Button variant="outline" size="sm">{profile.onboardedAt ? "Edit my profile" : "Set up my profile"}</Button></Link>
        </div>
      </CardBody></Card>

      <Card className="sa-rise-2"><CardBody>
        <SectionLabel className="flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" /> Notifications</SectionLabel>
        <p className="mb-4 text-sm text-muted">Calm reminders only — never anxiety-inducing alerts.</p>
        <Toggle label="Weekly review is ready" desc="A gentle nudge when your weekly review is ready." on={notifs.weekly} onClick={() => setNotifs((n) => ({ ...n, weekly: !n.weekly }))} />
        <Toggle label="Milestones" desc="Quiet celebration when you reach one." on={notifs.milestones} onClick={() => setNotifs((n) => ({ ...n, milestones: !n.milestones }))} />
        <Toggle label="Encouragement nudges" desc="Occasional notes that consistency sharpens your insights." on={notifs.nudges} onClick={() => setNotifs((n) => ({ ...n, nudges: !n.nudges }))} />
      </CardBody></Card>

      <Card className="sa-rise-3"><CardBody>
        <SectionLabel className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Guidance</SectionLabel>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted">New here, or want a refresher? Replay the quick Synapse tour.</p>
          <Button variant="outline" size="sm" onClick={resetTour}>Replay tour</Button>
        </div>
      </CardBody></Card>

      <Card className="sa-rise-3"><CardBody>
        <SectionLabel className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Privacy &amp; your data</SectionLabel>
        <p className="mb-4 text-sm text-muted">Your data is yours. Export it any time, or delete everything.</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportData}><Download className="h-4 w-4" /> Export my data</Button>
          {!confirmDelete ? (
            <Button variant="outline" onClick={() => setConfirmDelete(true)} className="text-orange-600"><Trash2 className="h-4 w-4" /> Delete my data</Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Are you sure?</span>
              <Button onClick={() => { reset(); setConfirmDelete(false); }} className="bg-orange-600">Yes, delete</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          )}
        </div>
      </CardBody></Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (<div className="flex justify-between border-b py-2 last:border-0"><dt className="text-muted">{label}</dt><dd className="font-medium text-ink">{value}</dd></div>);
}
function Toggle({ label, desc, on, onClick }: { label: string; desc: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between border-b py-3 last:border-0">
      <div><p className="font-medium text-ink">{label}</p><p className="text-sm text-muted">{desc}</p></div>
      <button onClick={onClick} role="switch" aria-checked={on} aria-label={label}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-orange-500" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}
