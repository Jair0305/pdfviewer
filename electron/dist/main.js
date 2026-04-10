// electron/main.ts
import {
  app as app2,
  BrowserWindow,
  ipcMain,
  dialog,
  shell
} from "electron";
import path3 from "path";
import fs3 from "fs";
import { fileURLToPath } from "url";
import chokidar from "chokidar";

// electron/services/indexer.ts
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { app } from "electron";
var FileIndexer = class {
  constructor() {
    const dbPath = path.join(app.getPath("userData"), "expediente-index.db");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.init();
  }
  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS indexed_files (
        path       TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        extension  TEXT NOT NULL DEFAULT '',
        size       INTEGER NOT NULL DEFAULT 0,
        modified_at INTEGER NOT NULL DEFAULT 0,
        root_path  TEXT NOT NULL,
        depth      INTEGER NOT NULL DEFAULT 0,
        indexed_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_name ON indexed_files (name COLLATE NOCASE);
      CREATE INDEX IF NOT EXISTS idx_root ON indexed_files (root_path);
      CREATE INDEX IF NOT EXISTS idx_ext  ON indexed_files (extension);
    `);
    this.insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO indexed_files
        (path, name, extension, size, modified_at, root_path, depth)
      VALUES
        (@path, @name, @extension, @size, @modifiedAt, @rootPath, @depth)
    `);
    this.insertBatch = this.db.transaction((rows) => {
      for (const row of rows) this.insertStmt.run(row);
    });
  }
  /**
   * Recursively index PDF and XML files under rootPath.
   * Calls onProgress every 100 files.
   */
  indexDirectory(rootPath, onProgress) {
    let count = 0;
    const BATCH_SIZE = 100;
    const batch = [];
    const flush = () => {
      if (batch.length) {
        this.insertBatch(batch.splice(0));
        onProgress?.(count);
      }
    };
    const scan = (dir, depth) => {
      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath, depth + 1);
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (ext !== ".pdf" && ext !== ".xml") continue;
        let size = 0;
        let mtime = 0;
        try {
          const stat = fs.statSync(fullPath);
          size = stat.size;
          mtime = Math.floor(stat.mtimeMs);
        } catch {
        }
        batch.push({
          path: fullPath,
          name: entry.name,
          extension: ext,
          size,
          modifiedAt: mtime,
          rootPath,
          depth
        });
        count++;
        if (batch.length >= BATCH_SIZE) flush();
      }
    };
    scan(rootPath, 0);
    flush();
    return count;
  }
  /** Full-text search by filename (case-insensitive, partial match). */
  search(query, rootPath, limit = 100) {
    const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`;
    if (rootPath) {
      return this.db.prepare(
        `SELECT name, path, extension FROM indexed_files
           WHERE name LIKE ? ESCAPE '\\' AND root_path = ?
           ORDER BY name ASC LIMIT ?`
      ).all(pattern, rootPath, limit);
    }
    return this.db.prepare(
      `SELECT name, path, extension FROM indexed_files
         WHERE name LIKE ? ESCAPE '\\'
         ORDER BY name ASC LIMIT ?`
    ).all(pattern, limit);
  }
  /** Remove all indexed files under rootPath. */
  clearRoot(rootPath) {
    this.db.prepare(`DELETE FROM indexed_files WHERE root_path = ?`).run(rootPath);
  }
  /** Total file count for a root. */
  countRoot(rootPath) {
    const row = this.db.prepare(`SELECT COUNT(*) as n FROM indexed_files WHERE root_path = ?`).get(rootPath);
    return row.n;
  }
  close() {
    this.db.close();
  }
};

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
  INDEX_CLEAR: "index:clear"
};

// electron/services/filesystem.ts
import fs2 from "fs";
import fsp from "fs/promises";
import path2 from "path";
var FsError = class extends Error {
  constructor(message, code, filePath) {
    super(message);
    this.code = code;
    this.filePath = filePath;
    this.name = "FsError";
  }
};
var inFlight = /* @__PURE__ */ new Set();
function lockPath(p) {
  const key = path2.normalize(p).toLowerCase();
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
}
function unlockPath(p) {
  inFlight.delete(path2.normalize(p).toLowerCase());
}
async function withLock(filePath, fn) {
  if (!lockPath(filePath)) {
    throw new FsError(
      `[FS ERROR] Operation already in progress: ${filePath}`,
      "EBUSY",
      filePath
    );
  }
  try {
    return await fn();
  } finally {
    unlockPath(filePath);
  }
}
function validatePath(filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new FsError(`[FS ERROR] Invalid path: ${String(filePath)}`, "EINVAL", String(filePath));
  }
  if (filePath.includes("\0")) {
    throw new FsError(`[FS ERROR] Path contains null byte`, "EINVAL", filePath);
  }
}
async function moveFile(from, to) {
  validatePath(from);
  validatePath(to);
  return withLock(from, async () => {
    console.log(`[FS ACTION] move: ${from} \u2192 ${to}`);
    if (!fs2.existsSync(from)) {
      throw new FsError(`[FS ERROR] Source not found: ${from}`, "ENOENT", from);
    }
    try {
      await fsp.rename(from, to);
    } catch (err) {
      if (err.code === "EXDEV" || err.code === "EPERM") {
        console.log(`[FS ACTION] rename failed (${err.code}), falling back to copy+unlink`);
        await fsp.copyFile(from, to);
        await fsp.unlink(from);
      } else {
        console.error(`[FS ERROR] move: ${err.message}`);
        throw err;
      }
    }
    console.log(`[FS ACTION] move complete: ${from} \u2192 ${to}`);
  });
}
async function deleteFile(filePath) {
  validatePath(filePath);
  return withLock(filePath, async () => {
    console.log(`[FS ACTION] delete: ${filePath}`);
    let stat;
    try {
      stat = fs2.statSync(filePath);
    } catch (err) {
      if (err.code === "ENOENT") {
        console.log(`[FS ACTION] delete: already gone: ${filePath}`);
        return;
      }
      throw err;
    }
    if (stat.isDirectory()) {
      await fsp.rm(filePath, { recursive: true, force: true });
    } else {
      await fsp.unlink(filePath);
    }
    console.log(`[FS ACTION] delete complete: ${filePath}`);
  });
}
async function createFile(filePath) {
  validatePath(filePath);
  console.log(`[FS ACTION] create file: ${filePath}`);
  await fsp.writeFile(filePath, "");
}
async function createDirectory(dirPath) {
  validatePath(dirPath);
  console.log(`[FS ACTION] create dir: ${dirPath}`);
  await fsp.mkdir(dirPath, { recursive: true });
}

// electron/main.ts
var __dirname = path3.dirname(fileURLToPath(import.meta.url));
var isDev = !app2.isPackaged;
function norm(p) {
  return p.replace(/\\/g, "/");
}
function makeFsNodeEvent(fp) {
  const normalized = norm(fp);
  const parentPath = normalized.substring(0, normalized.lastIndexOf("/"));
  const name = normalized.substring(normalized.lastIndexOf("/") + 1);
  return { path: normalized, parentPath, name };
}
var indexer = null;
var watchers = /* @__PURE__ */ new Map();
function getIndexer() {
  if (!indexer) indexer = new FileIndexer();
  return indexer;
}
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: "#09090b",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path3.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (isDev) {
    win.loadURL("http://localhost:3000");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path3.join(__dirname, "../../out/index.html"));
  }
  win.once("ready-to-show", () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  return win;
}
function registerHandlers() {
  ipcMain.handle(IPC.DIALOG_OPEN_DIR, async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Seleccionar expediente",
      buttonLabel: "Abrir expediente"
    });
    return canceled ? null : filePaths[0] ?? null;
  });
  ipcMain.handle(IPC.FS_READ_DIR, async (_e, dirPath) => {
    try {
      const entries = fs3.readdirSync(dirPath, { withFileTypes: true });
      return entries.filter((e) => !e.name.startsWith(".")).map((e) => ({
        name: e.name,
        // Always return forward-slash paths so the renderer is consistent
        path: norm(path3.join(dirPath, e.name)),
        type: e.isDirectory() ? "directory" : "file",
        extension: e.isFile() ? path3.extname(e.name).toLowerCase() : void 0
      })).sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
        return a.name.localeCompare(b.name, "es", { numeric: true });
      });
    } catch {
      return [];
    }
  });
  ipcMain.handle(IPC.FS_READ_FILE, async (_e, filePath) => {
    const buf = fs3.readFileSync(filePath);
    return buf.toString("base64");
  });
  ipcMain.handle(IPC.FS_MOVE, async (_e, { from, to }) => {
    await moveFile(from, to);
  });
  ipcMain.handle(IPC.FS_DELETE, async (_e, filePath) => {
    await deleteFile(filePath);
  });
  ipcMain.handle(IPC.FS_CREATE_FILE, async (_e, filePath) => {
    await createFile(filePath);
  });
  ipcMain.handle(IPC.FS_CREATE_DIR, async (_e, dirPath) => {
    await createDirectory(dirPath);
  });
  ipcMain.handle(IPC.FS_WATCH_DIR, async (event, dirPath) => {
    await watchers.get(dirPath)?.close();
    const w = chokidar.watch(dirPath, {
      ignoreInitial: true,
      ignored: /(^|[/\\])\../,
      persistent: true,
      // Stabilize events: wait for file to stop changing before firing
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 }
    });
    const send = (channel, fp) => {
      if (event.sender.isDestroyed()) return;
      const payload = makeFsNodeEvent(fp);
      console.log(`[FS EVENT] ${channel}: ${payload.path}`);
      event.sender.send(channel, payload);
    };
    w.on("add", (fp) => send(IPC.FS_EVENT_ADD, fp));
    w.on("addDir", (fp) => {
      if (norm(fp) === norm(dirPath)) return;
      send(IPC.FS_EVENT_ADD_DIR, fp);
    });
    w.on("unlink", (fp) => send(IPC.FS_EVENT_REMOVE, fp));
    w.on("unlinkDir", (fp) => send(IPC.FS_EVENT_REMOVE_DIR, fp));
    w.on("change", (fp) => send(IPC.FS_EVENT_CHANGE, fp));
    w.on("error", (err) => console.error("[FS ERROR] chokidar:", err));
    watchers.set(dirPath, w);
  });
  ipcMain.handle(IPC.FS_UNWATCH_DIR, async (_e, dirPath) => {
    await watchers.get(dirPath)?.close();
    watchers.delete(dirPath);
  });
  ipcMain.handle(IPC.INDEX_START, async (event, rootPath) => {
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
  ipcMain.handle(IPC.INDEX_SEARCH, async (_e, query) => {
    try {
      return getIndexer().search(query);
    } catch {
      return [];
    }
  });
  ipcMain.handle(IPC.INDEX_CLEAR, async (_e, rootPath) => {
    getIndexer().clearRoot(rootPath);
  });
}
app2.whenReady().then(() => {
  registerHandlers();
  createWindow();
  app2.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app2.on("window-all-closed", () => {
  for (const w of watchers.values()) w.close();
  indexer?.close();
  if (process.platform !== "darwin") app2.quit();
});
