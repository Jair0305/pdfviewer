"use client";

import { useRef, useEffect, useState } from "react";
import {
  IconQuote,
  IconFolderOpen,
  IconTrash,
  IconCopy,
  IconCloudOff,
  IconFileText,
  IconArrowUpRight,
  IconArrowDownRight,
  IconGripVertical,
} from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { useCitasStore } from "@/state/citas.store";
import { useRevisionStore } from "@/state/revision.store";
import { useEditorStore } from "@/state/editor.store";
import { useExplorerStore } from "@/state/explorer.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useWorkbenchStore } from "@/state/workbench.store";
import type { Cita, CitaDragPayload } from "@/types/citas";
import { CITA_DRAG_TYPE } from "@/types/citas";
import type { AnnotationColor } from "@/types/anotaciones";
import type { FileNode } from "@/types/expediente";
import { cn } from "@/lib/utils";

// ─── Color config ─────────────────────────────────────────────────────────────

const COLOR_DOT: Record<AnnotationColor, string> = {
  yellow: "bg-amber-400",
  green:  "bg-green-500",
  red:    "bg-red-500",
  blue:   "bg-blue-500",
};

const COLOR_BORDER: Record<AnnotationColor, string> = {
  yellow: "border-amber-500/30",
  green:  "border-green-500/30",
  red:    "border-red-500/30",
  blue:   "border-blue-500/30",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function absoluteFrom(expedientePath: string, relativeFilePath: string): string {
  return expedientePath.replace(/\/$/, "") + "/" + relativeFilePath.replace(/^\//, "");
}

function findFileNode(root: FileNode | null, absoluteFwdPath: string): FileNode | null {
  if (!root) return null;
  const norm = (p: string) => p.replace(/\\/g, "/");
  function walk(node: FileNode): FileNode | null {
    if (norm(node.path) === absoluteFwdPath) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = walk(child);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(root);
}

// ─── Cita row ─────────────────────────────────────────────────────────────────

function CitaRow({
  cita,
  onNavigateSource,
  onNavigateTarget,
  onDelete,
  onNoteChange,
}: {
  cita: Cita;
  onNavigateSource: () => void;
  onNavigateTarget: (() => void) | null;
  onDelete: () => void;
  onNoteChange: (note: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const sourceName = cita.relativeFilePath?.split("/").filter(Boolean).pop() ?? null;
  const targetName = cita.targetRelativeFilePath?.split("/").filter(Boolean).pop() ?? null;
  const isBidirectional = !!cita.targetRelativeFilePath;

  const handleDragStart = (e: React.DragEvent) => {
    const payload: CitaDragPayload = {
      text:             cita.text,
      relativeFilePath: cita.relativeFilePath,
      pageNumber:       cita.pageNumber,
      color:            cita.color,
      normalizedRects:  [],        // already-created citas don't carry rects
      existingCitaId:   cita.id,   // signals "update me, don't duplicate"
    };
    e.dataTransfer.setData(CITA_DRAG_TYPE, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(cita.text).catch(() => {});
  };

  return (
    <div className={cn("rounded-md border bg-card", COLOR_BORDER[cita.color])}>
      {/* Quote text */}
      <div className="flex items-start gap-1 px-2 pt-2">
        {/* Drag handle — only this element is draggable */}
        <span
          draggable
          onDragStart={handleDragStart}
          title="Arrastra hacia una nota para vincularla"
          className="mt-0.5 shrink-0 cursor-grab text-muted-foreground/30 hover:text-muted-foreground/60 active:cursor-grabbing"
        >
          <IconGripVertical size={10} />
        </span>
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", COLOR_DOT[cita.color])} />
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-foreground line-clamp-3">
          &ldquo;{cita.text}&rdquo;
        </p>
      </div>

      {/* Source reference */}
      {cita.relativeFilePath && (
        <button
          onClick={onNavigateSource}
          className="flex items-center gap-1 px-2 pb-0 pt-0.5 text-left hover:underline"
          title="Ir al origen del fragmento"
        >
          <IconArrowUpRight size={9} className="shrink-0 text-muted-foreground/40" />
          <span className="text-[9px] text-muted-foreground/60 truncate max-w-[150px]">
            {sourceName}{cita.pageNumber !== null ? ` · pág ${cita.pageNumber}` : ""}
          </span>
        </button>
      )}

      {/* Target reference — only for bidirectional links (dropped onto a page) */}
      {isBidirectional && onNavigateTarget && (
        <button
          onClick={onNavigateTarget}
          className="flex items-center gap-1 px-2 pb-0.5 pt-0 text-left hover:underline"
          title="Ir al documento destino del enlace"
        >
          <IconArrowDownRight size={9} className="shrink-0 text-primary/50" />
          <span className="text-[9px] text-primary/60 truncate max-w-[150px]">
            {targetName}{cita.targetPageNumber !== undefined ? ` · pág ${cita.targetPageNumber}` : ""}
          </span>
        </button>
      )}

      {/* Note input + actions */}
      <div className="flex items-center gap-1 border-t px-2 py-1">
        <input
          ref={inputRef}
          value={cita.note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Apunte…"
          className={cn(
            "min-w-0 flex-1 rounded bg-transparent px-0 text-[10px] text-muted-foreground",
            "placeholder:text-muted-foreground/30 focus:outline-none",
          )}
        />
        <button
          onClick={handleCopy}
          className="rounded p-0.5 text-muted-foreground/50 hover:bg-accent hover:text-foreground"
          title="Copiar texto"
        >
          <IconCopy size={10} />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-0.5 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
          title="Eliminar cita"
        >
          <IconTrash size={10} />
        </button>
      </div>
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function CitasPanel() {
  const { citas, isLoaded, deleteCita, updateCitaNote, addCita } = useCitasStore();
  const [isDragOver, setIsDragOver] = useState(false);
  const { isLoaded: revLoaded, meta, isOutsideClientes } = useRevisionStore();
  const { openFile } = useEditorStore();
  const { root }     = useExplorerStore();
  const { navigateTo } = useAnotacionesStore();
  const { focusedPane, splitFile, setSplitFile } = useWorkbenchStore();

  /** Navigate to a relativeFilePath + pageNumber, routing to the focused pane. */
  const navigateToLocation = (relPath: string, page: number | null | undefined, citaId: string) => {
    const expPath = meta?.expedientePath;
    if (!expPath) return;
    const absFwd   = absoluteFrom(expPath, relPath);
    const node     = findFileNode(root, absFwd);
    const fileNode = node ?? {
      id: absFwd,
      name: relPath.split("/").filter(Boolean).pop() ?? "",
      type: "pdf" as const,
      path: absFwd,
      loaded: true,
    };
    if (focusedPane === "right" && splitFile !== null) setSplitFile(fileNode);
    else openFile(fileNode);
    if (page != null) navigateTo(absFwd, page, citaId, focusedPane);
  };

  const handleNavigateSource = (cita: Cita) => {
    if (!cita.relativeFilePath) return;
    navigateToLocation(cita.relativeFilePath, cita.pageNumber, cita.id);
  };

  const handleNavigateTarget = (cita: Cita): (() => void) | null => {
    if (!cita.targetRelativeFilePath) return null;
    return () => navigateToLocation(cita.targetRelativeFilePath!, cita.targetPageNumber, cita.id);
  };

  if (!revLoaded || !isLoaded) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <IconFolderOpen size={36} strokeWidth={1} className="opacity-30" />
        <p className="text-sm">Abre un expediente para ver citas</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <IconQuote size={13} className="shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Citas y fragmentos
        </span>
        {citas.length > 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground/60">{citas.length}</span>
        )}
      </div>

      <Separator className="shrink-0" />

      {/* Memory-only banner */}
      {isOutsideClientes && (
        <div className="flex shrink-0 items-center gap-2 border-b border-muted bg-muted/40 px-3 py-1.5">
          <IconCloudOff size={11} className="shrink-0 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground">
            Fuera de la carpeta de clientes — solo memoria
          </span>
        </div>
      )}

      {/* List — also a drop zone for un-anchored citas */}
      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto transition-colors",
          isDragOver && "bg-primary/5 ring-1 ring-inset ring-primary/30",
        )}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(CITA_DRAG_TYPE)) {
            e.preventDefault();
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const raw = e.dataTransfer.getData(CITA_DRAG_TYPE);
          if (!raw) return;
          const payload = JSON.parse(raw) as CitaDragPayload;
          addCita({
            id:               crypto.randomUUID(),
            text:             payload.text,
            relativeFilePath: payload.relativeFilePath,
            pageNumber:       payload.pageNumber,
            color:            payload.color,
            note:             "",
            createdAt:        new Date().toISOString(),
          });
        }}
      >
        {isDragOver && (
          <div className="mx-3 mt-3 rounded-md border-2 border-dashed border-primary/30 py-3 text-center">
            <p className="text-[10px] text-primary/60">Suelta para añadir a citas</p>
          </div>
        )}
        <div className="space-y-2 p-3">
          {citas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
              <IconQuote size={32} strokeWidth={1} className="opacity-20" />
              <p className="text-center text-[11px] opacity-50">
                Selecciona texto en el PDF y usa
                <br />
                el botón de cita para guardar fragmentos
              </p>
            </div>
          ) : (
            [...citas].reverse().map((cita) => (
              <CitaRow
                key={cita.id}
                cita={cita}
                onNavigateSource={() => handleNavigateSource(cita)}
                onNavigateTarget={handleNavigateTarget(cita)}
                onDelete={() => deleteCita(cita.id)}
                onNoteChange={(note) => updateCitaNote(cita.id, note)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
