import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { app } from "electron";
import type { PdfPageText } from "../types.js";

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

export interface ContentSearchResult {
  path: string;
  name: string;
  page: number;
  snippet: string;
}

export type { PdfPageText };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize text for search: remove diacritics + lowercase. */
function normText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Extract a readable snippet from `original` centered around the first
 * occurrence of `termNorm` in `normalized`. Wraps the match with [[...]].
 */
function buildSnippet(original: string, normalized: string, termNorm: string): string {
  const pos = normalized.indexOf(termNorm);
  if (pos === -1) return original.slice(0, 200) + (original.length > 200 ? "…" : "");

  const BEFORE = 80;
  const AFTER  = 140;
  const start  = Math.max(0, pos - BEFORE);
  const end    = Math.min(original.length, pos + termNorm.length + AFTER);

  const prefix  = start > 0 ? "…" : "";
  const suffix  = end < original.length ? "…" : "";
  const chunk   = original.slice(start, end);

  // Find the match inside the chunk (same offset relative to start)
  const chunkNorm   = normalized.slice(start, end);
  const matchInChunk = chunkNorm.indexOf(termNorm);
  if (matchInChunk === -1) return prefix + chunk + suffix;

  const before = chunk.slice(0, matchInChunk);
  const match  = chunk.slice(matchInChunk, matchInChunk + termNorm.length);
  const after  = chunk.slice(matchInChunk + termNorm.length);
  return prefix + before + "[[" + match + "]]" + after + suffix;
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

    // Migrate old FTS5 pdf_content table → regular table with content_norm column.
    // If `content_norm` column doesn't exist, the table is stale — drop & recreate.
    try {
      this.db.prepare(`SELECT content_norm FROM pdf_content LIMIT 1`).get();
    } catch {
      this.db.exec(`DROP TABLE IF EXISTS pdf_content`);
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pdf_content (
        path         TEXT NOT NULL,
        name         TEXT NOT NULL,
        root_path    TEXT NOT NULL,
        page         INTEGER NOT NULL,
        content      TEXT NOT NULL,
        content_norm TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pdfcontent_root ON pdf_content (root_path);
      CREATE INDEX IF NOT EXISTS idx_pdfcontent_path ON pdf_content (path);
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

  // ─── Content (full-text PDF) methods ─────────────────────────────────────

  /** Store extracted text pages for one PDF. Replaces any existing data for that path. */
  storePdfContent(filePath: string, name: string, rootPath: string, pages: PdfPageText[]): void {
    this.db.prepare(`DELETE FROM pdf_content WHERE path = ?`).run(filePath);
    const ins = this.db.prepare(
      `INSERT INTO pdf_content (path, name, root_path, page, content, content_norm)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const batch = this.db.transaction((rows: PdfPageText[]) => {
      for (const row of rows) {
        const trimmed = row.text.trim();
        if (trimmed.length === 0) continue;
        ins.run(filePath, name, rootPath, row.page, trimmed, normText(trimmed));
      }
    });
    batch(pages);
  }

  /**
   * Search PDF content using LIKE on the normalized text column.
   * All query terms must appear (AND logic). Returns results with highlighted snippets.
   */
  searchContent(query: string, rootPath?: string, limit = 50): ContentSearchResult[] {
    if (!query.trim()) return [];

    const terms = query
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => normText(t));

    if (terms.length === 0) return [];

    const patterns = terms.map((t) => `%${t.replace(/[%_\\]/g, "\\$&")}%`);

    // Build: content_norm LIKE ? AND content_norm LIKE ? ...
    const likeClauses = terms.map(() => `content_norm LIKE ? ESCAPE '\\'`).join(" AND ");
    const rootClause  = rootPath ? ` AND root_path = ?` : "";
    const params: unknown[] = [...patterns, ...(rootPath ? [rootPath] : []), limit];

    try {
      const rows = this.db
        .prepare(
          `SELECT path, name, page, content, content_norm
           FROM pdf_content
           WHERE ${likeClauses}${rootClause}
           ORDER BY path, page
           LIMIT ?`,
        )
        .all(...params) as { path: string; name: string; page: number; content: string; content_norm: string }[];

      return rows.map((row) => ({
        path:    row.path,
        name:    row.name,
        page:    row.page,
        snippet: buildSnippet(row.content, row.content_norm, terms[0]),
      }));
    } catch {
      return [];
    }
  }

  /** True if this root has any content indexed. */
  hasContentIndex(rootPath: string): boolean {
    const row = this.db
      .prepare(`SELECT COUNT(*) AS n FROM pdf_content WHERE root_path = ?`)
      .get(rootPath) as { n: number };
    return row.n > 0;
  }

  /** Delete all content for a root (call before re-indexing). */
  clearContent(rootPath: string): void {
    this.db.prepare(`DELETE FROM pdf_content WHERE root_path = ?`).run(rootPath);
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
