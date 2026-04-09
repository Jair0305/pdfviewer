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
