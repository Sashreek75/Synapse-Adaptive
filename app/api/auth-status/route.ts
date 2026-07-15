import { NextResponse } from "next/server";
import { env, flags } from "@/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AUTH DOCTOR — server-side read of the Supabase project's auth settings, so
 * the login page can say precisely WHY sign-in isn't working instead of
 * failing silently (e.g. Google provider disabled, sign-ups disabled,
 * email confirmations required).
 */
export async function GET() {
  if (!flags.authLive) {
    return NextResponse.json({ configured: false, reachable: false });
  }
  try {
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json({ configured: true, reachable: false, status: r.status });
    }
    const j = (await r.json()) as {
      disable_signup?: boolean;
      mailer_autoconfirm?: boolean;
      external?: Record<string, boolean>;
    };
    return NextResponse.json({
      configured: true,
      reachable: true,
      emailEnabled: j.external?.email !== false,
      googleEnabled: !!j.external?.google,
      signupDisabled: !!j.disable_signup,
      autoconfirm: !!j.mailer_autoconfirm,
    });
  } catch {
    return NextResponse.json({ configured: true, reachable: false });
  }
}
