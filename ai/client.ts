import "server-only";
import { env, flags } from "@/env";

/**
 * Server-only AI client — Google Gemini (free tier).
 *
 * Robustness: model names change and free quotas are PER-model, so instead of
 * hardcoding names we ask the key which models it actually has (ListModels),
 * keep only those that support generateContent, and try across them. A model
 * that's 404 (gone) or 429 (quota) simply gets skipped — the agent stays up as
 * long as ANY available model has quota.
 */
export interface ModelCall { system?: string; user: string; fast?: boolean; maxTokens?: number; temperature?: number }

const API = "https://generativelanguage.googleapis.com/v1beta";
const headers = () => ({ "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY as string });

let _models: string[] | null = null;
let _fetchedAt = 0;

/** Models this key can actually use for generateContent (cached ~10 min). */
async function availableModels(): Promise<string[]> {
  if (_models && Date.now() - _fetchedAt < 600_000) return _models;
  try {
    const res = await fetch(`${API}/models?pageSize=200`, { headers: headers(), cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      _models = (d.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
        .map((m) => m.name.replace("models/", ""));
      _fetchedAt = Date.now();
    }
  } catch { /* fall through to static list */ }
  return _models ?? [];
}

/** Ordered candidate models: prefer fast "flash" models (best free quota). */
async function candidates(primary: string): Promise<string[]> {
  const avail = await availableModels();
  if (avail.length) {
    const usable = avail.filter((m) => !/(thinking|vision|image|audio|tts|embedding|aqa|learnlm)/i.test(m));
    const flash = usable.filter((m) => /flash/i.test(m));
    const pool = (flash.length ? flash : usable);
    return [...new Set([...(pool.includes(primary) ? [primary] : []), ...pool])].slice(0, 8);
  }
  // Fallback if ListModels failed
  return [...new Set([primary, "gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-flash-latest"])];
}

/**
 * Build the request body. `noThinking` adds thinkingConfig.thinkingBudget=0.
 *
 * WHY THIS MATTERS: Gemini 2.5 "flash" models (what gemini-flash-latest resolves
 * to) enable an internal "thinking" pass by DEFAULT, and those hidden thinking
 * tokens are billed against maxOutputTokens. With thinking on, the model can burn
 * most of the budget reasoning and then get cut off mid-sentence in the visible
 * answer — the classic "response just stops" bug. We disable thinking for our
 * conversational/report generations (we own the reasoning structure via prompts)
 * and give the visible answer the full token budget.
 */
function buildBody(c: ModelCall, noThinking: boolean) {
  const generationConfig: Record<string, unknown> = {
    temperature: c.temperature ?? 0.6,
    maxOutputTokens: c.maxTokens ?? 2048,
  };
  if (noThinking) generationConfig.thinkingConfig = { thinkingBudget: 0 };
  return {
    ...(c.system ? { systemInstruction: { parts: [{ text: c.system }] } } : {}),
    contents: [{ role: "user", parts: [{ text: c.user }] }],
    generationConfig,
  };
}

async function post(model: string, body: unknown) {
  return fetch(`${API}/models/${model}:generateContent`, { method: "POST", headers: headers(), body: JSON.stringify(body), cache: "no-store" });
}

async function callOnce(model: string, c: ModelCall) {
  // Prefer thinking OFF (full budget goes to the visible answer). Older/other
  // models that don't accept thinkingConfig return 400 — we transparently retry
  // without it so we never lose a model over an unsupported knob.
  let res = await post(model, buildBody(c, true));
  if (res.status === 400) res = await post(model, buildBody(c, false));
  if (!res.ok) return { ok: false as const, status: res.status, detail: (await res.text().catch(() => "")).slice(0, 200) };
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (cand?.finishReason === "MAX_TOKENS") console.warn(`[ai] ${model} hit MAX_TOKENS — answer may be clipped; consider a higher maxTokens.`);
  return { ok: true as const, text, finishReason: cand?.finishReason };
}

export async function callModel(c: ModelCall): Promise<string | null> {
  if (!flags.aiLive) return null;
  for (const model of await candidates(c.fast ? env.GEMINI_FAST_MODEL : env.GEMINI_MODEL)) {
    try {
      const r = await callOnce(model, c);
      if (r.ok) return r.text || null;
      console.error(`[ai] ${model} -> ${r.status}: ${r.detail}`);
      if (![429, 404, 503, 500].includes(r.status)) break;
    } catch (err) { console.error(`[ai] ${model} error`, err); }
  }
  return null;
}

export async function pingModel() {
  if (!flags.aiLive) return { configured: false, ok: false, error: "No GEMINI_API_KEY set in .env.local" };
  const avail = await availableModels();
  const tried: { model: string; status: number | "ok" }[] = [];
  for (const model of await candidates(env.GEMINI_MODEL)) {
    try {
      const r = await callOnce(model, { user: "Reply with OK.", maxTokens: 16 });
      if (r.ok) return { configured: true, ok: true, model, availableModels: avail };
      tried.push({ model, status: r.status });
      if (![429, 404, 503, 500].includes(r.status)) break;
    } catch { tried.push({ model, status: 0 }); }
  }
  return { configured: true, ok: false, tried, availableModels: avail, hint: avail.length ? "All available models returned errors (likely free-tier quota for today — try again later, or it resets daily)." : "Could not list models — check the API key." };
}

export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{"); const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}
