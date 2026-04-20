# CLAUDE.md

Guidance for Claude Code working on this repository.

---

# 🧠 Project Overview

**Revisor de Expedientes** — desktop IDE-like application for reviewing legal case files (expedientes jurídicos).

Stack:
- Electron (main process, Node.js)
- Next.js + React 19 (renderer, UI)
- Tailwind v4 + shadcn/ui + @tabler/icons-react
- Zustand (state)
- better-sqlite3 (indexing)
- chokidar (watchers)
- react-pdf / pdfjs-dist (PDF rendering)

Each expediente has large folder trees with hundreds/thousands of PDF and XML files. The app provides file explorer, PDF viewer, annotations, questionnaire, indexing, full-text search, and a revision output (JSON files per expediente).

---

# 🏗️ Architecture — The Three Contexts

| Context | Entry | Runtime | Notes |
|---|---|---|---|
| Main process | `electron/main.ts` | Node.js | Full FS access, sqlite, chokidar |
| Preload | `electron/preload.ts` | Sandboxed | Bridge via `contextBridge` |
| Renderer | `app/` | Browser | NO Node.js access |

## 🚨 Golden Rules

1. **Renderer MUST NEVER access Node.js APIs directly.** All system access via `window.api`.
2. **Never create ad-hoc IPC channels.** All channels defined in `electron/ipc-channels.ts`.
3. **Never perform FS operations in IPC handlers directly.** Use the filesystem service.
4. **Never rebuild the entire file tree.** Only incremental updates via watcher events.
5. **Keep business logic in stores/services, not components.**

---

# 📚 Detailed Context (read on demand)

For detailed reference on each subsystem, read the relevant file in `.claude/context/`:

| Topic | File | When to read |
|---|---|---|
| IPC channels, preload API, communication flow | `.claude/context/ipc.md` | Adding/modifying any IPC endpoint, preload API, or message flow |
| FileSystem service, move fallback, error codes (ENOENT/EPERM/EXDEV), watchers | `.claude/context/filesystem.md` | Touching file operations, watchers, FS error handling |
| Indexer, SQLite schema, content (full-text) search, pdf extractor | `.claude/context/indexer.md` | Working on indexing, search, or PDF text extraction |
| All Zustand stores, cross-store patterns, performance pitfalls | `.claude/context/state.md` | Creating/modifying stores, debugging re-renders |
| Workbench layout, panels, PDF viewer internals (render window, canvas pen), modals, HomeScreen | `.claude/context/workbench.md` | Any layout change or PDF viewer work |
| Revision folder structure, meta.json, generic step I/O, adding new steps | `.claude/context/revision.md` | Adding a revision step or working with persistence |

Always read the relevant subdoc **before** modifying that subsystem.

---

# ⚡ Performance Rules

**MUST**: virtualization for long lists, lazy loading, memoization, incremental updates, granular store selectors.

**NEVER**: full tree re-render, blocking main thread, large synchronous loops, subscribing to full array state when a count or scalar would do.

---

# 🔐 Security

- **Renderer**: no `fs`, no `path`, no `require()` — only `window.api`
- **Preload**: `contextBridge` with minimal exposed surface
- **Main**: all privileged logic; validates all incoming paths and arguments

Config: `nodeIntegration: false, contextIsolation: true, sandbox: false` (sandbox off because preload needs `require`).

---

# 🚫 Forbidden Patterns

- Direct `fs`/`path`/`require` in renderer
- Mock filesystem for "testing" the UI
- Full tree refresh on any operation
- Uncontrolled IPC channels (outside `ipc-channels.ts`)
- Blocking operations in UI thread
- Updating Zustand store on every keystroke from a text input (use local state, flush on blur)
- `new Date().toISOString().slice(0, 10)` for local date (use `toLocaleDateString("en-CA")` — UTC rolls over prematurely in CDMX)

---

# 📦 Development

```bash
npm run dev             # concurrent Next.js + Electron
npm run dev:next        # Next.js only
npm run dev:electron    # Electron only (needs Next running)
npm run build           # Next static export + Electron compile
npm run package         # electron-builder → dist-app/
npm run typecheck       # tsc --noEmit
```

- **Electron must restart on main/preload changes.** Renderer hot reloads independently.
- `better-sqlite3` is native — rebuild with `npx @electron/rebuild -f -w better-sqlite3` if it breaks.

---

# 🧪 Debugging

Structured log prefixes: `[FS ACTION]`, `[FS EVENT]`, `[FS ERROR]`, `[INDEX]`, `[ANOTACIONES ERROR]`, etc.

