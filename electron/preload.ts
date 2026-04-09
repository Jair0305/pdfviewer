import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "./ipc-channels.js";
import type { DirectoryEntry, WatchEvent, IndexProgressPayload, IndexCompletePayload, SearchResult } from "./types.js";

contextBridge.exposeInMainWorld("api", {
  // ── File System ─────────────────────────────────────────────────────────────
  openDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_DIR),

  readDirectory: (dirPath: string): Promise<DirectoryEntry[]> =>
    ipcRenderer.invoke(IPC.FS_READ_DIR, dirPath),

  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC.FS_READ_FILE, filePath),

  // ── FS Write ────────────────────────────────────────────────────────────────
  moveFile: (from: string, to: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_MOVE, { from, to }),

  deleteFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_DELETE, filePath),

  createFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_CREATE_FILE, filePath),

  createFolder: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_CREATE_DIR, dirPath),

  // ── Watcher ─────────────────────────────────────────────────────────────────
  watchDirectory: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_WATCH_DIR, dirPath),

  unwatchDirectory: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_UNWATCH_DIR, dirPath),

  onFileChange: (callback: (payload: WatchEvent) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: WatchEvent) => callback(payload);
    ipcRenderer.on(IPC.FS_WATCH_EVENT, handler);
    return () => ipcRenderer.removeListener(IPC.FS_WATCH_EVENT, handler);
  },

  // ── Indexer ─────────────────────────────────────────────────────────────────
  startIndex: (rootPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.INDEX_START, rootPath),

  searchIndex: (query: string): Promise<SearchResult[]> =>
    ipcRenderer.invoke(IPC.INDEX_SEARCH, query),

  clearIndex: (rootPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.INDEX_CLEAR, rootPath),

  onIndexProgress: (callback: (payload: IndexProgressPayload) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: IndexProgressPayload) => callback(payload);
    ipcRenderer.on(IPC.INDEX_PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC.INDEX_PROGRESS, handler);
  },

  onIndexComplete: (callback: (payload: IndexCompletePayload) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, payload: IndexCompletePayload) => callback(payload);
    ipcRenderer.on(IPC.INDEX_COMPLETE, handler);
    return () => ipcRenderer.removeListener(IPC.INDEX_COMPLETE, handler);
  },
});
