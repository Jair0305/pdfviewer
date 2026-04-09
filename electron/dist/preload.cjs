"use strict";

// electron/preload.ts
var import_electron = require("electron");

// electron/ipc-channels.ts
var IPC = {
  // File system — read
  DIALOG_OPEN_DIR: "dialog:open-directory",
  FS_READ_DIR: "fs:read-directory",
  FS_READ_FILE: "fs:read-file",
  // File system — write
  FS_MOVE: "fs:move",
  FS_DELETE: "fs:delete",
  FS_CREATE_FILE: "fs:create-file",
  FS_CREATE_DIR: "fs:create-dir",
  // Watcher
  FS_WATCH_DIR: "fs:watch-directory",
  FS_UNWATCH_DIR: "fs:unwatch-directory",
  FS_WATCH_EVENT: "fs:watch-event",
  // Indexer
  INDEX_START: "index:start",
  INDEX_PROGRESS: "index:progress",
  INDEX_COMPLETE: "index:complete",
  INDEX_SEARCH: "index:search",
  INDEX_CLEAR: "index:clear"
};

// electron/preload.ts
import_electron.contextBridge.exposeInMainWorld("api", {
  // ── File System ─────────────────────────────────────────────────────────────
  openDirectory: () => import_electron.ipcRenderer.invoke(IPC.DIALOG_OPEN_DIR),
  readDirectory: (dirPath) => import_electron.ipcRenderer.invoke(IPC.FS_READ_DIR, dirPath),
  readFile: (filePath) => import_electron.ipcRenderer.invoke(IPC.FS_READ_FILE, filePath),
  // ── FS Write ────────────────────────────────────────────────────────────────
  moveFile: (from, to) => import_electron.ipcRenderer.invoke(IPC.FS_MOVE, { from, to }),
  deleteFile: (filePath) => import_electron.ipcRenderer.invoke(IPC.FS_DELETE, filePath),
  createFile: (filePath) => import_electron.ipcRenderer.invoke(IPC.FS_CREATE_FILE, filePath),
  createFolder: (dirPath) => import_electron.ipcRenderer.invoke(IPC.FS_CREATE_DIR, dirPath),
  // ── Watcher ─────────────────────────────────────────────────────────────────
  watchDirectory: (dirPath) => import_electron.ipcRenderer.invoke(IPC.FS_WATCH_DIR, dirPath),
  unwatchDirectory: (dirPath) => import_electron.ipcRenderer.invoke(IPC.FS_UNWATCH_DIR, dirPath),
  onFileChange: (callback) => {
    const handler = (_, payload) => callback(payload);
    import_electron.ipcRenderer.on(IPC.FS_WATCH_EVENT, handler);
    return () => import_electron.ipcRenderer.removeListener(IPC.FS_WATCH_EVENT, handler);
  },
  // ── Indexer ─────────────────────────────────────────────────────────────────
  startIndex: (rootPath) => import_electron.ipcRenderer.invoke(IPC.INDEX_START, rootPath),
  searchIndex: (query) => import_electron.ipcRenderer.invoke(IPC.INDEX_SEARCH, query),
  clearIndex: (rootPath) => import_electron.ipcRenderer.invoke(IPC.INDEX_CLEAR, rootPath),
  onIndexProgress: (callback) => {
    const handler = (_, payload) => callback(payload);
    import_electron.ipcRenderer.on(IPC.INDEX_PROGRESS, handler);
    return () => import_electron.ipcRenderer.removeListener(IPC.INDEX_PROGRESS, handler);
  },
  onIndexComplete: (callback) => {
    const handler = (_, payload) => callback(payload);
    import_electron.ipcRenderer.on(IPC.INDEX_COMPLETE, handler);
    return () => import_electron.ipcRenderer.removeListener(IPC.INDEX_COMPLETE, handler);
  }
});
