import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "./ipc-channels.js";
import type {
  DirectoryEntry,
  FsNodeEvent,
  IndexProgressPayload,
  IndexCompletePayload,
  SearchResult,
  PdfPageText,
  ContentSearchResult,
} from "./types.js";

/** Helper: subscribe to an IPC event, return unsubscribe fn */
function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const handler = (_: Electron.IpcRendererEvent, payload: T) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld("api", {
  // ── File System — Read ─────────────────────────────────────────────────────
  openDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_DIR),

  readDirectory: (dirPath: string): Promise<DirectoryEntry[]> =>
    ipcRenderer.invoke(IPC.FS_READ_DIR, dirPath),

  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC.FS_READ_FILE, filePath),

  // ── File System — Write ────────────────────────────────────────────────────
  moveFile: (from: string, to: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_MOVE, { from, to }),

  deleteFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_DELETE, filePath),

  createFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_CREATE_FILE, filePath),

  createFolder: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_CREATE_DIR, dirPath),

  // ── Watcher ────────────────────────────────────────────────────────────────
  watchDirectory: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_WATCH_DIR, dirPath),

  unwatchDirectory: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_UNWATCH_DIR, dirPath),

  // Granular FS events
  onFsAdd:       (cb: (p: FsNodeEvent) => void) => on<FsNodeEvent>(IPC.FS_EVENT_ADD, cb),
  onFsAddDir:    (cb: (p: FsNodeEvent) => void) => on<FsNodeEvent>(IPC.FS_EVENT_ADD_DIR, cb),
  onFsRemove:    (cb: (p: FsNodeEvent) => void) => on<FsNodeEvent>(IPC.FS_EVENT_REMOVE, cb),
  onFsRemoveDir: (cb: (p: FsNodeEvent) => void) => on<FsNodeEvent>(IPC.FS_EVENT_REMOVE_DIR, cb),
  onFsChange:    (cb: (p: FsNodeEvent) => void) => on<FsNodeEvent>(IPC.FS_EVENT_CHANGE, cb),

  // ── Indexer ────────────────────────────────────────────────────────────────
  startIndex: (rootPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.INDEX_START, rootPath),

  searchIndex: (query: string, rootPath?: string): Promise<SearchResult[]> =>
    ipcRenderer.invoke(IPC.INDEX_SEARCH, query, rootPath),

  clearIndex: (rootPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.INDEX_CLEAR, rootPath),

  onIndexProgress: (cb: (p: IndexProgressPayload) => void) =>
    on<IndexProgressPayload>(IPC.INDEX_PROGRESS, cb),

  onIndexComplete: (cb: (p: IndexCompletePayload) => void) =>
    on<IndexCompletePayload>(IPC.INDEX_COMPLETE, cb),

  // ── Content (full-text PDF) search ────────────────────────────────────────
  storePdfContent: (filePath: string, name: string, rootPath: string, pages: PdfPageText[]): Promise<void> =>
    ipcRenderer.invoke(IPC.CONTENT_STORE, filePath, name, rootPath, pages),

  searchContent: (query: string, rootPath?: string): Promise<ContentSearchResult[]> =>
    ipcRenderer.invoke(IPC.CONTENT_SEARCH, query, rootPath),

  hasContentIndex: (rootPath: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC.CONTENT_HAS_INDEX, rootPath),

  clearContentIndex: (rootPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.CONTENT_CLEAR, rootPath),

  // ── PDF text extraction ────────────────────────────────────────────────────
  extractPdfText: (filePath: string): Promise<{ page: number; text: string }[]> =>
    ipcRenderer.invoke(IPC.PDF_EXTRACT_TEXT, filePath),

  // ── Shell utilities ────────────────────────────────────────────────────────
  showInFolder: (filePath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.SHELL_SHOW_FILE, filePath),

  // ── Window ─────────────────────────────────────────────────────────────────
  setZoom: (factor: number): Promise<void> =>
    ipcRenderer.invoke(IPC.SET_ZOOM, factor),

  // ── Revision ───────────────────────────────────────────────────────────────
  revision: {
    init: (expedientePath: string, clientesFolder: string | null, revisionesFolder: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC.REVISION_INIT, expedientePath, clientesFolder, revisionesFolder),

    saveMeta: (revisionPath: string, meta: unknown): Promise<void> =>
      ipcRenderer.invoke(IPC.REVISION_SAVE_META, revisionPath, meta),

    loadStep: (revisionPath: string, stepId: string): Promise<unknown> =>
      ipcRenderer.invoke(IPC.REVISION_LOAD_STEP, revisionPath, stepId),

    saveStep: (revisionPath: string, stepId: string, data: unknown): Promise<void> =>
      ipcRenderer.invoke(IPC.REVISION_SAVE_STEP, revisionPath, stepId, data),
  },
});
