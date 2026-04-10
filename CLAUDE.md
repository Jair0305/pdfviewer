# CLAUDE.md

This file provides **comprehensive guidance** for Claude Code when working with this repository.

---

# 🧠 Project Overview

**Revisor de Expedientes**

A **desktop IDE-like application** built with:

* Electron (Main process, Node.js)
* Next.js (Renderer, UI)
* Zustand (State management)
* SQLite (Indexing via `better-sqlite3`)

---

## 🎯 Purpose

This application is designed for **reviewing legal case files (expedientes jurídicos)**.

Each expediente consists of:

* Large folder trees
* Hundreds or thousands of `.pdf` and `.xml` files

The app provides:

* File explorer (like VS Code)
* PDF viewer
* Questionnaire panel (yes/no structured validation)
* File indexing and search

---

# 🏗️ Core Architecture

## Process Separation (CRITICAL)

There are **three isolated execution contexts**:

| Context      | Entry                 | Runtime   | Notes                      |
| ------------ | --------------------- | --------- | -------------------------- |
| Main Process | `electron/main.ts`    | Node.js   | Full access to filesystem  |
| Preload      | `electron/preload.ts` | Sandboxed | Bridge via `contextBridge` |
| Renderer     | `app/`                | Browser   | NO Node.js access          |

---

## 🚨 Golden Rule

> The renderer MUST NEVER access Node.js APIs directly.

All system access goes through:

```ts
window.api
```

---

# 🔌 IPC (Inter-Process Communication)

## Source of Truth

All channels are defined in:

```
electron/ipc-channels.ts
```

👉 NEVER create ad-hoc channels.

---

## API Exposure

Defined in `preload.ts` using `contextBridge`:

```ts
window.api = {
  openDirectory,
  readDirectory,
  readFile,
  moveFile,
  deleteFile,
  createFile,
  createDirectory,
  watchDirectory
}
```

---

## Communication Flow

```txt
Renderer (React)
  ↓
window.api
  ↓
Preload (contextBridge)
  ↓
ipcRenderer
  ↓
ipcMain (Electron)
  ↓
Main Process (fs, chokidar, sqlite)
```

---

# 📂 Filesystem Layer (CORE SYSTEM)

## Philosophy

The filesystem must behave like:

👉 VS Code Explorer

Meaning:

* Real-time sync
* No full reloads
* Incremental updates
* Robust error handling

---

## 🔥 FileSystem Service

Location:

```
electron/services/filesystem.ts
```

### Responsibilities:

* ALL file operations
* Validation
* Error handling
* Emitting events

---

## Supported Operations

* moveFile
* deleteFile
* renameFile
* createFile
* createDirectory

---

## ⚠️ Rules

* NEVER perform FS operations directly in IPC handlers
* ALWAYS use filesystem service
* ALWAYS validate paths before operations

---

## 🔁 Move File (CRITICAL)

Must follow:

1. Validate source exists
2. Normalize paths
3. Attempt:

```ts
fs.rename(source, target)
```

4. If fails:

   * fallback to:

```ts
fs.copyFile(source, target)
fs.unlink(source)
```

---

## Error Handling

Must handle:

* ENOENT → file missing
* EACCES → permission denied
* EPERM → locked file (Dropbox, antivirus)

---

# 🔄 Watchers (Real-Time Sync)

## Library

```
chokidar
```

---

## Events to Handle

* add
* addDir
* unlink
* unlinkDir
* change

---

## IPC Events

* fs:add
* fs:addDir
* fs:remove
* fs:removeDir
* fs:change
* fs:move

---

## 🚨 Rules

* NEVER rebuild the entire tree
* ONLY update affected nodes
* MUST reflect external changes (Explorer, Dropbox)

---

# 🧠 State Management (Zustand)

All state lives in:

```
state/
```

---

## Stores Overview

### 📁 explorer.store.ts

Owns:

* File tree (FileNode)
* Expanded nodes
* FS sync
* Index status

---

### 📄 editor.store.ts

Owns:

* Open tabs
* Active file

Rules:

* Tab ID = file path
* No duplicates

---

### 🧭 workbench.store.ts

Owns:

* Active sidebar view

---

### 🔍 search.store.ts

Owns:

* Query
* Results
* Indexed flag

---

### 🧾 questionnaire.store.ts

Owns:

* Answers per file

---

## Cross-store communication

Use dynamic imports:

```ts
(await import("./editor.store")).useEditorStore.getState()
```