Common issues:
- ENOENT → file changed externally (Dropbox sync)
- EPERM → locked file (Dropbox, antivirus)
- UI desync → watcher event missed, consider `refreshNode()`
- Pen lag → verify canvas approach is intact (see `workbench.md`)
- Typing lag in notes → verify local state owns textarea (flush on blur only)

---

# 🧠 Claude Code Behavior

When modifying code:
- Read relevant files FIRST, don't assume structure
- Check the relevant `.claude/context/` doc before touching a subsystem
- Follow existing patterns — this codebase has strong conventions
- Use `Edit` over `Write` when possible
- After changes, run `npx tsc --noEmit` to verify

When uncertain about layout/UX decisions: **ask the user first**. Don't rearrange without approval.

---

# 📌 Current State (2026-04-20)

## Fully implemented features

### Layout / UX
- **HomeScreen** (`features/home/HomeScreen.tsx`) — shown when no expediente open. Up to 8 recents from `revisor:recents` localStorage.
- **ExpedienteDashboard** (`features/expediente/ExpedienteDashboard.tsx`) — shown when expediente open but no file selected. Progress bar, status breakdown, file type counts.
- **Session restore toggle** — `UXStore.restoreSession` default `false`. Toggle in Settings → Apariencia.
- **Close expediente** — `IconFolderX` in FileExplorer header. `explorer.store.closeDirectory()`.
- **Right panel — fixed resizable** (`core/workbench/RightPanel.tsx`) — always-visible panel (~28% width) with internal tab bar. Tabs: Cuest./Notas/Citas/Sínt./Marks. Collapsible via drag or `›` button. `openRightPanelTab(tab)` re-expands if collapsed. `rightPanelOpen` default `true`.
- **File tree filters** — chips for doc status, "Solo PDF", "Con anotaciones". Recursive.
- **Doc status in tree** — colored dot per file (amber=en revisión, green=revisado, red=con observaciones). Batch status via context menu.

### PDF Viewer
- **DocStatusButton** (`features/pdf-viewer/DocStatusButton.tsx`) — dropdown in PDF toolbar: sin_revisar / en_revision / revisado / con_observaciones.
- **PdfMinimap** (`features/pdf-viewer/PdfMinimap.tsx`) — right-edge minimap with annotation color markers + amber left edge on bookmarked pages.
- **Pen tool** — two-canvas GPU (committedCanvas + liveCanvas). Undo/redo stack in `anotaciones.store`.
- **Text selection bubble** — select text → color dots (highlight) + quote icon (cita).
- **Split pane** — horizontal split, sync scroll.
- **Bookmarks** — page-level. Inline label edit in BookmarksPanel.
- **Annotations undo/redo** — `Ctrl+Z` / `Ctrl+Shift+Z`. MAX_UNDO stack in `anotaciones.store`.

### Other features
- **Command Palette** (`Ctrl+K`) — 30 commands, fuzzy match, arrow nav.
- **Shortcuts modal** (`?` or keyboard icon) — 6 groups.
- **XML viewer** — CFDI 3.x/4.x parsed card view + raw pretty-print.
- **Full-text search** — better-sqlite3 index, cross-document filename + content search.
- **Settings modal** — full-screen, 5 categories. Zoom 85–135% (default 1.15). Health/focus timers with SciTooltip. Usage stats with streak + 7-day chart.
- **Reading mode** — fixed amber overlay at z-[99998] (covers Radix portals). Auto mode by hour.
- **Zen mode** — hides sidebar, activity bar, right panel, status bar.
- **Context tinting** — subtle hue per expediente ID.
- **Dark/light mode** — via next-themes.

## What's pending

- **Review process definition** — user-deferred ("primero lo defino yo"). Core workflow beyond generic questionnaire undefined. Export/reporte blocked on this.
- **OCR** — not started. Scanned PDFs have no text layer → search/selection/highlight fail. Options: `tesseract.js` (renderer) or `node-tesseract-ocr` (main).
- **Document navigation** — no "next unreviewed" / "prev" button in toolbar. Must use file tree manually.
- **Save indicator** — no visible feedback when notes/questionnaire/docStatus auto-save. User has no confirmation data was persisted.
- **Export / Reporte** — deferred until process is defined.

## What NOT to change without asking

- **Right panel fixed pattern** — confirmed correct for this workflow (legal review = PDF + questionnaire simultaneously).
- **Default `restoreSession = false`** — intentional.
- **Zoom default 1.15** — user explicitly chose this.

## Billing context (2026-04-20)

~18.4h measured in Claude Code sessions (9 abr–19 abr). Estimated real total **25–32h** including pre-session work (project started 2026-04-08).

---

# END
