/**
 * npm run waitlist — prints how many people signed up to upgrade (Pro / Max)
 * while Stripe billing isn't live yet.
 *
 * Two sources, merged and de-duplicated by email:
 *   1. Supabase table `public.waitlist` (the real store, via service-role key)
 *   2. .waitlist.jsonl at the project root (local fallback the API writes to
 *      whenever Supabase is unconfigured, so no signup is ever lost)
 *
 * Reads keys from .env.local then .env. The service-role key is admin-only —
 * never put it in NEXT_PUBLIC_* or commit it.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  try {
    for (const line of readFileSync(join(root, file), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
loadEnv(".env.local");
loadEnv(".env");

/** email -> { email, plan, note, created_at, source } (last write wins, but
 *  Supabase is preferred over local for the same email). */
const rows = new Map();

function add(row, source) {
  const email = String(row.email || "").trim().toLowerCase();
  if (!email) return;
  const plan = row.plan === "max" ? "max" : "pro";
  const existing = rows.get(email);
  // Prefer the Supabase copy if we already have one from local.
  if (existing && existing.source === "supabase" && source === "local") return;
  rows.set(email, {
    email,
    plan,
    note: row.note ?? null,
    created_at: row.created_at ?? null,
    source,
  });
}

// ── 1. Supabase table ───────────────────────────────────────────────────────
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabaseOk = false;

if (url && key) {
  try {
    const res = await fetch(
      `${url.replace(/\/$/, "")}/rest/v1/waitlist?select=email,plan,note,created_at&order=created_at.desc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        for (const r of data) add(r, "supabase");
        supabaseOk = true;
      }
    } else if (res.status === 404 || res.status === 400) {
      // Table doesn't exist yet — that's fine, we'll rely on the local file.
    } else {
      console.error(`\n  Supabase responded ${res.status}. Falling back to the local file.\n`);
    }
  } catch (e) {
    console.error(`\n  Couldn't reach Supabase (${e.message}). Falling back to the local file.\n`);
  }
}

// ── 2. Local fallback file ────────────────────────────────────────────────────
let localCount = 0;
try {
  const text = readFileSync(join(root, ".waitlist.jsonl"), "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      add(JSON.parse(t), "local");
      localCount++;
    } catch {}
  }
} catch {}

// ── Report ────────────────────────────────────────────────────────────────────
const all = [...rows.values()];
const total = all.length;
const pro = all.filter((r) => r.plan === "pro").length;
const max = all.filter((r) => r.plan === "max").length;

if (total === 0 && !supabaseOk && localCount === 0) {
  console.log(
    "\n  🧠  Synapse Adaptive — Upgrade waitlist\n" +
      "  ─────────────────────────────────────\n" +
      "  No signups yet.\n\n" +
      "  Sources checked:\n" +
      `    - Supabase table 'waitlist'  ${url && key ? "(reachable, empty or not created)" : "(keys not set)"}\n` +
      "    - .waitlist.jsonl            (none found)\n\n" +
      "  Tip: create the table once in Supabase so signups persist across deploys:\n" +
      "    create table if not exists public.waitlist (\n" +
      "      id bigint generated always as identity primary key,\n" +
      "      email text not null unique, plan text not null, note text,\n" +
      "      created_at timestamptz default now());\n"
  );
  process.exit(0);
}

// Sort newest first for the preview.
all.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));

const bar = (n) => "▇".repeat(Math.min(n, 40));
const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt) ? "" : dt.toISOString().slice(0, 10);
};

let out =
  "\n  🧠  Synapse Adaptive — Upgrade waitlist\n" +
  "  ─────────────────────────────────────\n" +
  `  Total interested:  ${total}\n\n` +
  `  Pro   ${String(pro).padStart(4)}  ${bar(pro)}\n` +
  `  Max   ${String(max).padStart(4)}  ${bar(max)}\n`;

if (supabaseOk) {
  const localOnly = all.filter((r) => r.source === "local").length;
  if (localOnly > 0) {
    out += `\n  Note: ${localOnly} signup(s) exist only in .waitlist.jsonl and aren't in Supabase yet.\n`;
  }
}

// Show the 10 most recent so you can eyeball who's waiting.
const recent = all.slice(0, 10);
out += `\n  Most recent (${recent.length} of ${total}):\n`;
for (const r of recent) {
  const date = fmtDate(r.created_at);
  out += `    ${(date || "         ").padEnd(11)} ${r.plan.toUpperCase().padEnd(4)}  ${r.email}\n`;
}
out += "\n";

console.log(out);
