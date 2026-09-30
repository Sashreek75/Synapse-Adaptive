/**
 * Which window is in front.
 *   Windows: the Win32 API through koffi (FFI, no native build step).
 *   macOS:   System Events via osascript (the app name always; the window title once the user
 *            grants Accessibility — without it we still know the app).
 * Returns null anywhere else so the app still runs for development.
 */
import { execFile } from "node:child_process";
export interface Foreground { app: string; title: string }

type Fn = (...args: unknown[]) => unknown;
let api: { fg: Fn; text: Fn; pid: Fn; open: Fn; image: Fn; close: Fn; koffi: any } | null = null;
let failed = false;

function load() {
  if (api || failed) return api;
  if (process.platform !== "win32") { failed = true; return null; }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const koffi = require("koffi");
    const user32 = koffi.load("user32.dll");
    const kernel32 = koffi.load("kernel32.dll");
    api = {
      koffi,
      fg: user32.func("void* __stdcall GetForegroundWindow()"),
      text: user32.func("int __stdcall GetWindowTextW(void* hWnd, _Out_ uint16_t* lpString, int nMaxCount)"),
      pid: user32.func("uint32_t __stdcall GetWindowThreadProcessId(void* hWnd, _Out_ uint32_t* lpdwProcessId)"),
      open: kernel32.func("void* __stdcall OpenProcess(uint32_t dwDesiredAccess, bool bInheritHandle, uint32_t dwProcessId)"),
      image: kernel32.func("bool __stdcall QueryFullProcessImageNameW(void* hProcess, uint32_t dwFlags, _Out_ uint16_t* lpExeName, _Inout_ uint32_t* lpdwSize)"),
      close: kernel32.func("bool __stdcall CloseHandle(void* hObject)"),
    };
  } catch (e) {
    console.error("[synapse] foreground tracking unavailable:", e);
    failed = true;
  }
  return api;
}

const decode = (buf: Uint16Array, len: number) => String.fromCharCode(...buf.subarray(0, Math.max(0, len)));

function foregroundWin(): Foreground | null {
  const a = load();
  if (!a) return null;
  try {
    const hwnd = a.fg();
    if (!hwnd) return null;
    const tbuf = new Uint16Array(512);
    const tlen = a.text(hwnd, tbuf, 512) as number;
    const pidOut = [0];
    a.pid(hwnd, pidOut);
    let app = "unknown";
    const h = a.open(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, pidOut[0]);
    if (h) {
      const ibuf = new Uint16Array(1024);
      const size = [1024];
      if (a.image(h, 0, ibuf, size)) app = decode(ibuf, size[0]).split("\\").pop() || app;
      a.close(h);
    }
    return { app: app.toLowerCase(), title: decode(tbuf, tlen) };
  } catch {
    return null;
  }
}

const MAC_SCRIPT = `
tell application "System Events"
  set p to first application process whose frontmost is true
  set n to name of p
  set t to ""
  try
    set t to name of front window of p
  end try
end tell
return n & linefeed & t`;

function foregroundMac(): Promise<Foreground | null> {
  return new Promise((resolve) => {
    execFile("osascript", ["-e", MAC_SCRIPT], { timeout: 3000 }, (err, out) => {
      if (err) return resolve(null);
      const [app, ...rest] = String(out).replace(/\n$/, "").split("\n");
      resolve(app ? { app: app.trim().toLowerCase(), title: rest.join(" ").trim() } : null);
    });
  });
}

export async function foreground(): Promise<Foreground | null> {
  if (process.platform === "win32") return foregroundWin();
  if (process.platform === "darwin") return foregroundMac();
  return null;
}

/** Browser processes whose tab the helper extension can tell us about. */
export const BROWSERS = /^(chrome|msedge|brave|opera|vivaldi|arc)(\.exe)?$|^(google chrome|microsoft edge|brave browser|arc|opera|vivaldi)$/i;
