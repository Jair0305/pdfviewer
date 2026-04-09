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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

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

  // ── File System ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.FS_READ_DIR, async (_e, dirPath: string) => {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => !e.name.startsWith("."))
        .map((e) => ({
          name: e.name,
          path: path.join(dirPath, e.name),
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

  // ── FS Write Operations ─────────────────────────────────────────────────────
  ipcMain.handle(IPC.FS_MOVE, async (_e, { from, to }: { from: string; to: string }) => {
    fs.renameSync(from, to);
  });

  ipcMain.handle(IPC.FS_DELETE, async (_e, filePath: string) => {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
  });

  ipcMain.handle(IPC.FS_CREATE_FILE, async (_e, filePath: string) => {
    fs.writeFileSync(filePath, "");
  });

  ipcMain.handle(IPC.FS_CREATE_DIR, async (_e, dirPath: string) => {
    fs.mkdirSync(dirPath, { recursive: true });
  });

  // ── Watcher ─────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.FS_WATCH_DIR, async (event, dirPath: string) => {
    watchers.get(dirPath)?.close();
    const w = chokidar.watch(dirPath, {
      ignoreInitial: true,
      ignored: /(^|[/\\])\../,
      persistent: true,
    });
    w.on("all", (ev, fp) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC.FS_WATCH_EVENT, { event: ev, path: fp });
      }
    });
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

    // Run indexing asynchronously to not block the main thread
    setImmediate(() => {
      let count = 0;
      try {
        count = idx.indexDirectory(rootPath, (n) => {
          if (!event.sender.isDestroyed()) {
            event.sender.send(IPC.INDEX_PROGRESS, { indexed: n, rootPath });
          }
        });
      } catch (err) {
        console.error("Indexer error:", err);
      }
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC.INDEX_COMPLETE, { total: count, rootPath });
      }
    });
  });

  ipcMain.handle(IPC.INDEX_SEARCH, async (_e, query: string) => {
    try {
      return getIndexer().search(query);
    } catch {
      return [];
    }
  });

  ipcMain.handle(IPC.INDEX_CLEAR, async (_e, rootPath: string) => {
    getIndexer().clearRoot(rootPath);
  });
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
