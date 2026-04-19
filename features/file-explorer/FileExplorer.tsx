"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  IconFiles, IconFolderOpen, IconFolderPlus, IconFilePlus, IconFolderX,
  IconFilter, IconX,
} from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { VirtualFileTree } from "./VirtualFileTree";
import { useExplorerStore } from "@/state/explorer.store";
import { useDocStatusStore } from "@/state/docStatus.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useRevisionStore } from "@/state/revision.store";
import { useIsElectron } from "@/hooks/useIsElectron";
import type { FileNode } from "@/types/expediente";
import type { DocStatus } from "@/types/docStatus";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreatingState { parentPath: string; type: "file" | "folder"; }

type ActiveFilter = DocStatus | "pdf" | "anotaciones" | null;

// ─── Filter helpers ───────────────────────────────────────────────────────────

function computeRelPath(filePath: string, expedientePath: string): string {
  const fwd    = filePath.replace(/\\/g, "/");
  const expFwd = expedientePath.replace(/\\/g, "/").replace(/\/$/, "");
  if (fwd.startsWith(expFwd + "/")) return fwd.slice(expFwd.length);
  return "/" + (fwd.split("/").pop() ?? fwd);
}

function filterTree(
  nodes: FileNode[],
  filter: ActiveFilter,
  statuses: Record<string, DocStatus>,
  annotatedPaths: Set<string>,
  expedientePath: string | null,
): FileNode[] {
  if (!filter) return nodes;
  return nodes.flatMap((node) => {
    if (node.type === "folder") {
      const children = filterTree(node.children ?? [], filter, statuses, annotatedPaths, expedientePath);
      return children.length > 0 ? [{ ...node, children }] : [];
    }
    // File: check filter
    if (filter === "pdf") return node.type === "pdf" ? [node] : [];
    const rel = expedientePath ? computeRelPath(node.path, expedientePath) : null;
    if (filter === "anotaciones") return rel && annotatedPaths.has(rel) ? [node] : [];
    // Doc status filters
    const status = rel ? (statuses[rel] ?? "sin_revisar") : "sin_revisar";
    return status === filter ? [node] : [];
  });
}

// ─── Filter chip ──────────────────────────────────────────────────────────────

const FILTER_CFG: { id: ActiveFilter; label: string; dot?: string }[] = [
  { id: "sin_revisar",       label: "Sin revisar",       dot: "bg-muted-foreground/40" },
  { id: "en_revision",       label: "En revisión",       dot: "bg-amber-500"           },
  { id: "revisado",          label: "Revisado",           dot: "bg-green-500"           },
  { id: "con_observaciones", label: "Con observaciones", dot: "bg-red-500"             },
  { id: "pdf",               label: "Solo PDF"                                         },
  { id: "anotaciones",       label: "Con anotaciones"                                  },
];

function FilterChip({
  cfg, active, onClick,
}: {
  cfg: typeof FILTER_CFG[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-all",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-transparent text-muted-foreground/60 hover:border-border hover:text-foreground",
      )}
    >
      {cfg.dot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", cfg.dot)} />}
      {cfg.label}
    </button>
  );
}

// ─── FileExplorer ─────────────────────────────────────────────────────────────

