/**
 * FOREGROUND — what's in front of the user, read straight from the operating system, and the
 * two OS-level actions the gate needs (bring a window forward, close the current browser tab).
 *
 *   Windows: Win32 through koffi (FFI, no native build step). Fast enough to poll every ~0.5s.
 *   macOS:   osascript. Chromium browsers and Safari report their exact URL via AppleScript.
 *
 * This is what lets the gate work WITHOUT the browser helper: the browser's window title
 * ("Some video - YouTube - Google Chrome") already says which site is in front.
 */
import { execFile } from "node:child_process";

export interface Foreground {
  app: string;          // "chrome.exe" / "google chrome"
  title: string;        // raw window title
  hwnd?: number;        // Windows only
  url?: string;         // macOS browsers only (exact)
  appName?: string;     // macOS: the app's real name, for AppleScript
}

type Fn = (...args: unknown[]) => any;
let w: Record<string, Fn> | null = null;
let failed = false;

function win() {
  if (w || failed) return w;
  if (process.platform !== "win32") { failed = true; return null; }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require("koffi");
    const user32 = koffi.load("user32.dll");
    const kernel32 = koffi.load("kernel32.dll");
    w = {
      fg: user32.func("intptr_t __stdcall GetForegroundWindow()"),
      text: user32.func("int __stdcall GetWindowTextW(intptr_t hWnd, _Out_ uint16_t* lpString, int nMaxCount)"),
      pid: user32.func("uint32_t __stdcall GetWindowThreadProcessId(intptr_t hWnd, _Out_ uint32_t* lpdwProcessId)"),
      setFg: user32.func("bool __stdcall SetForegroundWindow(intptr_t hWnd)"),
      isWin: user32.func("bool __stdcall IsWindow(intptr_t hWnd)"),
      key: user32.func("void __stdcall keybd_event(uint8_t bVk, uint8_t bScan, uint32_t dwFlags, uintptr_t dwExtraInfo)"),
      open: kernel32.func("intptr_t __stdcall OpenProcess(uint32_t dwDesiredAccess, bool bInheritHandle, uint32_t dwProcessId)"),
      image: kernel32.func("bool __stdcall QueryFullProcessImageNameW(intptr_t hProcess, uint32_t dwFlags, _Out_ uint16_t* lpExeName, _Inout_ uint32_t* lpdwSize)"),
      close: kernel32.func("bool __stdcall CloseHandle(intptr_t hObject)"),
    };
  } catch (e) {
    console.error("[synapse] Win32 access unavailable:", e);
    failed = true;
  }
  return w;
}

const decode = (buf: Uint16Array, len: number) => String.fromCharCode(...buf.subarray(0, Math.max(0, len)));
const exeCache = new Map<number, string>();

function titleOf(hwnd: number): string {
  const a = win()!;
  const buf = new Uint16Array(512);
  return decode(buf, a.text(hwnd, buf, 512));
}

function foregroundWin(): Foreground | null {
  const a = win();
  if (!a) return null;
  try {
    const hwnd = Number(a.fg());
    if (!hwnd) return null;
    const pidOut = [0];
    a.pid(hwnd, pidOut);
    const pid = pidOut[0];
    let app = exeCache.get(pid);
    if (!app) {
      app = "unknown";
      const h = a.open(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, pid);
      if (h) {
        const ibuf = new Uint16Array(1024);
        const size = [1024];
        if (a.image(h, 0, ibuf, size)) app = (decode(ibuf, size[0]).split("\\").pop() || app).toLowerCase();
        a.close(h);
      }
      if (exeCache.size > 200) exeCache.clear();
      exeCache.set(pid, app);
    }
    return { app, title: titleOf(hwnd), hwnd };
  } catch {
    return null;
  }
}

/* ---------------- macOS ---------------- */

const MAC_FRONT = `
tell application "System Events"
  set p to first application process whose frontmost is true
  set n to name of p
  set t to ""
  try
    set t to name of front window of p
  end try
end tell
return n & linefeed & t`;

const MAC_CHROMIUM = /^(google chrome|microsoft edge|brave browser|arc|vivaldi|opera|chromium)$/i;

