"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  IconSearch, IconLoader2, IconFileTypePdf, IconFileTypeXml, IconFile,
  IconX, IconDatabaseImport, IconRefresh, IconBook2,
} from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { useSearchStore } from "@/state/search.store";
import { useExplorerStore } from "@/state/explorer.store";
import { useEditorStore } from "@/state/editor.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useIsElectron } from "@/hooks/useIsElectron";
import type { SearchResult, ContentSearchResult, FileNode } from "@/types/expediente";
import { cn } from "@/lib/utils";

// ─── Module-level in-memory content index ────────────────────────────────────
// Persists across SearchPanel mount/unmount (sidebar navigation).

type PageEntry = { page: number; text: string };

interface ContentIndex {
  rootPath: string;
  /** path → { name, pages[] } */
  files: Map<string, { name: string; pages: PageEntry[] }>;
}

let _index: ContentIndex | null = null;
let _indexStatus: "idle" | "indexing" | "ready" = "idle";
let _indexProgress = { current: 0, total: 0 };
let _indexErrors = 0;
let _lastError = "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normText(t: string): string {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function buildSnippet(text: string, term: string): string {
  const norm  = normText(text);
  const ntm   = normText(term);
  const pos   = norm.indexOf(ntm);
  if (pos === -1) return text.slice(0, 200) + (text.length > 200 ? "…" : "");
  const BEFORE = 80, AFTER = 150;
  const start  = Math.max(0, pos - BEFORE);
  const end    = Math.min(text.length, pos + ntm.length + AFTER);
  const chunk  = text.slice(start, end);
  const cn     = norm.slice(start, end);
  const m      = cn.indexOf(ntm);
  if (m === -1) return (start > 0 ? "…" : "") + chunk + (end < text.length ? "…" : "");
  return (
    (start > 0 ? "…" : "") +
    chunk.slice(0, m) +
    "[[" + chunk.slice(m, m + ntm.length) + "]]" +
    chunk.slice(m + ntm.length) +
    (end < text.length ? "…" : "")
  );
}

function searchInIndex(query: string): ContentSearchResult[] {
  if (!_index || !query.trim()) return [];
  const terms = query.trim().split(/\s+/).filter(Boolean).map(normText);
  const results: ContentSearchResult[] = [];

  for (const [filePath, { name, pages }] of _index.files) {
    for (const { page, text } of pages) {
      const norm = normText(text);
      if (terms.every((t) => norm.includes(t))) {
        results.push({ path: filePath, name, page, snippet: buildSnippet(text, terms[0]) });
        if (results.length >= 100) return results;
      }
    }
  }
  return results;
}

/** Walk the filesystem recursively (not the lazy in-memory tree) to find all PDFs. */
async function collectAllPdfs(
  rootPath: string,
): Promise<{ path: string; name: string }[]> {
  const pdfs: { path: string; name: string }[] = [];

  async function walk(dirPath: string) {
    let entries: { name: string; path: string; type: string; extension?: string }[];
    try {
      entries = await window.api.readDirectory(dirPath);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.type === "directory") {
        await walk(entry.path);
      } else if (entry.extension === ".pdf") {
        pdfs.push({ path: entry.path, name: entry.name });
      }
    }
  }

  await walk(rootPath);
  return pdfs;
}

/** Render [[...]] match markers as highlighted spans */
function SnippetText({ snippet }: { snippet: string }) {
  const parts = snippet.split(/(\[\[|\]\])/);
  let inside = false;
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p === "[[") { inside = true; continue; }
    if (p === "]]") { inside = false; continue; }
    nodes.push(inside
      ? <mark key={i} className="bg-amber-200/70 dark:bg-amber-500/30 text-foreground rounded-sm px-0.5">{p}</mark>
      : <span key={i}>{p}</span>
    );
  }
  return <>{nodes}</>;
}

function useDebounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return useCallback((...args: Parameters<T>) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

// ─── Panel ────────────────────────────────────────────────────────────────────

type SearchMode = "files" | "content";

export function SearchPanel() {
  const [mode, setMode] = useState<SearchMode>("files");

  // ── Files mode state ──────────────────────────────────────────────────────
  const { query, results, isSearching, setQuery, search, clearResults } = useSearchStore();
  const { root }      = useExplorerStore();
  const { openFile }  = useEditorStore();
  const { navigateTo } = useAnotacionesStore();
  const inElectron    = useIsElectron();
  const inputRef      = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce((q: string) => search(q, root), 300);

  useEffect(() => {
    if (mode === "files") inputRef.current?.focus();
    else contentInputRef.current?.focus();
  }, [mode]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    debouncedSearch(q);
  };

  // ── Content mode state ────────────────────────────────────────────────────
  // Derived from module-level vars — force re-render with a counter
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  const [contentQuery, setContentQuery]   = useState("");
  const [contentResults, setContentResults] = useState<ContentSearchResult[]>([]);
  const abortRef = useRef(false);

  const status   = _indexStatus;
  const progress = _indexProgress;

  // If root changed, reset index
  useEffect(() => {
    if (!root) return;
    if (_index && _index.rootPath !== root.path) {
      _index = null;
      _indexStatus = "idle";
      _indexProgress = { current: 0, total: 0 };
      setContentQuery("");
      setContentResults([]);
      refresh();
    }
  }, [root?.path, refresh]);

  // ── Indexing ───────────────────────────────────────────────────────────────
  const handleIndexContent = useCallback(async () => {
    if (!root || !inElectron || _indexStatus === "indexing") return;

    abortRef.current = false;
    _index = { rootPath: root.path, files: new Map() };
    _indexStatus = "indexing";
    _indexProgress = { current: 0, total: 0 };
    _indexErrors = 0;
    _lastError = "";
    refresh();

    // Walk filesystem directly — the in-memory tree is lazy-loaded and may be incomplete
    console.log("[CONTENT INDEX] Scanning", root.path);
    const pdfs = await collectAllPdfs(root.path);
    console.log("[CONTENT INDEX] Found PDFs:", pdfs.length, pdfs.map(p => p.name));

    if (pdfs.length === 0) {
      _lastError = "No se encontraron archivos PDF en la carpeta.";
      _indexStatus = "ready";
      refresh();
      return;
    }

    _indexProgress = { current: 0, total: pdfs.length };
    refresh();

    for (let i = 0; i < pdfs.length; i++) {
      if (abortRef.current) break;
      const node = pdfs[i];

      try {
        // Extract text via main process — avoids pdfjs worker resolution issues in renderer
        const pages = await window.api.extractPdfText(node.path);

        if (pages.length > 0 && _index) {
          _index.files.set(node.path, { name: node.name, pages });
        } else {
          console.log("[CONTENT INDEX] No text in:", node.name);
        }
      } catch (err) {
        _indexErrors++;
        _lastError = String(err);
        console.error("[CONTENT INDEX] Error for", node.name, err);
      }

      _indexProgress = { current: i + 1, total: pdfs.length };
      if (i % 3 === 0) refresh(); // throttle re-renders
    }

    console.log("[CONTENT INDEX] Done. Indexed files:", _index?.files.size, "Errors:", _indexErrors, _lastError);
    _indexStatus = "ready";
    refresh();
  }, [root, inElectron, refresh]);

  const handleReindex = useCallback(() => {
    _index = null;
    _indexStatus = "idle";
    _indexProgress = { current: 0, total: 0 };
    _indexErrors = 0;
    _lastError = "";
    setContentQuery("");
    setContentResults([]);
    refresh();
    handleIndexContent();
  }, [handleIndexContent, refresh]);

  // ── Content search ─────────────────────────────────────────────────────────
  const debouncedContentSearch = useDebounce((q: string) => {
    setContentResults(searchInIndex(q));
  }, 300);

  const handleContentQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setContentQuery(q);
    if (!q.trim()) { setContentResults([]); return; }
    debouncedContentSearch(q);
  };

  const handleOpenResult = (result: ContentSearchResult) => {
    openFile({
      id: result.path, name: result.name, path: result.path, type: "pdf", loaded: true,
    });
    navigateTo(result.path, result.page);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <IconSearch size={13} className="shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Buscar
        </span>
      </div>

      <Separator className="shrink-0" />

      {/* Mode toggle */}
      <div className="flex shrink-0 border-b">
        {(["files", "content"] as SearchMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
              mode === m
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground/60 hover:text-muted-foreground",
            )}
          >
            {m === "files" ? "Archivos" : "Contenido PDF"}
          </button>
        ))}
      </div>

      {/* ── FILES MODE ─────────────────────────────────────────────────────── */}
      {mode === "files" && (
        <>
          <div className="shrink-0 px-3 py-2">
            <div className="relative">
              <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
              <input
                ref={inputRef}
                value={query}
                onChange={handleChange}
                placeholder="Buscar archivos…"
                className="h-8 w-full rounded-md border bg-muted/30 pl-8 pr-8 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); clearResults(); inputRef.current?.focus(); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                >
                  <IconX size={13} />
                </button>
              )}
            </div>
          </div>

          {query && !isSearching && (
            <p className="shrink-0 px-3 pb-1 text-[11px] text-muted-foreground/60">
              {results.length === 0 ? "Sin resultados" : `${results.length} resultado${results.length !== 1 ? "s" : ""}`}
            </p>
          )}
          {isSearching && (
            <div className="flex shrink-0 items-center gap-2 px-3 pb-2 text-muted-foreground/60">
              <IconLoader2 size={12} className="animate-spin" />
              <span className="text-[11px]">Buscando…</span>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">
            {results.map((r) => (
              <FileResultRow key={r.path} result={r} rootPath={root?.path} onClick={() =>
                openFile({ id: r.path, name: r.name, path: r.path, type: r.extension === ".pdf" ? "pdf" : r.extension === ".xml" ? "xml" : "unknown", loaded: true })
              } />
            ))}
          </div>
        </>
      )}

      {/* ── CONTENT MODE ───────────────────────────────────────────────────── */}
      {mode === "content" && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">

          {/* Not indexed */}
          {status === "idle" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
              <IconBook2 size={36} strokeWidth={1} className="text-muted-foreground/30" />
              <p className="text-[11px] text-muted-foreground/60">
                Indexa el contenido de todos los PDFs del expediente para buscar dentro de los documentos.
              </p>
              <button
                onClick={handleIndexContent}
                disabled={!root || !inElectron}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              >
                <IconDatabaseImport size={12} />
                Indexar contenido PDF
              </button>
            </div>
          )}

          {/* Indexing */}
          {status === "indexing" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4">
              <IconLoader2 size={24} className="animate-spin text-primary/60" />
              <p className="text-[11px] font-medium text-muted-foreground">Indexando PDFs…</p>
              <div className="w-full max-w-[200px]">
                <div className="mb-1 flex justify-between text-[10px] text-muted-foreground/60">
                  <span>{progress.current} / {progress.total}</span>
                  <span>{progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/40">Puedes seguir usando la app mientras se indexa</p>
            </div>
          )}

          {/* Ready — search */}
          {status === "ready" && (
            <>
              <div className="shrink-0 px-3 py-2">
                <div className="relative">
                  <IconSearch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                  <input
                    ref={contentInputRef}
                    value={contentQuery}
                    onChange={handleContentQueryChange}
                    placeholder="Buscar en documentos…"
                    className="h-8 w-full rounded-md border bg-muted/30 pl-8 pr-8 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {contentQuery && (
                    <button
                      onClick={() => { setContentQuery(""); setContentResults([]); contentInputRef.current?.focus(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
                    >
                      <IconX size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center px-3 pb-1">
                {contentQuery ? (
                  <span className="text-[10px] text-muted-foreground/60">
                    {contentResults.length === 0 ? "Sin resultados" : `${contentResults.length} resultado${contentResults.length !== 1 ? "s" : ""}`}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/40">
                    {_index ? `${_index.files.size} archivos indexados${_indexErrors > 0 ? ` · ${_indexErrors} errores` : ""}` : ""}
                  </span>
                )}
                <button
                  onClick={handleReindex}
                  title="Re-indexar"
                  className="ml-auto text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  <IconRefresh size={11} />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-auto">
                {contentResults.map((r, i) => (
                  <ContentResultRow
                    key={`${r.path}:${r.page}:${i}`}
                    result={r}
                    rootPath={root?.path}
                    onClick={() => handleOpenResult(r)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── File result row ──────────────────────────────────────────────────────────

function FileResultRow({ result, rootPath, onClick }: { result: SearchResult; rootPath?: string; onClick: () => void }) {
  const relative = rootPath ? result.path.replace(rootPath, "").replace(/^[\\/]/, "") : result.path;
  const Icon = result.extension === ".pdf" ? IconFileTypePdf : result.extension === ".xml" ? IconFileTypeXml : IconFile;
  const iconClass = result.extension === ".pdf" ? "text-red-400" : result.extension === ".xml" ? "text-blue-400" : "text-muted-foreground/40";

  return (
    <button onClick={onClick} title={result.path} className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left transition-colors hover:bg-accent">
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={cn("shrink-0", iconClass)} />
        <span className="truncate text-[13px] font-medium">{result.name}</span>
      </div>
      <span className="w-full truncate pl-5 text-[10px] text-muted-foreground/50">{relative}</span>
    </button>
  );
}

// ─── Content result row ───────────────────────────────────────────────────────

function ContentResultRow({ result, rootPath, onClick }: { result: ContentSearchResult; rootPath?: string; onClick: () => void }) {
  const relative = rootPath ? result.path.replace(rootPath, "").replace(/^[\\/]/, "") : result.path;

  return (
    <button
      onClick={onClick}
      title={`${result.path} — página ${result.page}`}
      className="flex w-full flex-col items-start gap-1 border-b border-border/40 px-3 py-2 text-left transition-colors hover:bg-accent last:border-0"
    >
      <div className="flex w-full items-center gap-1.5">
        <IconFileTypePdf size={11} className="shrink-0 text-red-400" />
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium">{result.name}</span>
        <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-semibold text-muted-foreground/70">
          pág {result.page}
        </span>
      </div>
      <p className="w-full truncate pl-4 text-[10px] text-muted-foreground/40">{relative}</p>
      <p className="pl-4 text-[10px] leading-relaxed text-muted-foreground/80 line-clamp-2">
        <SnippetText snippet={result.snippet} />
      </p>
    </button>
  );
}
