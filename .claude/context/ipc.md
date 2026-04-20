# IPC (Inter-Process Communication)

## Source of truth

All channel names are defined in `electron/ipc-channels.ts`. **NEVER create ad-hoc channels.** Any new IPC endpoint requires:

1. Add constant to `IPC` object in `electron/ipc-channels.ts`
2. Handler in `electron/main.ts` via `ipcMain.handle(IPC.X, ...)`
3. Expose in `electron/preload.ts` via `contextBridge.exposeInMainWorld`
4. Type declaration in `types/electron-api.d.ts`

## Communication flow

```
Renderer (React)
  ↓
window.api.<method>()
  ↓
Preload (contextBridge)
  ↓
ipcRenderer.invoke(IPC.CHANNEL, ...args)
  ↓
ipcMain.handle(IPC.CHANNEL, handler)
  ↓
Main process (fs, chokidar, sqlite, shell, etc.)
```

## API surface (preload)

Defined in `preload.ts`. Current surface:

```ts
window.api = {
  // FS read
  openDirectory, readDirectory, readFile,
  // FS write
  moveFile, deleteFile, createFile, createFolder,
  // Watcher
  watchDirectory, unwatchDirectory,
  onFsAdd, onFsAddDir, onFsRemove, onFsRemoveDir, onFsChange,
  // Indexer
  startIndex, searchIndex, clearIndex,
  onIndexProgress, onIndexComplete,
  // Full-text content search
  storePdfContent, searchContent, hasContentIndex, clearContentIndex,
  // PDF text extraction (main-process pdfjs, avoids renderer worker issues)
  extractPdfText,
  // Shell
  showInFolder,
  // Window
  setZoom,
  // Revision (generic step I/O)
  revision: { init, saveMeta, loadStep, saveStep },
}
```

## Granular FS events

Watcher emits these from main → renderer. Renderer subscribes via `onFsX` helpers:

- `fs:add` — file created
- `fs:addDir` — directory created
- `fs:remove` — file deleted
- `fs:removeDir` — directory deleted
- `fs:change` — file contents changed

Each payload carries `{ path, parentPath, name }` — all forward slashes.

## Rules

- Preload must use `contextBridge` — no direct `window` mutation
- Preload exposes minimal API — no broad Node.js surface
- Main process owns all privileged logic (fs, shell, db)
- Renderer has `nodeIntegration: false, contextIsolation: true, sandbox: false`
