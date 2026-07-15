/**
 * npm run users — prints your total Synapse Adaptive user count.
 * Reads .env.local for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * The service-role key is admin-only — never put it in NEXT_PUBLIC_* or commit it.
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("\n  Missing keys. Add these to .env.local:\n    NEXT_PUBLIC_SUPABASE_URL=...\n    SUPABASE_SERVICE_ROLE_KEY=...   (Supabase → Project Settings → API → service_role)\n");
  process.exit(1);
}

const { createClient } = await import("@supabase/supabase-js");
const supabase = createClient(url, key, { auth: { persistSession: false } });

let total = 0, page = 1;
const perPage = 1000;
for (;;) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
  if (error) { console.error("\n  Error:", error.message, "\n"); process.exit(1); }
  total += data.users.length;
  if (data.users.length < perPage) break;
  page++;
}
console.log(`\n  🧠  Synapse Adaptive\n  ─────────────────────────────\n  Total users: ${total}\n`);
