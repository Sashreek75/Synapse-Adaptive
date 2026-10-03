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
      threadOf: user32.func("uint32_t __stdcall GetWindowThreadProcessId(intptr_t hWnd, intptr_t lpdwProcessId)"),
      attach: user32.func("bool __stdcall AttachThreadInput(uint32_t idAttach, uint32_t idAttachTo, bool fAttach)"),
      toTop: user32.func("bool __stdcall BringWindowToTop(intptr_t hWnd)"),
      show: user32.func("bool __stdcall ShowWindow(intptr_t hWnd, int nCmdShow)"),
      iconic: user32.func("bool __stdcall IsIconic(intptr_t hWnd)"),
      myThread: kernel32.func("uint32_t __stdcall GetCurrentThreadId()"),
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

/**
 * Bring a window to the front. Windows refuses this to background apps ("foreground lock"),
 * so we use the two standard workarounds together: attach to the foreground window's input
 * thread, and tap Alt. Restores the window first if it's minimised.
 */
export function bringToFront(hwnd: number): boolean {
  const a = win();
  if (!a || !hwnd || !a.isWin(hwnd)) return false;
  try {
    if (a.iconic(hwnd)) a.show(hwnd, 9 /* SW_RESTORE */);
    const fgThread = a.threadOf(Number(a.fg()), 0);
    const me = a.myThread();
    const attached = fgThread && fgThread !== me ? a.attach(me, fgThread, true) : false;
    a.key(0x12, 0, 0, 0);       // Alt down
    a.setFg(hwnd);
    a.toTop(hwnd);
    a.key(0x12, 0, 2, 0);       // Alt up
    if (attached) a.attach(me, fgThread, false);
  } catch { /* fall through to the check */ }
  return Number(a.fg()) === hwnd;
}

export function minimize(hwnd?: number) {
  const a = win();
  if (a && hwnd && a.isWin(hwnd)) a.show(hwnd, 6 /* SW_MINIMIZE */);
}

export function nativeHandle(buf: Buffer): number {
  return buf.length >= 8 ? Number(buf.readBigUInt64LE(0)) : buf.readUInt32LE(0);
}

export type CloseResult = "closed" | "gone" | "minimized" | "failed";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Close the browser tab that's showing the distraction, without the browser helper.
 * Windows: bring the browser forward, confirm it's still showing that site, press Ctrl+W, then
 * confirm the site is gone. Retries a few times; if Windows won't let us, minimises the window
 * so the distraction is at least out of sight.
 * macOS: ask the browser through AppleScript to close its active tab.
 * `stillThere` guards against closing the wrong tab if the user switched in the meantime.
 */
export async function closeBrowserTab(target: Foreground, stillThere: (fg: Foreground) => boolean, log: (m: string) => void = () => {}, site?: string): Promise<CloseResult> {
  if (FAKE) {
    const now = fakeFg();
    if (!now || !stillThere(now)) return "gone";
    require("node:fs").appendFileSync(FAKE + ".closed", `${now.title}\n`);
    return "closed";
  }
  if (process.platform === "win32") {
    const a = win();
    if (!a || !target.hwnd || !a.isWin(target.hwnd)) { log("close: browser window no longer exists"); return "gone"; }
    if (!stillThere({ ...target, title: titleOf(target.hwnd) })) { log("close: site no longer showing"); return "gone"; }
    for (let attempt = 1; attempt <= 3; attempt++) {
      const front = bringToFront(target.hwnd);
      await wait(180);
      const now = foregroundWin();
      if (!front || !now || now.hwnd !== target.hwnd) { log(`close: attempt ${attempt} couldn't bring the browser forward`); continue; }
      if (!stillThere(now)) return "gone";
      a.key(0x11, 0, 0, 0); a.key(0x57, 0, 0, 0);     // Ctrl down, W down
      a.key(0x57, 0, 2, 0); a.key(0x11, 0, 2, 0);     // W up, Ctrl up
      await wait(350);
      if (!a.isWin(target.hwnd)) return "closed";      // that was the last tab
      if (!stillThere({ ...target, title: titleOf(target.hwnd) })) return "closed";
      log(`close: attempt ${attempt} sent Ctrl+W but the site is still showing ("${titleOf(target.hwnd).slice(0, 80)}")`);
    }
    minimize(target.hwnd);
    log("close: gave up and minimised the browser");
    return "minimized";
  }
  if (process.platform === "darwin") {
    // The browser usually ISN'T frontmost here (the gate card has focus), so don't require it:
    // ask that browser directly for the active tab of its front window, and close it only if it's
    // still showing the site.
    const app = target.appName;
    if (!app) return "failed";
    if (site && /^[a-z0-9.-]+$/i.test(site)) {
      const tab = /^safari$/i.test(app) ? "current tab of front window" : "active tab of front window";
      const out = await osa([
        `tell application "${app}"`,
        `  if (count of windows) is 0 then return "gone"`,
        `  set t to ${tab}`,
        `  if (URL of t) contains "${site}" then`,
        `    close t`,
        `    return "closed"`,
        `  end if`,
        `  return "gone"`,
        `end tell`,
      ].join("\n"));
      if (out === "closed" || out === "gone") return out;
      log(`close: AppleScript failed for ${app} (Automation permission?)`);
      return "failed";
    }
    const now = await foregroundMac();
    if (!now || now.app !== target.app || !stillThere(now)) return "gone";
    const script = /^safari$/i.test(app)
      ? `tell application "Safari" to close current tab of front window`
      : `tell application "${app}" to close active tab of front window`;
    return (await osa(script)) !== null ? "closed" : "failed";
  }
  return "failed";
}
