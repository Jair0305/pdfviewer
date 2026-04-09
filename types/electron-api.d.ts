export {};

export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  extension?: string;
}

export interface WatchEvent {
  event: "add" | "addDir" | "change" | "unlink" | "unlinkDir";
  path: string;
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
  // File system
  openDirectory(): Promise<string | null>;
  readDirectory(dirPath: string): Promise<DirectoryEntry[]>;
  readFile(filePath: string): Promise<string>; // base64

  // FS write
  moveFile(from: string, to: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  createFile(path: string): Promise<void>;
  createFolder(path: string): Promise<void>;

  // Watcher
  watchDirectory(dirPath: string): Promise<void>;
  unwatchDirectory(dirPath: string): Promise<void>;
  onFileChange(callback: (payload: WatchEvent) => void): () => void;

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
