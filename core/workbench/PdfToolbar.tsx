"use client";

import { useState, useEffect, useRef } from "react";
import {
  IconZoomIn, IconZoomOut, IconMaximize,
  IconRotate, IconRotateClockwise,
  IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand,
  IconPencil, IconEraser, IconPointer,
  IconArrowBackUp, IconArrowForwardUp,
  IconEye, IconFocusCentered, IconSunHigh,
  IconLayoutGrid, IconLayoutColumns,
  IconLink, IconLinkOff,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useWorkbenchStore } from "@/state/workbench.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useDocStatusStore } from "@/state/docStatus.store";
import { useRevisionStore } from "@/state/revision.store";
import { useUXStore } from "@/state/ux.store";
import { DocStatusButton } from "@/features/pdf-viewer/DocStatusButton";
import type { AnnotationColor } from "@/types/anotaciones";
import { cn } from "@/lib/utils";

// ─── Color config ──────────────────────────────────────────────────────────────

const COLOR_DOT: Record<AnnotationColor, string> = {
  yellow: "bg-amber-400",
  green:  "bg-green-500",
  red:    "bg-red-500",
  blue:   "bg-blue-500",
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function computeRelPath(absPath: string, expedientePath: string): string {
  const norm = (p: string) => p.replace(/\\/g, "/");
  const base = norm(expedientePath).replace(/\/$/, "");
  const full = norm(absPath);
  // Case-insensitive comparison for Windows paths
  return full.toLowerCase().startsWith(base.toLowerCase()) ? full.slice(base.length) : `/${full.split("/").pop()}`;
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

export function PdfToolbar() {
  const {
    focusedPane, setFocusedPane,
    paneState, _paneActions,
    splitFile, setSplitFile,
    syncScroll, setSyncScroll,
  } = useWorkbenchStore();

  const {
    annotationMode, activeColor,
    undoStack, redoStack,
    setAnnotationMode, setActiveColor,
    undo, redo,
  } = useAnotacionesStore();

  const { isLoaded: docStatusLoaded } = useDocStatusStore();
  const meta              = useRevisionStore((s) => s.meta);
  const expedientePath    = useRevisionStore((s) => s.expedientePath);
  const { zenMode, setZenMode, readingMode } = useUXStore();

  const state   = paneState[focusedPane];
  const actions = _paneActions[focusedPane];

  // ── Page input local buffer ───────────────────────────────────────────────
  const [pageInput, setPageInput] = useState(String(state.currentPage));
  const isEditingPageRef = useRef(false);

  // Sync when page changes from scroll (not from user typing)
  useEffect(() => {
    if (!isEditingPageRef.current) setPageInput(String(state.currentPage));
  }, [state.currentPage]);

  // Reset input when switching focused pane
  useEffect(() => {
    isEditingPageRef.current = false;
    setPageInput(String(paneState[focusedPane].currentPage));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedPane]);

  const handlePageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const p = parseInt(pageInput, 10);
      if (!isNaN(p) && p >= 1 && p <= state.numPages) actions?.goToPage(p);
      else setPageInput(String(state.currentPage));
      isEditingPageRef.current = false;
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      setPageInput(String(state.currentPage));
      isEditingPageRef.current = false;
      e.currentTarget.blur();
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const isAnnotating = annotationMode === "pen";
  const isErasing    = annotationMode === "erase";
  const inSplitMode  = splitFile !== null;

  const relativeFilePath = state.file && (expedientePath ?? meta?.expedientePath)
    ? computeRelPath(state.file.path, (expedientePath ?? meta!.expedientePath)!)
    : null;

  if (!state.file || state.file.type !== "pdf") return null;

  return (
    <div className="flex shrink-0 items-center gap-1 border-b border-border bg-muted/20 px-2 py-1.5">

      {/* Thumbnail toggle */}
      <Button
        variant="ghost" size="icon" className="h-6 w-6"
        onClick={() => actions?.toggleThumbs()}
        title={state.showThumbs ? "Ocultar miniaturas" : "Mostrar miniaturas"}
      >
        {state.showThumbs
          ? <IconLayoutSidebarLeftCollapse size={13} />
          : <IconLayoutSidebarLeftExpand  size={13} />}
      </Button>

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Zen mode */}
      <Button
        variant={zenMode ? "default" : "ghost"}
        size="icon"
        className={cn(
          "h-6 w-6 relative overflow-hidden transition-all duration-500",
          zenMode && "bg-primary text-white shadow-lg ring-2 ring-primary/20 scale-105",
        )}
        onClick={() => setZenMode(!zenMode)}
        title={zenMode ? "Salir de Modo Zen (Alt+Z)" : "Modo Zen — Foco Total (Alt+Z)"}
      >
        {zenMode ? <IconEye size={13} /> : <IconFocusCentered size={13} />}
        {zenMode && <span className="absolute inset-0 bg-white/20 animate-pulse" />}
      </Button>

      {/* Reading mode */}
      <Button
        variant={readingMode ? "default" : "ghost"}
        size="icon"
        className={cn("h-6 w-6", readingMode && "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20")}
        onClick={() => actions?.toggleReadingMode()}
        title={readingMode ? "Desactivar Modo Lectura" : "Modo Lectura (Cuidado Visual)"}
      >
        <IconSunHigh size={13} />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* File name + doc status */}
      <span className="mr-1 max-w-[120px] truncate text-[11px] font-medium text-muted-foreground/80" title={state.file.name}>
        {state.file.name}
      </span>
      {relativeFilePath && docStatusLoaded && (
        <DocStatusButton relativeFilePath={relativeFilePath} />
      )}

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Page navigation */}
      <button
        onClick={() => actions?.goToPage(state.currentPage - 1)}
        disabled={state.currentPage <= 1}
        className="rounded p-0.5 text-muted-foreground/50 hover:bg-accent hover:text-foreground disabled:opacity-30"
        title="Página anterior"
      >
        ‹
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={pageInput}
        onFocus={() => { isEditingPageRef.current = true; }}
        onChange={(e) => setPageInput(e.target.value)}
        onKeyDown={handlePageKeyDown}
        onBlur={() => {
          isEditingPageRef.current = false;
          setPageInput(String(state.currentPage));
        }}
        className="h-5 w-7 rounded border border-border bg-background text-center text-[10px] font-mono focus:outline-none focus:ring-1 focus:ring-primary/40"
        title="Ir a página"
      />
      <span className="text-[10px] text-muted-foreground/50">/ {state.numPages || "—"}</span>
      <button
        onClick={() => actions?.goToPage(state.currentPage + 1)}
        disabled={state.currentPage >= state.numPages}
        className="rounded p-0.5 text-muted-foreground/50 hover:bg-accent hover:text-foreground disabled:opacity-30"
        title="Página siguiente"
      >
        ›
      </button>

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Zoom */}
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions?.zoomOut()} title="Reducir zoom (-)">
        <IconZoomOut size={13} />
      </Button>
      <button
        onClick={() => actions?.fitPage()}
        className="min-w-[42px] rounded px-1 text-center text-xs tabular-nums text-muted-foreground hover:bg-accent"
        title="Restablecer zoom (0)"
      >
        {Math.round(state.scale * 100)}%
      </button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions?.zoomIn()} title="Ampliar zoom (+)">
        <IconZoomIn size={13} />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions?.fitPage()} title="Zoom 100%">
        <IconMaximize size={13} />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Rotation */}
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions?.rotateLeft()} title="Rotar a la izquierda">
        <IconRotate size={13} />
      </Button>
      <button
        onClick={() => actions?.resetRotation()}
        className="min-w-[32px] rounded px-1 text-center text-xs tabular-nums text-muted-foreground hover:bg-accent"
        title="Restablecer rotación"
      >
        {state.rotation}°
      </button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => actions?.rotateRight()} title="Rotar a la derecha">
        <IconRotateClockwise size={13} />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Undo / Redo */}
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={undo} disabled={undoStack.length === 0} title="Deshacer (Ctrl+Z)">
        <IconArrowBackUp size={13} />
      </Button>
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={redo} disabled={redoStack.length === 0} title="Rehacer (Ctrl+Y)">
        <IconArrowForwardUp size={13} />
      </Button>

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Annotation mode */}
      <Button
        variant={annotationMode === null ? "secondary" : "ghost"}
        size="icon" className="h-6 w-6"
        onClick={() => setAnnotationMode(null)}
        title="Modo normal (cursor)"
      >
        <IconPointer size={13} />
      </Button>
      <Button
        variant={isAnnotating ? "default" : "ghost"}
        size="icon"
        className={cn("h-6 w-6", isAnnotating && "bg-amber-500 hover:bg-amber-600 text-white dark:text-white")}
        onClick={() => setAnnotationMode(isAnnotating ? null : "pen")}
        title={isAnnotating ? "Salir modo lápiz (Esc / P)" : "Modo lápiz (P)"}
      >
        <IconPencil size={13} />
      </Button>
      <Button
        variant={isErasing ? "default" : "ghost"}
        size="icon"
        className={cn("h-6 w-6", isErasing && "bg-red-500 hover:bg-red-600 text-white dark:text-white")}
        onClick={() => setAnnotationMode(isErasing ? null : "erase")}
        title={isErasing ? "Salir modo borrador (Esc / E)" : "Borrador (E)"}
      >
        <IconEraser size={13} />
      </Button>

      {/* Color picker — only while pen active */}
      {isAnnotating && (
        <div className="flex items-center gap-1 pl-1">
          {(["yellow", "green", "red", "blue"] as AnnotationColor[]).map((c) => (
            <button
              key={c}
              onClick={() => setActiveColor(c)}
              className={cn(
                "h-3.5 w-3.5 rounded-full transition-all",
                COLOR_DOT[c],
                activeColor === c ? "ring-2 ring-primary ring-offset-1 scale-110" : "opacity-60 hover:opacity-100",
              )}
              title={c}
            />
          ))}
        </div>
      )}

      <Separator orientation="vertical" className="mx-1 h-4" />

      {/* Gallery */}
      <Button
        variant={state.galleryMode ? "secondary" : "ghost"}
        size="icon" className="h-6 w-6"
        onClick={() => actions?.toggleGallery()}
        title={state.galleryMode ? "Salir de vista galería" : "Vista galería de páginas"}
      >
        <IconLayoutGrid size={13} />
      </Button>

      {/* Split — only in single mode */}
      {!inSplitMode && (
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          onClick={() => actions?.openInSplit()}
          title="Abrir en panel dividido"
        >
          <IconLayoutColumns size={13} />
        </Button>
      )}

      {/* Sync scroll — only in split mode */}
      {inSplitMode && (
        <Button
          variant={syncScroll ? "secondary" : "ghost"}
          size="icon"
          className={cn("h-6 w-6", syncScroll && "text-primary")}
          onClick={() => setSyncScroll(!syncScroll)}
          title={syncScroll ? "Desactivar scroll sincronizado" : "Sincronizar scroll de ambos paneles"}
        >
          {syncScroll ? <IconLink size={13} /> : <IconLinkOff size={13} />}
        </Button>
      )}

      {/* Close split — only in split mode */}
      {inSplitMode && (
        <Button
          variant="ghost" size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={() => setSplitFile(null)}
          title="Cerrar panel dividido"
        >
          ✕
        </Button>
      )}

      {/* Pane focus indicator — subtle, only in split */}
      {inSplitMode && (
        <div className="ml-auto flex items-center gap-1">
          {(["left", "right"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFocusedPane(p)}
              className={cn(
                "h-5 rounded px-1.5 text-[9px] font-semibold uppercase tracking-wider transition-colors",
                focusedPane === p
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground/40 hover:text-muted-foreground",
              )}
              title={`Controlar panel ${p === "left" ? "izquierdo" : "derecho"}`}
            >
              {p === "left" ? "L" : "R"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
