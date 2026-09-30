/**
 * BRIDGE — the local socket between the Synapse app and the browser helper extension.
 * Listens on 127.0.0.1 only, and only accepts connections whose Origin is the helper
 * extension, so a web page can't talk to it or pretend to be the browser.
 */
import { WebSocketServer, type WebSocket } from "ws";
import { EventEmitter } from "node:events";

export const HELPER_EXTENSION_ID = "jbnlmddhddklfccopgonffpkniokonfb";
export const BRIDGE_PORT = 47821;

export interface TabInfo { tabId: number; windowId: number; url: string; title: string; active: boolean; focused: boolean }

export class Bridge extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  tabs = new Map<number, TabInfo>();
  browserFocused = false;

  constructor(private allowedIds: string[] = [HELPER_EXTENSION_ID]) { super(); }

  get connected() { return this.clients.size > 0; }

  start() {
    this.wss = new WebSocketServer({
      host: "127.0.0.1", port: BRIDGE_PORT,
      verifyClient: ({ origin }: { origin?: string }) => this.allowedIds.some((id) => origin === `chrome-extension://${id}`),
    });
    this.wss.on("error", (e) => console.error("[bridge]", e.message));
    this.wss.on("connection", (ws) => {
      this.clients.add(ws);
      this.emit("status", true);
      ws.on("message", (buf) => { let m: any; try { m = JSON.parse(String(buf)); } catch { return; } this.onMessage(m); });
      ws.on("close", () => { this.clients.delete(ws); if (!this.connected) { this.tabs.clear(); this.emit("status", false); } });
    });
  }

  private onMessage(m: any) {
    if (m.type === "tab" && typeof m.tabId === "number") {
      const t: TabInfo = { tabId: m.tabId, windowId: m.windowId, url: String(m.url || ""), title: String(m.title || ""), active: !!m.active, focused: !!m.focused };
      if (t.active) for (const o of this.tabs.values()) if (o.windowId === t.windowId && o.tabId !== t.tabId) o.active = false;
      if (t.focused) { for (const o of this.tabs.values()) if (o.windowId !== t.windowId) o.focused = false; this.browserFocused = true; }
      this.tabs.set(t.tabId, t);
      this.emit("tab", t);
    } else if (m.type === "closed") { this.tabs.delete(m.tabId); this.emit("closed", m.tabId); }
    else if (m.type === "blur") { this.browserFocused = false; for (const o of this.tabs.values()) o.focused = false; }
  }

  /** The tab the person is looking at in the focused browser window, if any. */
  activeTab(): TabInfo | null {
    for (const t of this.tabs.values()) if (t.active && t.focused) return t;
    return null;
  }

  send(cmd: Record<string, unknown>) {
    const s = JSON.stringify(cmd);
    for (const c of this.clients) try { c.send(s); } catch { /* ignore */ }
  }
  hold(tabIds: number[]) { if (tabIds.length) this.send({ cmd: "hold", tabIds }); }
  release(tabIds: number[]) { if (tabIds.length) this.send({ cmd: "release", tabIds }); }
  closeSite(site: string) { this.send({ cmd: "closeSite", site }); }
  config(distractions: string[], passes: Record<string, number>) { this.send({ cmd: "config", distractions, passes }); }
}
