export interface DirectoryEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  extension?: string;
}

/** Payload for add / remove / change events (main → renderer) */
export interface FsNodeEvent {
  /** Absolute path (forward slashes) */
  path: string;
  /** Parent directory path (forward slashes) */
  parentPath: string;
  /** Basename */
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
