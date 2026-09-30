import { NextResponse } from "next/server";

/**
 * /download            → the installer for the visitor's OS
 * /download?os=mac     → force macOS
 * /download?os=windows → force Windows
 *
 * Installers are built by .github/workflows/release.yml and attached to the latest GitHub release.
 * If there isn't one yet, visitors get a friendly page instead of GitHub's 404.
 */
const REPO = process.env.NEXT_PUBLIC_RELEASES_REPO || "Sashreek75/Synapse-Adaptive";
const ASSET = { windows: "SynapseSetup.exe", mac: "Synapse-mac.dmg" } as const;
type OS = keyof typeof ASSET;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("os");
  const ua = req.headers.get("user-agent") || "";
  const os: OS = q === "mac" || q === "windows" ? q : /Macintosh|Mac OS X/.test(ua) ? "mac" : "windows";

  const override = os === "mac" ? process.env.NEXT_PUBLIC_DOWNLOAD_URL_MAC : process.env.NEXT_PUBLIC_DOWNLOAD_URL_WINDOWS;
  const target = override || `https://github.com/${REPO}/releases/latest/download/${ASSET[os]}`;

  if (!override) {
    try {
      const head = await fetch(target, { method: "HEAD", redirect: "manual", cache: "no-store" });
      if (head.status === 404) return NextResponse.redirect(new URL(`/coming-soon?os=${os}`, url), 302);
    } catch { /* if GitHub can't be reached, just try the link */ }
  }
  return NextResponse.redirect(target, 302);
}
