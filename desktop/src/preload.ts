import { contextBridge, ipcRenderer } from "electron";

/** The only surface the orb page (and the tray settings page) can reach. */
contextBridge.exposeInMainWorld("synapse", {
  on: (fn: (m: unknown) => void) => { ipcRenderer.on("orb", (_e, m) => fn(m)); },
  onSettings: (fn: (m: unknown) => void) => { ipcRenderer.on("settings", (_e, m) => fn(m)); },
  peek: (on: boolean) => ipcRenderer.send("orb:peek", on),
  ignoreMouse: (on: boolean) => ipcRenderer.send("orb:ignore-mouse", on),
  size: (w: number, h: number) => ipcRenderer.send("orb:size", { w, h }),
  openAsk: () => ipcRenderer.send("orb:open-ask"),
  close: () => ipcRenderer.send("orb:close"),
  ask: (text: string, share: boolean) => ipcRenderer.invoke("orb:ask", text, share),
  setShare: (on: boolean) => ipcRenderer.send("orb:set-share", on),
  argue: (text: string) => ipcRenderer.send("gate:argue", text),
  timeout: () => ipcRenderer.send("gate:timeout"),
  gateTyping: (on: boolean) => ipcRenderer.send("gate:typing", on),
  leave: () => ipcRenderer.send("gate:leave"),
  endPass: () => ipcRenderer.send("pass:end"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (s: unknown) => ipcRenderer.invoke("settings:set", s),
  openHelperFolder: () => ipcRenderer.send("settings:open-helper"),
});
