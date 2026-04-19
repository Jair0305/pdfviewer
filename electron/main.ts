import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
} from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import chokidar from "chokidar";
import { FileIndexer } from "./services/indexer.js";
import { IPC } from "./ipc-channels.js";
import * as fsService from "./services/filesystem.js";
import * as revisionService from "./services/revision.js";
import { extractPdfPages } from "./services/pdfextractor.js";
import type { FsNodeEvent, PdfPageText } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize to forward slashes for consistent cross-platform paths. */
function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

function makeFsNodeEvent(fp: string): FsNodeEvent {
  const normalized = norm(fp);
  const parentPath = normalized.substring(0, normalized.lastIndexOf("/"));
  const name = normalized.substring(normalized.lastIndexOf("/") + 1);
  return { path: normalized, parentPath, name };
}

// ─── Singletons ───────────────────────────────────────────────────────────────

let indexer: FileIndexer | null = null;
const watchers = new Map<string, ReturnType<typeof chokidar.watch>>();

function getIndexer(): FileIndexer {
  if (!indexer) indexer = new FileIndexer();
  return indexer;
}

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: "#09090b",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../../out/index.html"));
  }

  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return win;
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerHandlers() {
  // ── Dialog ──────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.DIALOG_OPEN_DIR, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Seleccionar expediente",
      buttonLabel: "Abrir expediente",
    });
    return canceled ? null : (filePaths[0] ?? null);
  });

  // ── File System — Read ───────────────────────────────────────────────────────
  ipcMain.handle(IPC.FS_READ_DIR, async (_e, dirPath: string) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => !e.name.startsWith("."))
        .map((e) => ({
          name: e.name,
          // Always return forward-slash paths so the renderer is consistent
          path: norm(path.join(dirPath, e.name)),
          type: e.isDirectory() ? "directory" : "file",
          extension: e.isFile() ? path.extname(e.name).toLowerCase() : undefined,
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
          return a.name.localeCompare(b.name, "es", { numeric: true });
        });
    } catch {
      return [];
    }
  });

  ipcMain.handle(IPC.FS_READ_FILE, async (_e, filePath: string) => {
    const buf = fs.readFileSync(filePath);
    return buf.toString("base64");
  });

  // ── File System — Write ──────────────────────────────────────────────────────
  ipcMain.handle(IPC.FS_MOVE, async (_e, { from, to }: { from: string; to: string }) => {
    await fsService.moveFile(from, to);
  });

  ipcMain.handle(IPC.FS_DELETE, async (_e, filePath: string) => {
    await fsService.deleteFile(filePath);
  });

  ipcMain.handle(IPC.FS_CREATE_FILE, async (_e, filePath: string) => {
    await fsService.createFile(filePath);
  });

  ipcMain.handle(IPC.FS_CREATE_DIR, async (_e, dirPath: string) => {
    await fsService.createDirectory(dirPath);
  });

  // ── Watcher ─────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.FS_WATCH_DIR, async (event, dirPath: string) => {
    // Close existing watcher for this path
    await watchers.get(dirPath)?.close();

    const w = chokidar.watch(dirPath, {
      ignoreInitial: true,
      ignored: /(^|[/\\])\../,
      persistent: true,
      // Stabilize events: wait for file to stop changing before firing
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    });

    const send = (channel: string, fp: string) => {
      if (event.sender.isDestroyed()) return;
      const payload = makeFsNodeEvent(fp);
      console.log(`[FS EVENT] ${channel}: ${payload.path}`);
      event.sender.send(channel, payload);
    };

    w.on("add",       (fp) => send(IPC.FS_EVENT_ADD, fp));
    w.on("addDir",    (fp) => {
      // Skip the root dir itself (fired on watch start with ignoreInitial:false)
      if (norm(fp) === norm(dirPath)) return;
      send(IPC.FS_EVENT_ADD_DIR, fp);
    });
    w.on("unlink",    (fp) => send(IPC.FS_EVENT_REMOVE, fp));
    w.on("unlinkDir", (fp) => send(IPC.FS_EVENT_REMOVE_DIR, fp));
    w.on("change",    (fp) => send(IPC.FS_EVENT_CHANGE, fp));
    w.on("error",     (err) => console.error("[FS ERROR] chokidar:", err));

    watchers.set(dirPath, w);
  });

  ipcMain.handle(IPC.FS_UNWATCH_DIR, async (_e, dirPath: string) => {
    await watchers.get(dirPath)?.close();
    watchers.delete(dirPath);
  });

  // ── Indexer ─────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.INDEX_START, async (event, rootPath: string) => {
    const idx = getIndexer();
    idx.clearRoot(rootPath);

    setImmediate(() => {
      let count = 0;
      try {
        count = idx.indexDirectory(rootPath, (n) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC.INDEX_PROGRESS, { indexed: n, rootPath });
          }
        });
      } catch (err) {
        console.error("[FS ERROR] Indexer:", err);
      }
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC.INDEX_COMPLETE, { total: count, rootPath });
      }
    });
  });

  ipcMain.handle(IPC.INDEX_SEARCH, async (_e, query: string, rootPath?: string) => {
    try {
      return getIndexer().search(query, rootPath);
    } catch {
      return [];
    }
  });

  ipcMain.handle(IPC.INDEX_CLEAR, async (_e, rootPath: string) => {
    getIndexer().clearRoot(rootPath);
  });

  // ── Content (full-text PDF) search ─────────────────────────────────────────
  ipcMain.handle(
    IPC.CONTENT_STORE,
    (_e, filePath: string, name: string, rootPath: string, pages: PdfPageText[]) => {
      try {
        getIndexer().storePdfContent(filePath, name, rootPath, pages);
      } catch (err) {
        console.error("[CONTENT ERROR] store:", err);
      }
    },
  );

  ipcMain.handle(IPC.CONTENT_SEARCH, (_e, query: string, rootPath?: string) => {
    try {
      return getIndexer().searchContent(query, rootPath);
    } catch {
      return [];
    }
  });

  ipcMain.handle(IPC.CONTENT_HAS_INDEX, (_e, rootPath: string) => {
    try {
      return getIndexer().hasContentIndex(rootPath);
    } catch {
      return false;
    }
  });

  ipcMain.handle(IPC.CONTENT_CLEAR, (_e, rootPath: string) => {
    try {
      getIndexer().clearContent(rootPath);
    } catch (err) {
      console.error("[CONTENT ERROR] clear:", err);
    }
  });

  // ── PDF text extraction ──────────────────────────────────────────────────────
  ipcMain.handle(IPC.PDF_EXTRACT_TEXT, async (_e, filePath: string) => {
    try {
      return await extractPdfPages(filePath);
    } catch (err) {
      console.error("[PDF EXTRACT] Error:", filePath, err);
      throw err;
    }
  });

  // ── Shell utilities ─────────────────────────────────────────────────────────
  ipcMain.handle(IPC.SHELL_SHOW_FILE, (_e, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle(IPC.SET_ZOOM, (e, factor: number) => {
    const clamped = Math.min(Math.max(factor, 0.5), 2.0);
    e.sender.setZoomFactor(clamped);
  });

  // ── Revision ─────────────────────────────────────────────────────────────────
  ipcMain.handle(
    IPC.REVISION_INIT,
    async (
      _e,
      expedientePath: string,
      clientesFolder: string | null,
      revisionesFolder: string,
    ) => {
      try {
        return await revisionService.init(expedientePath, clientesFolder, revisionesFolder);
      } catch (err) {
        console.error("[REVISION ERROR] init:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    IPC.REVISION_SAVE_META,
    async (_e, revisionPath: string, meta: unknown) => {
      try {
        await revisionService.saveMeta(revisionPath, meta as Parameters<typeof revisionService.saveMeta>[1]);
      } catch (err) {
        console.error("[REVISION ERROR] saveMeta:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    IPC.REVISION_LOAD_STEP,
    async (_e, revisionPath: string, stepId: string) => {
      try {
        return await revisionService.loadStepData(revisionPath, stepId);
      } catch (err) {
        console.error("[REVISION ERROR] loadStep:", err);
        return null;
      }
    },
  );

  ipcMain.handle(
    IPC.REVISION_SAVE_STEP,
    async (_e, revisionPath: string, stepId: string, data: unknown) => {
      try {
        await revisionService.saveStepData(revisionPath, stepId, data);
      } catch (err) {
        console.error("[REVISION ERROR] saveStep:", err);
        throw err;
      }
    },
  );
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  registerHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  for (const w of watchers.values()) w.close();
  indexer?.close();
  if (process.platform !== "darwin") app.quit();
});
