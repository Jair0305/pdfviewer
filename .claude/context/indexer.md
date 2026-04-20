# Indexer & Search

## File indexer

Location: `electron/services/indexer.ts`

Technology: `better-sqlite3` (synchronous, fast, native module — requires `@electron/rebuild` for packaging).

Database stored in Electron `userData` path: `userData/expediente-index.db`.

### Indexed data
- `path` — absolute forward-slash path
- `type` — file type (pdf / xml / other)
- `name` — basename
- `parentPath` — containing directory
- `metadata` — size, extension
- `timestamps` — mtime, ctime

### Behavior
- Runs asynchronously after `watchDirectory` is called
- Streams progress via IPC `INDEX_PROGRESS` events (`{ indexed, rootPath }`)
- Emits `INDEX_COMPLETE` when finished
- Separate database entry per `rootPath` — multiple expedientes can coexist

### IPC channels
- `INDEX_START` — begin indexing a root
- `INDEX_PROGRESS` — streamed progress (main → renderer)
- `INDEX_COMPLETE` — finished
- `INDEX_SEARCH` — filename search query
- `INDEX_CLEAR` — wipe a root's index

## Full-text PDF search (content index)

Separate from filename index. Indexes extracted PDF text.

### Flow
1. PDF extraction runs in main process via `electron/services/pdfextractor.ts` (uses pdfjs-dist with file:// URL dynamic import + createRequire to resolve worker — bypasses renderer/Turbopack worker issues).
2. Renderer calls `window.api.extractPdfText(filePath)` → returns `{ page, text }[]`.
3. Renderer calls `window.api.storePdfContent(...)` to persist into content DB.
4. Search via `window.api.searchContent(query, rootPath)` returns `ContentSearchResult[]`.

### IPC channels
- `CONTENT_STORE` — persist extracted text
- `CONTENT_SEARCH` — full-text search
- `CONTENT_HAS_INDEX` — check if a file's content is indexed
- `CONTENT_CLEAR` — wipe content for a root

## Search engine

### Features
- Filename search (via filename index)
- Full-text PDF content search (via content index)
- Results grouped by file
- Highlight snippets in content results

### Requirements
- Instant results (< 100ms for typical queries)
- No blocking the UI thread
- Uses index tables — NEVER does FS scans at query time

## Rules

- Indexing must NOT block the renderer
- Stream progress incrementally, don't batch at the end
- Watcher events (add/remove) should trigger incremental index updates
- Clearing the expediente (close) should NOT wipe indexes (they're reusable on reopen)
