// ─── File System ──────────────────────────────────────────────────────────────

export type FileType = "pdf" | "xml" | "folder" | "unknown";

export interface FileNode {
  /** Absolute OS path — used as unique ID */
  id: string;
  name: string;
  type: FileType;
  path: string;
  /**
   * undefined  → not yet loaded (lazy)
   * []         → loaded, folder is empty
   * [...]      → loaded children
   */
  children?: FileNode[];
  /** true for files and for folders whose children have been fetched */
  loaded: boolean;
}

// ─── Editor Tabs ─────────────────────────────────────────────────────────────

export interface Tab {
  id: string;    // = file path
  name: string;
  path: string;
  type: FileType;
  /** Preview tab gets replaced on next file open (like VS Code) */
  isPreview: boolean;
  /** Pinned tabs stay to the left and cannot be closed by "close others" */
  isPinned?: boolean;
  /** Satisfies FileNode.loaded requirement for PdfViewer compatibility */
  loaded: true;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  name: string;
  path: string;
  extension: string;
  /** Relative path from root for display */
  relativePath?: string;
}

export interface ContentSearchResult {
  path: string;
  name: string;
  page: number;
  /** Text snippet with [[...]] markers around the matched terms */
  snippet: string;
}

// ─── Indexer ─────────────────────────────────────────────────────────────────

export interface IndexProgress {
  indexed: number;
  rootPath: string;
}

export interface IndexStatus {
  state: "idle" | "indexing" | "complete" | "error";
  total: number;
  rootPath: string | null;
}

// ─── Questionnaire ────────────────────────────────────────────────────────────

export type AnswerValue = "yes" | "no" | null;

export interface Question {
  id: string;
  text: string;
  category?: string;
  required?: boolean;
}

export interface Answer {
  questionId: string;
  value: AnswerValue;
  notes?: string;
}
