export {};

import type { RevisionMeta } from "./revision";

export type RevisionInitResult =
  | { status: "ok";             meta: RevisionMeta }
  | { status: "path_updated";   meta: RevisionMeta; previousPath: string }
  | { status: "name_collision"; meta: RevisionMeta; conflictPath: string };

export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  extension?: string;
}

/** Granular filesystem event payload (main → renderer) */
export interface FsNodeEvent {
  /** Absolute path, always forward slashes */
  path: string;
  /** Parent directory path, always forward slashes */
  parentPath: string;
  /** Basename of the file/folder */
  name: string;
}

export interface IndexProgressPayload {
  indexed: number;
  rootPath: string;
}

export interface IndexCompletePayload {
  total: number;
  rootPath: string;
}

export interface SearchResult {
  name: string;
  path: string;
  extension: string;
}

export interface PdfPageText {
  page: number;
  text: string;
}

export interface ContentSearchResult {
  path: string;
  name: string;
  page: number;
  /** Text with [[...]] markers around matched terms */
  snippet: string;
}

export interface ElectronAPI {
  // File system — read
  openDirectory(): Promise<string | null>;
  readDirectory(dirPath: string): Promise<DirectoryEntry[]>;
  readFile(filePath: string): Promise<string>; // base64

  // File system — write
  moveFile(from: string, to: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  createFile(path: string): Promise<void>;
  createFolder(path: string): Promise<void>;

  // Watcher control
  watchDirectory(dirPath: string): Promise<void>;
  unwatchDirectory(dirPath: string): Promise<void>;

  // Granular FS events
  onFsAdd(callback: (payload: FsNodeEvent) => void): () => void;
  onFsAddDir(callback: (payload: FsNodeEvent) => void): () => void;
  onFsRemove(callback: (payload: FsNodeEvent) => void): () => void;
  onFsRemoveDir(callback: (payload: FsNodeEvent) => void): () => void;
  onFsChange(callback: (payload: FsNodeEvent) => void): () => void;

  // Indexer
  startIndex(rootPath: string): Promise<void>;
  searchIndex(query: string, rootPath?: string): Promise<SearchResult[]>;
  clearIndex(rootPath: string): Promise<void>;
  onIndexProgress(callback: (payload: IndexProgressPayload) => void): () => void;
  onIndexComplete(callback: (payload: IndexCompletePayload) => void): () => void;

  // Content (full-text PDF) search
  storePdfContent(filePath: string, name: string, rootPath: string, pages: PdfPageText[]): Promise<void>;
  searchContent(query: string, rootPath?: string): Promise<ContentSearchResult[]>;
  hasContentIndex(rootPath: string): Promise<boolean>;
  clearContentIndex(rootPath: string): Promise<void>;

  // PDF text extraction (runs in main process — no worker issues)
  extractPdfText(filePath: string): Promise<PdfPageText[]>;

  // Shell utilities
  showInFolder(filePath: string): Promise<void>;

  // Revision — generic step I/O
  revision: {
    /**
     * Creates / loads the revision for an expediente.
     * Returns a tagged result so the renderer can react to path mismatches.
     */
    /**
     * Creates the mirrored revision folder + meta.json if missing.
     * clientesFolder is used to compute the stable relative path for mirroring.
     */
    init(expedientePath: string, clientesFolder: string | null, revisionesFolder: string): Promise<RevisionInitResult>;
    saveMeta(revisionPath: string, meta: RevisionMeta): Promise<void>;
    /** Returns parsed JSON of <stepId>.json, or null if not found. Cast to the step's own type. */
    loadStep(revisionPath: string, stepId: string): Promise<unknown>;
    saveStep(revisionPath: string, stepId: string, data: unknown): Promise<void>;
  };
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
