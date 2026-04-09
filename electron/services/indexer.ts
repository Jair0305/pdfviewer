import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { app } from "electron";

interface IndexedFile {
  name: string;
  path: string;
  extension: string;
  size: number;
  modifiedAt: number;
  rootPath: string;
  depth: number;
}

export interface SearchResult {
  name: string;
  path: string;
  extension: string;
}

// ─── FileIndexer ──────────────────────────────────────────────────────────────

export class FileIndexer {
  private db: Database.Database;
  private insertStmt!: Database.Statement;
  private insertBatch!: Database.Transaction<(rows: IndexedFile[]) => void>;

  constructor() {
    const dbPath = path.join(app.getPath("userData"), "expediente-index.db");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL"); // Better concurrent read performance
    this.db.pragma("synchronous = NORMAL");
    this.init();
  }

  private init() {
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

    this.insertBatch = this.db.transaction((rows: IndexedFile[]) => {
      for (const row of rows) this.insertStmt.run(row);
    });
  }

  /**
   * Recursively index PDF and XML files under rootPath.
   * Calls onProgress every 100 files.
   */
  indexDirectory(
    rootPath: string,
    onProgress?: (count: number) => void,
  ): number {
    let count = 0;
    const BATCH_SIZE = 100;
    const batch: IndexedFile[] = [];

    const flush = () => {
      if (batch.length) {
        this.insertBatch(batch.splice(0));
        onProgress?.(count);
      }
    };

    const scan = (dir: string, depth: number) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return; // skip unreadable dirs
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
          /* ignore */
        }

        batch.push({
          path: fullPath,
          name: entry.name,
          extension: ext,
          size,
          modifiedAt: mtime,
          rootPath,
          depth,
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
  search(query: string, rootPath?: string, limit = 100): SearchResult[] {
    const pattern = `%${query.replace(/[%_]/g, "\\$&")}%`;

    if (rootPath) {
      return this.db
        .prepare(
          `SELECT name, path, extension FROM indexed_files
           WHERE name LIKE ? ESCAPE '\\' AND root_path = ?
           ORDER BY name ASC LIMIT ?`,
        )
        .all(pattern, rootPath, limit) as SearchResult[];
    }

    return this.db
      .prepare(
        `SELECT name, path, extension FROM indexed_files
         WHERE name LIKE ? ESCAPE '\\'
         ORDER BY name ASC LIMIT ?`,
      )
      .all(pattern, limit) as SearchResult[];
  }

  /** Remove all indexed files under rootPath. */
  clearRoot(rootPath: string): void {
    this.db
      .prepare(`DELETE FROM indexed_files WHERE root_path = ?`)
      .run(rootPath);
  }

  /** Total file count for a root. */
  countRoot(rootPath: string): number {
    const row = this.db
      .prepare(`SELECT COUNT(*) as n FROM indexed_files WHERE root_path = ?`)
      .get(rootPath) as { n: number };
    return row.n;
  }

  close() {
    this.db.close();
  }
}
