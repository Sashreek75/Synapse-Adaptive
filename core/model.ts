/**
 * MODEL TRANSPORT — the only way the core talks to a language model.
 *
 * The core never holds a key. In the shipped app, calls go to the Synapse relay (a stateless
 * endpoint on the website's server that holds the Gemini key and nothing else). In development
 * you can point it straight at Gemini with your own key.
 */
export interface ModelImage { mimeType: string; data: string }
export interface ModelCall { system?: string; user: string; fast?: boolean; maxTokens?: number; temperature?: number; images?: ModelImage[] }
export type CallModel = (c: ModelCall) => Promise<string | null>;

type Fetch = typeof fetch;

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fn(ctrl.signal); } finally { clearTimeout(t); }
}

/** Production: the Synapse relay. */
export function relayTransport(url: string, installId: string, f: Fetch = fetch): CallModel {
  return async (c) => {
    try {
      return await withTimeout(c.images?.length ? 45_000 : 20_000, async (signal) => {
        const res = await f(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-synapse-install": installId },
          body: JSON.stringify(c),
          signal,
        });
        if (!res.ok) return null;
        const d = (await res.json()) as { text?: string | null };
        return d.text?.trim() || null;
      });
    } catch { return null; }
  };
}

/** Development: call Gemini directly with a local key. */
export function geminiTransport(apiKey: string, opts: { model?: string; fastModel?: string } = {}, f: Fetch = fetch): CallModel {
  const API = "https://generativelanguage.googleapis.com/v1beta";
  const pool = (fast?: boolean) => [...new Set([fast ? opts.fastModel : opts.model, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"].filter(Boolean) as string[])];
  const body = (c: ModelCall, noThinking: boolean) => ({
    ...(c.system ? { systemInstruction: { parts: [{ text: c.system }] } } : {}),
    contents: [{ role: "user", parts: [
      ...(c.images ?? []).map((i) => ({ inline_data: { mime_type: i.mimeType, data: i.data } })),
      { text: c.user },
    ] }],
    generationConfig: { temperature: c.temperature ?? 0.6, maxOutputTokens: c.maxTokens ?? 1024, ...(noThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
  });
  return async (c) => {
    for (const model of pool(c.fast)) {
      try {
        const post = (nt: boolean) => withTimeout(45_000, (signal) => f(`${API}/models/${model}:generateContent`, {
          method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": apiKey }, body: JSON.stringify(body(c, nt)), signal,
        }));
        let res = await post(true);
        if (res.status === 400) res = await post(false);
        if (!res.ok) { if ([404, 429, 500, 503].includes(res.status)) continue; return null; }
        const d = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
        if (text) return text;
      } catch { /* next model */ }
    }
    return null;
  };
}

export function extractJson(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{"); const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}
