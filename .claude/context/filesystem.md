# Filesystem Layer

## Philosophy

The filesystem must behave like VS Code Explorer: real-time sync, no full reloads, incremental updates, robust error handling.

## FileSystem service

Location: `electron/services/filesystem.ts`

Owns ALL file operations. IPC handlers in `main.ts` delegate to this service — **never perform fs ops directly in IPC handlers**.

### Responsibilities
- All file operations (read, write, move, delete, create)
- Path validation
- Error handling with user-meaningful messages
- Emitting events when state changes

### Supported operations
`moveFile`, `deleteFile`, `renameFile`, `createFile`, `createDirectory`

## Rules

- NEVER perform FS operations directly in IPC handlers
- ALWAYS use filesystem service
- ALWAYS validate paths before operations
- Path normalization: forward slashes everywhere (`p.replace(/\\/g, "/")`)
- Case-insensitive path comparison on Windows

## Move file (CRITICAL)

Cross-filesystem moves fail with `fs.rename`. Must follow this sequence:

1. Validate source exists
2. Normalize both paths
3. Attempt `fs.rename(source, target)`
4. If fails (EXDEV, EPERM, etc.): fallback:
   ```ts
   await fs.copyFile(source, target);
   await fs.unlink(source);
   ```

## Error handling

Known error codes and their meanings:

- `ENOENT` — file missing (likely changed externally, e.g. Dropbox sync)
- `EACCES` — permission denied
- `EPERM` — locked file (Dropbox, antivirus, another process)
- `EXDEV` — cross-device move (triggers copy+unlink fallback)
- `EBUSY` — resource busy

All FS errors should be caught, logged with `[FS ERROR]` prefix, and surfaced to the user when relevant.

## Watchers (real-time sync)

Library: `chokidar`

### Events to handle
- `add` — file created externally
- `addDir` — directory created externally
- `unlink` — file deleted externally
- `unlinkDir` — directory deleted externally
- `change` — file contents changed

### IPC events emitted
- `fs:add`, `fs:addDir`, `fs:remove`, `fs:removeDir`, `fs:change`

### Rules
- NEVER rebuild the entire tree from a watcher event
- ONLY update affected nodes via incremental tree mutations (`addFileToTree`, `removeFromTree`, etc. in explorer store)
- MUST reflect external changes (Explorer, Dropbox, other apps)
- Watcher callbacks must be idempotent (duplicate events are possible)

## Common issues

- ENOENT on file access → file changed externally, refresh affected node
- EPERM → usually Dropbox lock or antivirus scan, retry or surface
- UI desync → missing watcher event, consider fallback `refreshNode()`

## Debugging

Use structured log prefixes: `[FS ACTION]`, `[FS EVENT]`, `[FS ERROR]`. Watcher events log as `[FS EVENT add]`, `[FS EVENT change]`, etc.
