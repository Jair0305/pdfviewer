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
  // Watcher control
  FS_WATCH_DIR: "fs:watch-directory",
  FS_UNWATCH_DIR: "fs:unwatch-directory",
  // Granular FS events (main → renderer)
  FS_EVENT_ADD: "fs:event:add",
  FS_EVENT_ADD_DIR: "fs:event:add-dir",
  FS_EVENT_REMOVE: "fs:event:remove",
  FS_EVENT_REMOVE_DIR: "fs:event:remove-dir",
  FS_EVENT_CHANGE: "fs:event:change",
  // Indexer
  INDEX_START: "index:start",
  INDEX_PROGRESS: "index:progress",
  INDEX_COMPLETE: "index:complete",
  INDEX_SEARCH: "index:search",
  INDEX_CLEAR: "index:clear",
  // Content (full-text PDF) search
  CONTENT_STORE: "content:store",
  CONTENT_SEARCH: "content:search",
  CONTENT_HAS_INDEX: "content:has-index",
  CONTENT_CLEAR: "content:clear",
  // PDF text extraction (main process, bypasses renderer worker issues)
  PDF_EXTRACT_TEXT: "pdf:extract-text",
  // Shell utilities
  SHELL_SHOW_FILE: "shell:show-item",
  // Window
  SET_ZOOM: "window:set-zoom",
  // Revision — generic step I/O (no new channels needed when adding future steps)
  REVISION_INIT: "revision:init",
  REVISION_SAVE_META: "revision:save-meta",
  REVISION_LOAD_STEP: "revision:load-step",
  REVISION_SAVE_STEP: "revision:save-step"
};

// electron/preload.ts
function on(channel, cb) {
  const handler = (_, payload) => cb(payload);
  import_electron.ipcRenderer.on(channel, handler);
  return () => import_electron.ipcRenderer.removeListener(channel, handler);
}
import_electron.contextBridge.exposeInMainWorld("api", {
  // ── File System — Read ─────────────────────────────────────────────────────
  openDirectory: () => import_electron.ipcRenderer.invoke(IPC.DIALOG_OPEN_DIR),
  readDirectory: (dirPath) => import_electron.ipcRenderer.invoke(IPC.FS_READ_DIR, dirPath),
  readFile: (filePath) => import_electron.ipcRenderer.invoke(IPC.FS_READ_FILE, filePath),
  // ── File System — Write ────────────────────────────────────────────────────
  moveFile: (from, to) => import_electron.ipcRenderer.invoke(IPC.FS_MOVE, { from, to }),
  deleteFile: (filePath) => import_electron.ipcRenderer.invoke(IPC.FS_DELETE, filePath),
  createFile: (filePath) => import_electron.ipcRenderer.invoke(IPC.FS_CREATE_FILE, filePath),
  createFolder: (dirPath) => import_electron.ipcRenderer.invoke(IPC.FS_CREATE_DIR, dirPath),
  // ── Watcher ────────────────────────────────────────────────────────────────
  watchDirectory: (dirPath) => import_electron.ipcRenderer.invoke(IPC.FS_WATCH_DIR, dirPath),
  unwatchDirectory: (dirPath) => import_electron.ipcRenderer.invoke(IPC.FS_UNWATCH_DIR, dirPath),
  // Granular FS events
  onFsAdd: (cb) => on(IPC.FS_EVENT_ADD, cb),
  onFsAddDir: (cb) => on(IPC.FS_EVENT_ADD_DIR, cb),
  onFsRemove: (cb) => on(IPC.FS_EVENT_REMOVE, cb),
  onFsRemoveDir: (cb) => on(IPC.FS_EVENT_REMOVE_DIR, cb),
  onFsChange: (cb) => on(IPC.FS_EVENT_CHANGE, cb),
  // ── Indexer ────────────────────────────────────────────────────────────────
  startIndex: (rootPath) => import_electron.ipcRenderer.invoke(IPC.INDEX_START, rootPath),
  searchIndex: (query, rootPath) => import_electron.ipcRenderer.invoke(IPC.INDEX_SEARCH, query, rootPath),
  clearIndex: (rootPath) => import_electron.ipcRenderer.invoke(IPC.INDEX_CLEAR, rootPath),
  onIndexProgress: (cb) => on(IPC.INDEX_PROGRESS, cb),
  onIndexComplete: (cb) => on(IPC.INDEX_COMPLETE, cb),
  // ── Content (full-text PDF) search ────────────────────────────────────────
  storePdfContent: (filePath, name, rootPath, pages) => import_electron.ipcRenderer.invoke(IPC.CONTENT_STORE, filePath, name, rootPath, pages),
  searchContent: (query, rootPath) => import_electron.ipcRenderer.invoke(IPC.CONTENT_SEARCH, query, rootPath),
  hasContentIndex: (rootPath) => import_electron.ipcRenderer.invoke(IPC.CONTENT_HAS_INDEX, rootPath),
  clearContentIndex: (rootPath) => import_electron.ipcRenderer.invoke(IPC.CONTENT_CLEAR, rootPath),
  // ── PDF text extraction ────────────────────────────────────────────────────
  extractPdfText: (filePath) => import_electron.ipcRenderer.invoke(IPC.PDF_EXTRACT_TEXT, filePath),
  // ── Shell utilities ────────────────────────────────────────────────────────
  showInFolder: (filePath) => import_electron.ipcRenderer.invoke(IPC.SHELL_SHOW_FILE, filePath),
  // ── Window ─────────────────────────────────────────────────────────────────
  setZoom: (factor) => import_electron.ipcRenderer.invoke(IPC.SET_ZOOM, factor),
  // ── Revision ───────────────────────────────────────────────────────────────
  revision: {
    init: (expedientePath, clientesFolder, revisionesFolder) => import_electron.ipcRenderer.invoke(IPC.REVISION_INIT, expedientePath, clientesFolder, revisionesFolder),
    saveMeta: (revisionPath, meta) => import_electron.ipcRenderer.invoke(IPC.REVISION_SAVE_META, revisionPath, meta),
    loadStep: (revisionPath, stepId) => import_electron.ipcRenderer.invoke(IPC.REVISION_LOAD_STEP, revisionPath, stepId),
    saveStep: (revisionPath, stepId, data) => import_electron.ipcRenderer.invoke(IPC.REVISION_SAVE_STEP, revisionPath, stepId, data)
  }
});
