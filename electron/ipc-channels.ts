/**
 * Single source of truth for all IPC channel names.
 * Used by both main.ts and preload.ts (compiled by esbuild, not Next.js).
 */
export const IPC = {
  // File system — read
  DIALOG_OPEN_DIR:   "dialog:open-directory",
  FS_READ_DIR:       "fs:read-directory",
  FS_READ_FILE:      "fs:read-file",
  // File system — write
  FS_MOVE:           "fs:move",
  FS_DELETE:         "fs:delete",
  FS_CREATE_FILE:    "fs:create-file",
  FS_CREATE_DIR:     "fs:create-dir",
  // Watcher
  FS_WATCH_DIR:      "fs:watch-directory",
  FS_UNWATCH_DIR:    "fs:unwatch-directory",
  FS_WATCH_EVENT:    "fs:watch-event",
  // Indexer
  INDEX_START:       "index:start",
  INDEX_PROGRESS:    "index:progress",
  INDEX_COMPLETE:    "index:complete",
  INDEX_SEARCH:      "index:search",
  INDEX_CLEAR:       "index:clear",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
