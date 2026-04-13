/**
 * Single source of truth for all IPC channel names.
 * Used by both main.ts and preload.ts (compiled by esbuild, not Next.js).
 */
export const IPC = {
  // File system — read
  DIALOG_OPEN_DIR:     "dialog:open-directory",
  FS_READ_DIR:         "fs:read-directory",
  FS_READ_FILE:        "fs:read-file",
  // File system — write
  FS_MOVE:             "fs:move",
  FS_DELETE:           "fs:delete",
  FS_CREATE_FILE:      "fs:create-file",
  FS_CREATE_DIR:       "fs:create-dir",
  // Watcher control
  FS_WATCH_DIR:        "fs:watch-directory",
  FS_UNWATCH_DIR:      "fs:unwatch-directory",
  // Granular FS events (main → renderer)
  FS_EVENT_ADD:        "fs:event:add",
  FS_EVENT_ADD_DIR:    "fs:event:add-dir",
  FS_EVENT_REMOVE:     "fs:event:remove",
  FS_EVENT_REMOVE_DIR: "fs:event:remove-dir",
  FS_EVENT_CHANGE:     "fs:event:change",
  // Indexer
  INDEX_START:         "index:start",
  INDEX_PROGRESS:      "index:progress",
  INDEX_COMPLETE:      "index:complete",
  INDEX_SEARCH:        "index:search",
  INDEX_CLEAR:         "index:clear",
  // Shell utilities
  SHELL_SHOW_FILE:     "shell:show-item",
  // Revision — generic step I/O (no new channels needed when adding future steps)
  REVISION_INIT:       "revision:init",
  REVISION_SAVE_META:  "revision:save-meta",
  REVISION_LOAD_STEP:  "revision:load-step",
  REVISION_SAVE_STEP:  "revision:save-step",
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
