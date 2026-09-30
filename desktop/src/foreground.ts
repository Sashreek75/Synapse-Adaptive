/**
 * Which window is in front — via the Win32 API (koffi FFI, no native build step).
 * Returns null on non-Windows platforms so the app still runs for development.
 */
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

export function foreground(): Foreground | null {
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

export const BROWSERS = /^(chrome|msedge|brave|opera|vivaldi|firefox)\.exe$/i;
