export {};

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
  searchIndex(query: string): Promise<SearchResult[]>;
  clearIndex(rootPath: string): Promise<void>;
  onIndexProgress(callback: (payload: IndexProgressPayload) => void): () => void;
  onIndexComplete(callback: (payload: IndexCompletePayload) => void): () => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}