function osa(script: string, timeout = 2500): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("osascript", ["-e", script], { timeout }, (err, out) => resolve(err ? null : String(out).replace(/\n$/, "")));
  });
}

async function foregroundMac(): Promise<Foreground | null> {
  const out = await osa(MAC_FRONT);
  if (!out) return null;
  const [rawApp, ...rest] = out.split("\n");
  const app = rawApp.trim();
  const fg: Foreground = { app: app.toLowerCase(), appName: app, title: rest.join(" ").trim() };
  // Browsers that speak AppleScript tell us the exact URL — no helper needed.
  if (MAC_CHROMIUM.test(app)) {
    const u = await osa(`tell application "${app}" to get URL of active tab of front window`, 1500);
    if (u) fg.url = u.trim();
  } else if (/^safari$/i.test(app)) {
    const u = await osa(`tell application "Safari" to get URL of current tab of front window`, 1500);
    if (u) fg.url = u.trim();
  }
  return fg;
}

/* ---------------- public API ---------------- */

/* Test hook: SYNAPSE_FAKE_FG=<file.json> makes the "OS" report whatever that file says, and tab
 * closes get logged to <file>.closed — so the gate's no-helper path can be tested on any machine. */
const FAKE = process.env.SYNAPSE_FAKE_FG;
function fakeFg(): Foreground | null {
  try { return JSON.parse(require("node:fs").readFileSync(FAKE!, "utf8")); } catch { return null; }
}

export async function foreground(): Promise<Foreground | null> {
  if (FAKE) return fakeFg();
  if (process.platform === "win32") return foregroundWin();
  if (process.platform === "darwin") return foregroundMac();
  return null;
}

/** Browser processes whose current site we can read (title on Windows, URL on Mac). */
export const BROWSERS = /^(chrome|msedge|brave|opera|vivaldi|arc|firefox)(\.exe)?$|^(google chrome|microsoft edge|brave browser|arc|opera|vivaldi|safari|firefox|chromium)$/i;

/** Bring a window to the front. Windows blocks background apps from doing this unless a key
 *  event just happened, so we tap Alt first — the standard, harmless workaround. */
export function bringToFront(hwnd: number): boolean {
  const a = win();
  if (!a || !hwnd || !a.isWin(hwnd)) return false;
  a.key(0x12, 0, 0, 0);       // Alt down
  const ok = a.setFg(hwnd);
  a.key(0x12, 0, 2, 0);       // Alt up
  return !!ok;
}

export function nativeHandle(buf: Buffer): number {
  return buf.length >= 8 ? Number(buf.readBigUInt64LE(0)) : buf.readUInt32LE(0);
}

/**
 * Close the browser tab that's showing the distraction, without the helper extension.
 * Windows: bring the browser forward, re-check its title still shows that site, then Ctrl+W.
 * macOS: ask the browser via AppleScript to close its active tab.
 * `stillThere(title)` guards against closing the wrong tab if the user switched in the meantime.
 */
export async function closeBrowserTab(target: Foreground, stillThere: (fg: Foreground) => boolean): Promise<boolean> {
  if (FAKE) {
    const now = fakeFg();
    if (!now || !stillThere(now)) return false;
    require("node:fs").appendFileSync(FAKE + ".closed", `${now.title}\n`);
    return true;
  }
  if (process.platform === "win32") {
    const a = win();
    if (!a || !target.hwnd || !a.isWin(target.hwnd)) return false;
    bringToFront(target.hwnd);
    await new Promise((r) => setTimeout(r, 150));
    const now = foregroundWin();
    if (!now || now.hwnd !== target.hwnd || !stillThere(now)) return false;
    a.key(0x11, 0, 0, 0); a.key(0x57, 0, 0, 0);     // Ctrl down, W down
    a.key(0x57, 0, 2, 0); a.key(0x11, 0, 2, 0);     // W up, Ctrl up
    return true;
  }
  if (process.platform === "darwin") {
    const now = await foregroundMac();
    const app = now && now.app === target.app ? now.appName ?? null : null;
    if (!now || !app || !stillThere(now)) return false;
    const script = /^safari$/i.test(app)
      ? `tell application "Safari" to close current tab of front window`
      : `tell application "${app}" to close active tab of front window`;
    return (await osa(script)) !== null;
  }
  return false;
}
