"use client";

import { useEffect, useRef, useCallback } from "react";
import { IconSearch, IconLoader2, IconFileTypePdf, IconFileTypeXml, IconFile, IconX } from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { useSearchStore } from "@/state/search.store";
import { useExplorerStore } from "@/state/explorer.store";
import { useEditorStore } from "@/state/editor.store";
import type { SearchResult } from "@/types/expediente";
import { cn } from "@/lib/utils";

// Simple debounce
function useDebounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  return useCallback((...args: Parameters<T>) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]);
}

export function SearchPanel() {
  const { query, results, isSearching, setQuery, search, clearResults } = useSearchStore();
  const { root } = useExplorerStore();
  const { openFile } = useEditorStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(
    (q: string) => search(q, root),
    300,
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    debouncedSearch(q);
  };

  const handleClear = () => {
    setQuery("");
    clearResults();
    inputRef.current?.focus();
  };

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

      {/* Search input */}
      <div className="shrink-0 px-3 py-2">
        <div className="relative">
          <IconSearch
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="Buscar archivos…"
            className={cn(
              "h-8 w-full rounded-md border bg-muted/30 pl-8 pr-8 text-sm",
              "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring",
            )}
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground"
            >
              <IconX size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {query && !isSearching && (
        <p className="shrink-0 px-3 pb-1 text-[11px] text-muted-foreground/60">
          {results.length === 0
            ? "Sin resultados"
            : `${results.length} resultado${results.length !== 1 ? "s" : ""}`}
        </p>
      )}

      {/* Loading */}
      {isSearching && (
        <div className="flex shrink-0 items-center gap-2 px-3 pb-2 text-muted-foreground/60">
          <IconLoader2 size={12} className="animate-spin" />
          <span className="text-[11px]">Buscando…</span>
        </div>
      )}

      {/* Results list */}
      <div className="min-h-0 flex-1 overflow-auto">
        {results.map((result) => (
          <SearchResultRow
            key={result.path}
            result={result}
            rootPath={root?.path}
            onClick={() => {
              // Build a minimal FileNode to open
              openFile({
                id: result.path,
                name: result.name,
                path: result.path,
                type: result.extension === ".pdf" ? "pdf" : result.extension === ".xml" ? "xml" : "unknown",
                loaded: true,
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Result row ───────────────────────────────────────────────────────────────

function SearchResultRow({
  result,
  rootPath,
  onClick,
}: {
  result: SearchResult;
  rootPath?: string;
  onClick: () => void;
}) {
  const relative = rootPath
    ? result.path.replace(rootPath, "").replace(/^[\\/]/, "")
    : result.path;

  const Icon =
    result.extension === ".pdf"
      ? IconFileTypePdf
      : result.extension === ".xml"
        ? IconFileTypeXml
        : IconFile;

  const iconClass =
    result.extension === ".pdf"
      ? "text-red-400"
      : result.extension === ".xml"
        ? "text-blue-400"
        : "text-muted-foreground/40";

  return (
    <button
      onClick={onClick}
      title={result.path}
      className="flex w-full flex-col items-start gap-0.5 px-3 py-1.5 hover:bg-accent transition-colors text-left"
    >
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={cn("shrink-0", iconClass)} />
        <span className="text-[13px] font-medium truncate">{result.name}</span>
      </div>
      <span className="pl-5 text-[10px] text-muted-foreground/50 truncate w-full">{relative}</span>
    </button>
  );
}