---

# 🧩 Workbench Layout (IDE System)

## Root Component

```
core/workbench/WorkbenchLayout.tsx
```

---

## Layout Structure

```txt
Activity Bar
Sidebar
Editor Area (tabs)
Panel (optional)
```

---

## Panels

* Sidebar: File explorer / search
* Editor:

  * PDF Viewer
  * Questionnaire

---

## Resize

Uses:

```
react-resizable-panels
```

---

## Rules

* Must be fluid
* No layout breaks
* No hardcoded hacks

---

# 📂 File Explorer (VS Code Behavior)

## Requirements

* Tree view
* Lazy loading
* Virtualized rendering
* Context menu
* Drag & drop

---

## MUST behave like OS file explorer

---

## Drag & Drop

* Moves files using FS service
* Updates state instantly
* Validates destination

---

## 🚨 Rules

* No full reload
* No mock data
* Incremental updates only

---

# 📄 PDF Viewer

## Library

* react-pdf or pdf.js

---

## Requirements

* Load real files
* Smooth scroll
* Resize responsive
* Support large documents

---

## Future

* Annotations
* Highlighting

---

# 🔍 File Indexer

## Location

```
electron/services/indexer.ts
```

---

## Technology

```
better-sqlite3
```

---

## Database

Stored in:

```
userData/expediente-index.db
```

---

## Indexed Data

* path
* type
* metadata
* timestamps

---

## Behavior

* Runs asynchronously
* Streams progress via IPC

---

## Events

* INDEX_PROGRESS
* INDEX_COMPLETE

---

# 🔎 Search Engine

## Features

* Search by filename
* (future) full-text search
* Grouped results

---

## Requirements

* Instant results
* No blocking UI
* Uses index (NOT FS scan)

---

# 🧾 Questionnaire System

## Config

```
config/questionnaire.ts
```

---

## Structure

```ts
QUESTIONNAIRE_TEMPLATE
```

---

## Behavior

* Per-file answers
* Persistent state
* Linked to file path

---

# ⚡ Performance Rules

## MUST

* Virtualization
* Lazy loading
* Memoization
* Incremental updates

---

## NEVER

* Full tree re-render
* Blocking main thread
* Large synchronous loops

---

# 🔐 Security Rules

## Renderer

❌ NO:

* fs
* path
* require()

✅ ONLY:

* window.api

---

## Preload

* Use contextBridge
* Expose minimal API

---

## Main

* All privileged logic here

---

# 📦 Development Workflow

## Commands

```bash
npm run dev
npm run dev:next
npm run dev:electron
npm run build
npm run package
```

---

## Important Notes

* Electron must restart on main/preload changes
* Renderer hot reload works independently

---

# 🧠 Coding Guidelines

## General

* Prefer TypeScript strict typing
* Use path aliases (@/)
* Keep components pure

---

## File Operations

* Always validate paths
* Always handle errors
* Never trust frontend state

---

## State

* Keep logic in stores/services
* Avoid logic in components

---

# 🚫 Forbidden Patterns

* Direct fs in React
* Mock filesystem
* Full tree refresh
* Uncontrolled IPC channels
* Blocking operations in UI

---

# 🧪 Debugging

## Logs

Use structured logs:

```ts
[FS ACTION]
[FS EVENT]
[FS ERROR]
```

---

## Common Issues

* ENOENT → file changed externally
* EPERM → locked file
* UI desync → missing watcher event

---

# 🚀 Future Enhancements

* Full-text PDF search
* OCR processing
* Annotation system
* Multi-user sync
* Cloud integration

---

# 🎯 Final Goal

This system must behave like a real IDE:

* Instant feedback
* Real filesystem sync
* Reliable operations
* No inconsistencies

---

# 🧠 Claude Instructions

## When modifying code:

* Read relevant files FIRST
* Do NOT assume structure
* Follow existing patterns

---

## When working with filesystem:

* Always validate paths
* Always handle errors
* Use service layer only

---

## When working with UI:

* Do NOT break layout
* Respect IDE structure
* Maintain performance

---

## Renderer Rules Reminder

* NO Node.js access
* ALWAYS use window.api

---

## Electron Rules Reminder

* Restart required after main/preload changes

---

# 🧩 Summary

This is NOT a simple app.

It is:

👉 A desktop IDE for legal document analysis

All implementations must aim for:

* robustness
* performance
* correctness
* scalability

---

# END
