"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, MetricKey, MetricSeries, ProviderQuestion, RecentChange, Mind, Evidence, SignalId } from "@/types";
import { signalMeta, mergeSeries, seriesFromEvidence } from "@/lib/signals";
import { computeTrend } from "@/lib/stats";
import { getSupabase } from "@/lib/supabase/client";
import { loadCloud, saveCloud } from "@/lib/supabase/sync";
import type { ExperimentRecord } from "@/lib/focus";
import type { Space } from "@/lib/spaces";

/**
 * The real data layer — no fake data. Everything is the user's own onboarding,
 * weekly assessments, and daily micro check-ins, stored privately on-device
 * (localStorage). When Supabase is connected, this same shape syncs to the cloud.
 */
export interface Profile {
  displayName: string;
  path: string;            // PathId from lib/paths
  pathLabel: string;
  conditionCategory: string;
  conditionLabel: string;
  conditionDetail: string;
  recoveryStage: "acute" | "subacute" | "maintenance";
  timeSinceOnset: string;
  goals: string[];
  definitionOfBetter: string;
  primaryChallenge: string;
  nextAppointment: string;
  ageRange: string;
  occupation: string;
  activityLevel: string;
  focusAreas: string[];
  concerns: string;
  successDefinition: string;
  aiPreferences: string[];
  lifestyle: Record<string, string>;
  selfAssessment: Record<string, number>;
  aiSummary: string;            // AI-written Health Profile narrative (the baseline)
  onboardedAt: string | null;
}

export type CheckInKind = "baseline" | "weekly" | "daily";

export interface ContextNote { id: string; date: string; prompt: string; answer: string; }

/** A dated snapshot of how Synapse understands the user — so the profile can EVOLVE. */
export interface UnderstandingSnapshot { id: string; date: string; focus: string[]; leadMetric?: SignalId; read: string; }

/** A recommendation Synapse made, so it can reference and follow up on it later. */
export interface RecommendationRecord { id: string; title: string; date: string; }

export interface CheckIn {
  id: string;
  date: string;                 // ISO
  kind: CheckInKind;
  metrics: Partial<Record<MetricKey, number>>; // normalized 0..100
  note?: string;
}

const DEFAULT_PROFILE: Profile = {
  displayName: "", path: "general", pathLabel: "", conditionCategory: "", conditionLabel: "", conditionDetail: "",
  recoveryStage: "subacute", timeSinceOnset: "", goals: [], definitionOfBetter: "",
  primaryChallenge: "", nextAppointment: "", ageRange: "", occupation: "", activityLevel: "",
  focusAreas: [], concerns: "", successDefinition: "", aiPreferences: [], lifestyle: {}, selfAssessment: {},
  aiSummary: "", onboardedAt: null,
};

// Legacy storage key from the Recovery-era branding. Do NOT change the string —
// existing users' on-device data lives under it.
const KEY = "synapse.recovery.v3";
const DEFAULT_MIND: Mind = { beliefs: [], conclusions: [], openQuestions: [], weekly: {}, playbook: [], hypotheses: [], associationHistory: [], habits: [], trajectory: null, evidence: [] };
const dayKey = (iso: string) => iso.slice(0, 10);
const todayKey = () => new Date().toISOString().slice(0, 10);

interface Store {
  hydrated: boolean;
  profile: Profile;
  checkIns: CheckIn[];
  providerQuestions: ProviderQuestion[];
  chat: ChatMessage[];
  series: MetricSeries[];
  recentChanges: RecentChange[];
  hasData: boolean;
  weeksTracked: number;
  dailyDoneToday: boolean;
  consistency: number;          // 0..1 over last 7 days
  weeklyScore: number;          // 0..100 progress/consistency (NOT medical)
  focusAreas: string[];
  lifestyleSummary: string;
  saveProfile: (p: Partial<Profile>) => void;
  addCheckIn: (c: Omit<CheckIn, "id" | "kind"> & { kind?: CheckInKind }) => void;
  addProviderQuestion: (text: string, source?: ProviderQuestion["source"]) => void;
  setQuestionStatus: (id: string, status: ProviderQuestion["status"]) => void;
  setChat: (msgs: ChatMessage[]) => void;
  contextNotes: ContextNote[];
  lastFocusAreas: string[];
  addContextNote: (prompt: string, answer: string) => void;
  setLastFocus: (areas: string[]) => void;
  understandingLog: UnderstandingSnapshot[];
  recordUnderstanding: (snap: { focus: string[]; leadMetric?: SignalId; read: string }) => void;
  /** Past recommendations Synapse has made — so it can follow up on them. */
  recommendationLog: RecommendationRecord[];
  recordRecommendation: (rec: { id: string; title: string }) => void;
  /** Persisted experiments — synced to the account so the loop follows the user. */
  experiments: ExperimentRecord[];
  saveExperiments: (xs: ExperimentRecord[]) => void;
  /** User-created folders ("Spaces") for organizing their information. */
  spaces: Space[];
  saveSpaces: (xs: Space[]) => void;
  /** Synapse's evolving world-model of the user (beliefs, conclusions, weekly reasoning). */
  mind: Mind;
  saveMind: (m: Mind) => void;
  tourDone: boolean;
  completeTour: () => void;
  resetTour: () => void;
  reset: () => void;
}

