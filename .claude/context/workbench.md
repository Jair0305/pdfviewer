# Workbench Layout (IDE System)

## Root component

`core/workbench/WorkbenchLayout.tsx` — top-level IDE layout.

## Structure

```
┌─────────┬──────────────────────────────────────────────────────┐
│         │  TabBar                                              │
│         ├──────────────────────────────────────────────────────┤
│ Activity│  Breadcrumbs                                         │
│ Bar     ├──────────────────────────────────────────────────────┤
│ (48px)  │  PdfToolbar                                          │
│         ├─────────────────┬──────────────┬────────────────────┤
│         │                 │              │  Tab bar           │
│         │ Sidebar         │ PDF Viewer   │  ────────────────  │
│         │ (Explorer /     │              │  Right Panel       │
│         │  Search)        │              │  (~28%, resizable) │
│         │                 │              │                    │
├─────────┴─────────────────┴──────────────┴────────────────────┤
│ Status bar                                                      │
└─────────────────────────────────────────────────────────────────┘
```

Right panel is a **fixed resizable Panel** (NOT an overlay). Always visible by default.

## Panels

- **Activity bar** (`ActivityBar.tsx`) — left 48px rail with: explorer, search, keyboard shortcuts, settings icons. Bottom shows index status indicator.
- **Sidebar** (resizable, collapsible) — renders `FileExplorer` or `SearchPanel` based on `activeSidebarView`.
- **Editor area** — tabs, breadcrumbs, PDF toolbar, PDF viewer (can split via `workbench.splitFile`).
- **Right panel strip** (`RightPanelStrip.tsx`) — always-visible 48px icon strip on right edge with tab icons + badges. Clicking a tab opens a 320px overlay panel that slides over the PDF.
- **Status bar** — bottom 22px, shows index status + active file path.

## Right panel pattern (fixed resizable)

Right panel is a `react-resizable-panels` Panel, always visible. Default width ~28%.

Implementation:
- `RightPanel.tsx` — tab bar at top + content below. No strip, no overlay.
- Tab bar: Cuest. / Notas / Citas / Sínt. / Marks. with badges + `›` collapse button.
- Workbench store: `rightPanelOpen: boolean` (default `true`), `rightPanelTab: RightPanelTab`
- `openRightPanelTab(tab)` — sets tab + sets `rightPanelOpen: true` (re-expands if collapsed)
- `setRightPanelTab(tab)` — just switches tab
- `setRightPanelOpen(false)` — collapses panel via `rightPanelRef.current.collapse()`
- `WorkbenchLayout` has `useEffect` syncing `rightPanelOpen` → `rightPanelRef.current.expand/collapse`
- `rightPanelExpandedSizeRef` tracks last non-zero size for restore

Panel tabs: `cuestionario`, `anotaciones`, `citas`, `sintesis`, `bookmarks`.

`RightPanelStrip.tsx` — kept but no longer used. Superseded by the fixed panel.

## Resize

Uses `react-resizable-panels`. `PanelGroup` + `Panel` + custom `ResizeHandle`.

The outer PanelGroup is horizontal: sidebar | editor area. The split pane is a nested horizontal PanelGroup inside the editor area.

## Modals (full-screen overlays)

- `SettingsModal` — opened via activity bar gear, `workbench.settingsOpen`. Full-screen with left category nav.
- `ShortcutsModal` — opened via `?` key or keyboard icon in activity bar, `workbench.shortcutsOpen`.
- `CommandPalette` — opened via `Ctrl+K`, `workbench.commandPaletteOpen`. Centered, fuzzy search, arrow navigation.

All modals use `position: fixed, z-[99999]` (or similar high z-index) + backdrop click to close + Escape to close.

## Session persistence

localStorage key `revisor:session` stores:
- `rootPath`, `expandedPaths` (restored via `openDirectoryByPath`)
- `tabs`, `activeTabId` (restored via `editor.store.restoreTabs`)
- `sidebarSize` (restored to `sidebarRef.current.resize()`)
- `activeSidebarView`

Only restored if `ux.store.restoreSession === true`. Otherwise app starts fresh with HomeScreen.

Saved on `beforeunload` + `visibilitychange: hidden`.

## HomeScreen

`features/home/HomeScreen.tsx` — shown when no file is active AND no root is open. Reads `revisor:recents` localStorage (managed by `features/home/recents.ts`). `pushRecent()` called in WorkbenchLayout when `root?.path` becomes non-null.

When root is open but no file selected, `ExpedienteDashboard` is shown instead (progress bar, doc status breakdown).

## File explorer behavior

MUST behave like OS file explorer:
- Tree view with lazy loading
- Virtualized rendering via `@tanstack/react-virtual` (`VirtualFileTree.tsx`)
- Context menu (create, rename, delete, reveal, copy path)
- Drag & drop (moves via FS service, validates destination, instant optimistic update)
- Inline rename + create
- Batch selection (shift-click, ctrl-click)
- Filter bar (doc status chips, "Solo PDF", "Con anotaciones") — recursive, folders shown only if they have matching descendants
- Close expediente button in header (`explorer.store.closeDirectory()`)

### Rules
- No full tree reload on any operation
- No mock data
- Incremental updates only (via watcher events + optimistic mutations)

## PDF viewer

Library: `react-pdf` (wraps pdfjs-dist).

### Per-pane state
- `scale`, `renderScale` (debounced), `rotation`, `currentPage`, `numPages`, `galleryMode`, `showThumbs`, `showSearch`

### Render window
`const RENDER_WINDOW = 4` — only pages within ±4 of `currentPage` render as actual canvases. Outside pages are white placeholder divs with correct dimensions (preserves scroll geometry). Prevents 200+ canvas elements for large PDFs.

### Coordinate system
PDF pages have intrinsic dimensions. Display = `intrinsic * scale`. Rotation 90/270 swaps w/h.

Annotation coordinates normalized `[0, 1]` in canonical (unrotated) space. Helpers in `AnnotationOverlay.tsx`: `toRotated`, `toCanonical`, `toRotatedRect`, `toCanonicalRect`.

### Annotation overlay (two-canvas approach)
Live pen drawing uses two GPU canvases layered over the SVG:
- `committedCanvas` — accumulates bezier segments as they're drawn, incremented directly in the pointer event handler (no RAF wait, GPU bitmap)
- `liveCanvas` — only the tail segment (last committed midpoint → cursor), cleared + redrawn per RAF, O(1) per frame

SVG renders saved annotations only (static, never touched during live drawing). This bypasses SVG's CPU rasterizer and the O(n) path parsing that caused "brincos" on long strokes.

Canvas dimensions set via `useEffect` (NOT JSX attributes) to prevent React from clearing the bitmap on re-render.

### Text selection → bubble
When annotationMode is null and user selects text, a floating bubble appears near the selection with color dots (create highlight) + quote icon (create cita). Uses `getClientRects()` + `toCanonicalRect()` to store normalized rects.

## Questionnaire

Config: `config/questionnaire.ts` (`QUESTIONNAIRE_TEMPLATE`).

Answers stored in `cuestionario.json` per revision. Keys are question IDs, values are structured answers.

## Zen mode

`ux.store.zenMode` — hides activity bar, sidebar, right panel strip, status bar. PDF takes full viewport. Toggle via `Alt+Z`, exit via `Esc`.

## Revision folder structure

See `.claude/context/revision.md`.
