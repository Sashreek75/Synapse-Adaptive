import { NextResponse } from "next/server";

/**
 * /download            → the installer for the visitor's OS
 * /download?os=mac     → force macOS (Apple Silicon — every Mac since late 2020)
 * /download?os=mac-intel → older Intel Macs
 * /download?os=windows → force Windows
 *
 * Installers are built by .github/workflows/release.yml and attached to the latest GitHub release.
 * If there isn't one yet, visitors get a friendly page instead of GitHub's 404.
 */
const REPO = process.env.NEXT_PUBLIC_RELEASES_REPO || "Sashreek75/Synapse-Adaptive";
// Mac: the disk image if that release has one, else the .zip (always built — see desktop/build/mac-dmg.mjs).
const ASSET = { windows: ["SynapseSetup.exe"], mac: ["Synapse-mac-arm64.dmg", "Synapse-mac-arm64.zip"], "mac-intel": ["Synapse-mac-x64.dmg", "Synapse-mac-x64.zip"] } as const;
type OS = keyof typeof ASSET;

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("os");
  const ua = req.headers.get("user-agent") || "";
  const os: OS = q === "mac" || q === "windows" || q === "mac-intel" ? q : /Macintosh|Mac OS X/.test(ua) ? "mac" : "windows";

  const override = os === "windows" ? process.env.NEXT_PUBLIC_DOWNLOAD_URL_WINDOWS : os === "mac" ? process.env.NEXT_PUBLIC_DOWNLOAD_URL_MAC : undefined;
  if (override) return NextResponse.redirect(override, 302);

  const links = ASSET[os].map((a) => `https://github.com/${REPO}/releases/latest/download/${a}`);
  let target: string | null = null;
  for (const link of links) {
    try {
      const head = await fetch(link, { method: "HEAD", redirect: "manual", cache: "no-store" });
      if (head.status !== 404) { target = link; break; }
    } catch { target = link; break; }  // if GitHub can't be reached, just try the link
  }
  if (!target) return NextResponse.redirect(new URL(`/coming-soon?os=${os === "windows" ? "windows" : "mac"}`, url), 302);
  return NextResponse.redirect(target, 302);
}