export function FileExplorer() {
  const { root, openDirectory, closeDirectory, createFileNode, createFolderNode } = useExplorerStore();
  const { statuses }    = useDocStatusStore();
  const annotations     = useAnotacionesStore((s) => s.annotations);
  const expedientePath  = useRevisionStore((s) => s.meta?.expedientePath ?? null);
  const inElectron      = useIsElectron();

  const [creating,      setCreating]      = useState<CreatingState | null>(null);
  const [activeFilter,  setActiveFilter]  = useState<ActiveFilter>(null);
  const [showFilters,   setShowFilters]   = useState(false);

  // Listen for context-menu triggered create events from VirtualFileTree
  useEffect(() => {
    const handler = (e: Event) => {
      const { parentPath, type } = (e as CustomEvent).detail as CreatingState;
      setCreating({ parentPath, type });
    };
    window.addEventListener("explorer:create", handler);
    return () => window.removeEventListener("explorer:create", handler);
  }, []);

  // Reset filter when expediente changes
  useEffect(() => { setActiveFilter(null); setShowFilters(false); }, [root?.path]);

  const handleCreatingCommit = useCallback(async (name: string) => {
    if (!creating) return;
    setCreating(null);
    if (creating.type === "file") await createFileNode(creating.parentPath, name);
    else await createFolderNode(creating.parentPath, name);
  }, [creating, createFileNode, createFolderNode]);

  const handleCreatingCancel = useCallback(() => setCreating(null), []);

  const startCreate = useCallback((type: "file" | "folder") => {
    if (!root) return;
    setCreating({ parentPath: root.path, type });
  }, [root]);

  const toggleFilter = (id: ActiveFilter) => setActiveFilter((prev) => prev === id ? null : id);

  // Pre-compute set of relPaths that have annotations — O(annotations) once
  const annotatedPaths = useMemo(() => {
    const set = new Set<string>();
    for (const ann of annotations) {
      if (ann.relativeFilePath) set.add(ann.relativeFilePath);
    }
    return set;
  }, [annotations]);

  // Apply filter to tree — O(nodes) per render
  const filteredNodes = useMemo(() => {
    if (!root) return [];
    return filterTree(root.children ?? [], activeFilter, statuses, annotatedPaths, expedientePath);
  }, [root, activeFilter, statuses, annotatedPaths, expedientePath]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <IconFiles size={13} className="shrink-0 text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Explorador
          </span>
        </div>

        {inElectron && (
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Abrir carpeta…" onClick={openDirectory}>
              <IconFolderOpen size={14} />
            </Button>
            {root && (
              <>
                <Button
                  variant="ghost" size="icon"
                  className={cn("h-6 w-6 transition-colors", showFilters && "text-primary bg-primary/8")}
                  title="Filtrar archivos"
                  onClick={() => setShowFilters((v) => !v)}
                >
                  <IconFilter size={13} />
                  {activeFilter && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Nuevo archivo" onClick={() => startCreate("file")}>
                  <IconFilePlus size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" title="Nueva carpeta" onClick={() => startCreate("folder")}>
                  <IconFolderPlus size={14} />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/60 hover:text-destructive" title="Cerrar expediente" onClick={closeDirectory}>
                  <IconFolderX size={14} />
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <Separator className="shrink-0" />

      {!root ? (
        <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 text-center text-muted-foreground">
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40 dark:mix-blend-screen">
            <div className="h-48 w-48 rounded-full bg-primary/10 blur-[60px]" />
          </div>
          <div className="relative z-10 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-500">
            <div className="text-foreground/20"><IconFolderOpen size={44} strokeWidth={1} /></div>
            {inElectron ? (
              <>
                <p className="text-[13px] font-medium text-foreground/80">Ningún expediente abierto</p>
                <Button variant="outline" size="sm" className="mt-2 h-8 gap-2 bg-background/50 backdrop-blur hover:bg-accent text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95" onClick={openDirectory}>
                  <IconFolderPlus size={14} />Abrir carpeta
                </Button>
              </>
            ) : (
              <p className="text-xs max-w-[180px] opacity-70">Abre la app en Electron para navegar archivos</p>
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Root label */}
          <div className="flex shrink-0 items-center gap-1.5 px-3 py-1.5">
            <IconFolderOpen size={13} className="shrink-0 text-yellow-500" />
            <span className="truncate text-[11px] font-medium text-muted-foreground">{root.name}</span>
          </div>

          {/* Filter bar — shown when toggle is active */}
          {showFilters && (
            <div className="shrink-0 border-b border-border/40 bg-muted/5 px-2 py-2 animate-in slide-in-from-top-1 duration-150">
              <div className="flex flex-wrap gap-1">
                {FILTER_CFG.map((cfg) => (
                  <FilterChip
                    key={String(cfg.id)}
                    cfg={cfg}
                    active={activeFilter === cfg.id}
                    onClick={() => toggleFilter(cfg.id)}
                  />
                ))}
                {activeFilter && (
                  <button
                    onClick={() => setActiveFilter(null)}
                    className="flex items-center gap-0.5 rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-[9px] font-semibold text-destructive/80 hover:bg-destructive/10 transition-colors"
                  >
                    <IconX size={9} />Limpiar
                  </button>
                )}
              </div>
              {activeFilter && (
                <p className="mt-1.5 text-[9px] text-muted-foreground/40 px-0.5">
                  {filteredNodes.reduce((n, node) => n + (node.type !== "folder" ? 1 : 0), 0)} archivos · filtrando por "{FILTER_CFG.find((f) => f.id === activeFilter)?.label}"
                </p>
              )}
            </div>
          )}

          {/* Virtualized tree */}
          <div className="min-h-0 flex-1">
            <VirtualFileTree
              nodes={filteredNodes}
              creating={creating}
              onCreatingCommit={handleCreatingCommit}
              onCreatingCancel={handleCreatingCancel}
            />
          </div>
        </>
      )}
    </div>
  );
}
