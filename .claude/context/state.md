# State Management (Zustand)

All state lives in `state/`. One store per concern. Each store is a Zustand `create<State>((set, get) => ({...}))`.

## Stores

### explorer.store.ts
Owns file tree state.

- `root: FileNode | null` — expediente root
- `expandedPaths: Set<string>` — which folders are open in the tree
- `loadingPaths: Set<string>` — folders currently being read
- `indexStatus: IndexStatus` — `{ state: "idle"|"indexing"|"complete", total, rootPath }`

Actions:
- `openDirectory()` — opens native picker + loads tree
- `openDirectoryByPath(path, expandedPaths?)` — opens without dialog (session restore, recents)
- `closeDirectory()` — resets root + calls `editor.store.closeAllTabs()` via dynamic import
- `loadChildren(node)` — lazy-loads folder children
- `toggleExpanded(node)`
- `refreshNode(path)` — full re-read fallback
- Incremental mutations: `addFileToTree`, `addFolderToTree`, `removeFromTree`, `moveInTree` (idempotent, used by watcher events)
- FS operations (optimistic → IPC → watcher idempotent): `moveNode`, `deleteNode`, `renameNode`, `createFileNode`, `createFolderNode`

### editor.store.ts
Owns open tabs and active file.

- `tabs: Tab[]` — open tabs
- `activeTabId: string | null`
- `pageRotations: Record<string, number>` — per-file `${path}:${pageNum}` → rotation

Rules:
- Tab ID = file path (unique by path, no duplicate tabs for same file)
- `closeTab`, `closeOtherTabs`, `closeTabsToRight`, `closeAllTabs`, `togglePin`, `moveTab`
- `restoreTabs(tabs, activeTabId)` — session restore

### workbench.store.ts
Owns layout-level UI state.

- `activeSidebarView: "explorer" | "search" | null`
- `rightPanelTab: RightPanelTab` — current right panel tab
- `rightPanelOpen: boolean` — overlay visibility
- `settingsOpen`, `shortcutsOpen`, `commandPaletteOpen` — modal flags
- `splitFile`, `focusedPane`, `syncScroll` — split pane state
- `paneState: { left, right }` — reactive display state per pane (PdfViewer writes, PdfToolbar reads)
- `_paneActions: { left, right }` — non-reactive action callbacks (direct mutation, avoids re-renders)

Key actions:
- `openRightPanelTab(tab)` — sets tab AND opens overlay (use this for side-effect tab switches like after creating an annotation)
- `setRightPanelTab(tab)` — just sets tab, doesn't open
- `setRightPanelOpen(open)` — toggles overlay visibility

### search.store.ts
Owns search panel state: query, results, indexed flag.

### ux.store.ts
Health / accessibility / visual preferences. Persisted to `revisor:ux-settings` localStorage. Usage history persisted separately to `revisor:usage-history`.

Key fields:
- `privacyBlur`, `fovealFocus`, `zenMode`, `readingMode`, `autoReadingMode`, `readingModeStartHour`, `healthReminders`, `sessionTimer`, `dailyLimitEnabled`, `dailyLimitMinutes`, `totalDailyTime`, `bionicReading`, `lighthouseMode`, `eyePulse`, `ambientSound`, `progressiveDisclosure`, `contextTinting`, `microAudio`
- `restoreSession: boolean` — restore last expediente on startup (default `false`)
- `zoomFactor: number` — UI density (default `1.15`, applied via IPC `setZoom`)
- `usageHistory: { firstUse, daily: Record<YYYY-MM-DD, seconds> }`

`addTime(seconds)` increments both `totalDailyTime` AND `usageHistory.daily[today]`. **Uses `toLocaleDateString("en-CA")`** for local-timezone YYYY-MM-DD (NOT `toISOString().slice(0, 10)` — that uses UTC and rolls over prematurely in Mexican timezones).

### revision.store.ts
Owns revision metadata: `meta`, `revisionPath`, `expedientePath`, `isLoaded`, `isOutsideClientes`.

### anotaciones.store.ts
Owns annotations (stroke + highlight). Debounced save (1s) to `<revision>/anotaciones.json` via `window.api.revision.saveStep`. Undo/redo stacks (max 50 entries). `pendingNavigation` for panel→PDF navigation.

### citas.store.ts
Quoted text clips. Same persistence pattern.

### docStatus.store.ts
Per-file review status: `sin_revisar` / `en_revision` / `revisado` / `con_observaciones`. Keyed by relative file path.

### sintesis.store.ts
Free-form summary text per expediente.

### bookmarks.store.ts
Page-level bookmarks per expediente. `toggleBookmark(relPath, pageNum)` for convenience.

### settings.store.ts
`clientesFolder` + `revisionesFolder` paths. Persisted to localStorage.

## Cross-store communication

Avoid direct circular imports. Use dynamic imports when one store needs to call another:

```ts
import("./editor.store").then(({ useEditorStore }) => {
  useEditorStore.getState().closeAllTabs();
});
```

Example: `explorer.store.closeDirectory()` calls `editor.store.closeAllTabs()` this way.

## Rules

- Keep business logic in stores/services, NOT in components
- Components subscribe with granular selectors to avoid re-renders:
  ```ts
  const x = useStore((s) => s.x);
  ```
- Use `useShallow` for object selectors when multiple fields change together
- Non-reactive refs (`_scrollEls`, `_paneActions`) — mutate in place, never trigger re-renders
- Persisted stores load synchronously in initial state from localStorage, not via `useEffect`

## Performance pitfalls

- Subscribing to a full array (`useStore((s) => s.annotations)`) re-renders on every add/edit. Prefer counts or derived memos where possible.
- Calling `updateX` on every keystroke → store update → every subscriber re-renders. Use local `useState` for high-frequency inputs (text fields) and flush to store on blur/close.