const HealthContext = createContext<Store | null>(null);

/** The persisted snapshot shape (localStorage + cloud). */
interface Snapshot {
  profile?: Partial<Profile>;
  checkIns?: CheckIn[];
  providerQuestions?: ProviderQuestion[];
  chat?: ChatMessage[];
  tourDone?: boolean;
  contextNotes?: ContextNote[];
  lastFocusAreas?: string[];
  understandingLog?: UnderstandingSnapshot[];
  recommendationLog?: RecommendationRecord[];
  experiments?: ExperimentRecord[];
  spaces?: Space[];
  mind?: Mind;
  updatedAt?: string;
}

function deriveSeries(checkIns: CheckIn[]): MetricSeries[] {
  const byMetric = new Map<MetricKey, MetricSeries>();
  const ordered = [...checkIns].sort((a, b) => a.date.localeCompare(b.date));
  for (const c of ordered) {
    for (const [m, v] of Object.entries(c.metrics) as [MetricKey, number][]) {
      if (v == null) continue;
      if (!byMetric.has(m)) byMetric.set(m, { metric: m, points: [] });
      byMetric.get(m)!.points.push({ metric: m, valueNorm: v, recordedAt: c.date });
    }
  }
  return [...byMetric.values()];
}

function deriveRecentChanges(series: MetricSeries[]): RecentChange[] {
  const out: RecentChange[] = [];
  for (const s of series) {
    if (s.points.length < 2) continue;
    const t = computeTrend(s);
    const meta = signalMeta(s.metric);
    const improving = meta.direction === "higher_is_better" ? t.delta > 0 : t.delta < 0;
    if (Math.abs(t.delta) < 2) continue;
    out.push({
      metric: s.metric, label: meta.label, deltaNorm: Math.round(t.delta), improving,
      framing: improving
        ? `Your ${meta.label.toLowerCase()} moved in the right direction lately — nice.`
        : `A small dip in your ${meta.label.toLowerCase()} — these ups and downs are normal.`,
    });
  }
  return out;
}

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [providerQuestions, setProviderQuestions] = useState<ProviderQuestion[]>([]);
  const [chat, setChatState] = useState<ChatMessage[]>([]);
  const [contextNotes, setContextNotes] = useState<ContextNote[]>([]);
  const [lastFocusAreas, setLastFocusAreas] = useState<string[]>([]);
  const [understandingLog, setUnderstandingLog] = useState<UnderstandingSnapshot[]>([]);
  const [recommendationLog, setRecommendationLog] = useState<RecommendationRecord[]>([]);
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [mind, setMind] = useState<Mind>(DEFAULT_MIND);
  const [tourDone, setTourDone] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function applySnapshot(d: Snapshot) {
    setProfile({ ...DEFAULT_PROFILE, ...(d.profile ?? {}) });
    setCheckIns(d.checkIns ?? []);
    setProviderQuestions(d.providerQuestions ?? []);
    setChatState(d.chat ?? []);
    setTourDone(!!d.tourDone);
    setContextNotes(d.contextNotes ?? []);
    setLastFocusAreas(d.lastFocusAreas ?? []);
    setUnderstandingLog(d.understandingLog ?? []);
    setRecommendationLog(d.recommendationLog ?? []);
    setExperiments(d.experiments ?? []);
    setSpaces(d.spaces ?? []);
    setMind(d.mind ? { ...DEFAULT_MIND, ...d.mind } : DEFAULT_MIND); // older snapshots may predate openQuestions
  }

  useEffect(() => {
    let localSnap: Snapshot | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        // Engine V2 safety net: keep a one-time, byte-for-byte pre-migration backup
        // so any user can be rolled back if a future phase mishandles their data.
        try { if (!localStorage.getItem(`${KEY}.pre_v2`)) localStorage.setItem(`${KEY}.pre_v2`, raw); } catch {}
        localSnap = JSON.parse(raw) as Snapshot; applySnapshot(localSnap);
      }
    } catch {}
    setHydrated(true);

    // Account sync: when signed in, reconcile with the cloud (last-write-wins),
    // so the whole record — including experiments — follows the user across devices.
    const sb = getSupabase();
    if (!sb) return;
    let cancelled = false;
    const reconcile = async (uid: string) => {
      setUserId(uid);
      const cloud = await loadCloud(sb, uid);
      if (cancelled) return;
      const localUpdated = localSnap?.updatedAt ?? "";
      if (cloud && (!localUpdated || cloud.updatedAt > localUpdated)) {
        applySnapshot(cloud.data as Snapshot);
        try { localStorage.setItem(KEY, JSON.stringify({ ...cloud.data, updatedAt: cloud.updatedAt })); } catch {}
      } else if (localSnap) {
        await saveCloud(sb, uid, { ...localSnap, updatedAt: localSnap.updatedAt ?? new Date().toISOString() });
      }
    };
    sb.auth.getSession().then(({ data }) => { const uid = data.session?.user?.id; if (uid) void reconcile(uid); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) void reconcile(uid);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next: Partial<{ profile: Profile; checkIns: CheckIn[]; providerQuestions: ProviderQuestion[]; chat: ChatMessage[]; tourDone: boolean; contextNotes: ContextNote[]; lastFocusAreas: string[]; understandingLog: UnderstandingSnapshot[]; recommendationLog: RecommendationRecord[]; experiments: ExperimentRecord[]; spaces: Space[]; mind: Mind }>) {
    const snap: Snapshot = {
      profile: next.profile ?? profile,
      checkIns: next.checkIns ?? checkIns,
      providerQuestions: next.providerQuestions ?? providerQuestions,
      chat: next.chat ?? chat,
      tourDone: (next as { tourDone?: boolean }).tourDone ?? tourDone,
      contextNotes: (next as { contextNotes?: ContextNote[] }).contextNotes ?? contextNotes,
      lastFocusAreas: (next as { lastFocusAreas?: string[] }).lastFocusAreas ?? lastFocusAreas,
      understandingLog: (next as { understandingLog?: UnderstandingSnapshot[] }).understandingLog ?? understandingLog,
      recommendationLog: (next as { recommendationLog?: RecommendationRecord[] }).recommendationLog ?? recommendationLog,
      experiments: (next as { experiments?: ExperimentRecord[] }).experiments ?? experiments,
      spaces: (next as { spaces?: Space[] }).spaces ?? spaces,
      mind: (next as { mind?: Mind }).mind ?? mind,
      updatedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch {}
    // Debounced write-through to the account (when signed in).
    if (userId) {
      const sb = getSupabase();
      if (sb) {
        const uid = userId;
        if (syncTimer.current) clearTimeout(syncTimer.current);
        syncTimer.current = setTimeout(() => { void saveCloud(sb, uid, snap as unknown as Record<string, unknown>); }, 1200);
      }
    }
  }

  const series = useMemo(
    () => mergeSeries(deriveSeries(checkIns), seriesFromEvidence(mind.evidence ?? [])),
    [checkIns, mind.evidence],
  );
  const recentChanges = useMemo(() => deriveRecentChanges(series), [series]);

  const { consistency, weeklyScore } = useMemo(() => {
    const now = Date.now();
    const days = new Set<string>();
    for (const c of checkIns) {
      if (now - new Date(c.date).getTime() <= 7 * 864e5) days.add(dayKey(c.date));
    }
    const cons = Math.min(1, days.size / 7);
    const improving = recentChanges.filter((c) => c.improving).length;
    const total = recentChanges.length || 1;
    const positive = recentChanges.length ? improving / total : 0.5;
    const score = checkIns.length === 0 ? 0 : Math.round(100 * (0.5 * cons + 0.5 * positive));
    return { consistency: cons, weeklyScore: score };
  }, [checkIns, recentChanges]);

  const focusAreas = useMemo(() => {
    const monitored = recentChanges.filter((c) => !c.improving).map((c) => c.label);
    if (monitored.length) return monitored.slice(0, 3);
    return profile.goals.slice(0, 3);
  }, [recentChanges, profile.goals]);

  const lifestyleSummary = useMemo(() => {
    const latest = [...checkIns].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest) return "";
    const bits: string[] = [];
    if (latest.metrics.sleep_quality != null) bits.push(`sleep ${Math.round(latest.metrics.sleep_quality)}`);
    if (latest.metrics.fatigue != null) bits.push(`fatigue ${Math.round(latest.metrics.fatigue)}`);
    if (latest.metrics.stress != null) bits.push(`stress ${Math.round(latest.metrics.stress)}`);
    return bits.join(" · ");
  }, [checkIns]);

  const value: Store = {
    hydrated, profile, checkIns, providerQuestions, chat, series, recentChanges,
    hasData: checkIns.length > 0,
    weeksTracked: checkIns.filter((c) => c.kind !== "daily").length || checkIns.length,
    dailyDoneToday: checkIns.some((c) => dayKey(c.date) === todayKey()),
    consistency, weeklyScore, focusAreas, lifestyleSummary,
    saveProfile: (p) => { const np = { ...profile, ...p }; setProfile(np); persist({ profile: np }); },
    addCheckIn: (c) => { const nc = [...checkIns, { kind: "weekly" as CheckInKind, ...c, id: `ci_${Date.now()}` }]; setCheckIns(nc); persist({ checkIns: nc }); },
    addProviderQuestion: (text, source = "manual") => { const nq = [...providerQuestions, { id: `q_${Date.now()}`, text, source, status: "open" as const }]; setProviderQuestions(nq); persist({ providerQuestions: nq }); },
    setQuestionStatus: (id, status) => { const nq = providerQuestions.map((q) => (q.id === id ? { ...q, status } : q)); setProviderQuestions(nq); persist({ providerQuestions: nq }); },
    setChat: (msgs) => { setChatState(msgs); persist({ chat: msgs }); },
    contextNotes,
    lastFocusAreas,
    addContextNote: (prompt, answer) => {
      const now = new Date().toISOString();
      const n = [...contextNotes, { id: `n_${Date.now()}`, date: now, prompt, answer }];
      setContextNotes(n);
      // The atom: a statement is first-class Evidence about the person (any domain),
      // not just a note. The quantitative engine still runs on health signals; this
      // captures the rest so the model reasons over a whole life, not just metrics.
      const ev: Evidence = { id: `ev_${Date.now()}`, kind: "statement", recordedAt: now, source: "conversation", text: answer, facets: { importance: "medium" } };
      const nm: Mind = { ...mind, evidence: [...(mind.evidence ?? []), ev].slice(-500) };
      setMind(nm);
      persist({ contextNotes: n, mind: nm });
    },
    setLastFocus: (areas) => { setLastFocusAreas(areas); persist({ lastFocusAreas: areas }); },
    understandingLog,
    recordUnderstanding: (snap) => {
      const prev = understandingLog;
      const last = prev[prev.length - 1];
      const changed = !last || JSON.stringify(last.focus) !== JSON.stringify(snap.focus);
      const stale = last ? Date.now() - new Date(last.date).getTime() > 14 * 864e5 : true;
      if (last && !changed && !stale) return;
      const seeded: UnderstandingSnapshot[] = [];
      if (!prev.length && profile.onboardedAt && ((profile.focusAreas && profile.focusAreas.length) || profile.goals.length)) {
        const base = (profile.focusAreas && profile.focusAreas.length ? profile.focusAreas : profile.goals).slice(0, 3);
        seeded.push({ id: "us_seed", date: profile.onboardedAt, focus: base, read: "Where we started, from your onboarding." });
      }
      const nextLog = [...prev, ...seeded, { id: `us_${Date.now()}`, date: new Date().toISOString(), focus: snap.focus, leadMetric: snap.leadMetric, read: snap.read }];
      setUnderstandingLog(nextLog); persist({ understandingLog: nextLog });
    },
    recommendationLog,
    recordRecommendation: (rec) => {
      const last = recommendationLog[recommendationLog.length - 1];
      if (last && last.id === rec.id) return; // same suggestion, nothing new to remember
      const nl = [...recommendationLog, { id: rec.id, title: rec.title, date: new Date().toISOString() }].slice(-20);
      setRecommendationLog(nl); persist({ recommendationLog: nl });
    },
    experiments,
    saveExperiments: (xs) => { setExperiments(xs); persist({ experiments: xs }); },
    spaces,
    saveSpaces: (xs) => { setSpaces(xs); persist({ spaces: xs }); },
    mind,
    saveMind: (m) => { setMind(m); persist({ mind: m }); },
    tourDone,
    completeTour: () => { setTourDone(true); persist({ tourDone: true }); },
    resetTour: () => { setTourDone(false); persist({ tourDone: false }); },
    reset: () => { setProfile(DEFAULT_PROFILE); setCheckIns([]); setProviderQuestions([]); setChatState([]); setTourDone(false); setContextNotes([]); setLastFocusAreas([]); setUnderstandingLog([]); setRecommendationLog([]); setExperiments([]); setSpaces([]); setMind(DEFAULT_MIND); try { localStorage.removeItem(KEY); } catch {} },
  };

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth() {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error("useHealth must be used within HealthProvider");
  return ctx;
}
