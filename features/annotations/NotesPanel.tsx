"use client";

import { useMemo, useRef, useEffect } from "react";
import {
  IconNotes,
  IconFolderOpen,
  IconFileText,
  IconBookmark,
  IconTrash,
  IconPlus,
  IconChevronRight,
  IconCloudOff,
  IconFilePlus,
} from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useRevisionStore } from "@/state/revision.store";
import { useEditorStore } from "@/state/editor.store";
import { useExplorerStore } from "@/state/explorer.store";
import type { Annotation, AnnotationColor } from "@/types/anotaciones";
import type { FileNode } from "@/types/expediente";
import { cn } from "@/lib/utils";

// ─── Color map ────────────────────────────────────────────────────────────────

const COLOR_CLASS: Record<AnnotationColor, string> = {
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

function absoluteFrom(expedientePath: string, relativeFilePath: string): string {
  return expedientePath.replace(/\/$/, "") + "/" + relativeFilePath.replace(/^\//, "");
}

/** Compute relative path from absolute file path + expediente root. */
function relativeFrom(filePath: string, expedientePath: string): string {
  const fwd    = filePath.replace(/\\/g, "/");
  const expFwd = expedientePath.replace(/\\/g, "/").replace(/\/$/, "");
  if (fwd.startsWith(expFwd + "/")) return fwd.slice(expFwd.length);
  return "/" + (fwd.split("/").pop() ?? fwd);
}

// ─── Note row ─────────────────────────────────────────────────────────────────

function NoteRow({
  annotation,
  isEditing,
  onNavigate,
  onEdit,
  onDelete,
}: {
  annotation: Annotation;
  isEditing: boolean;
  onNavigate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { updateAnnotationText, updateAnnotationColor } = useAnotacionesStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      // Small delay so the textarea is visible before focusing
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  return (
    <div
      className={cn(
        "group rounded-md border bg-card transition-colors",
        COLOR_BORDER[annotation.color],
        isEditing && "ring-1 ring-primary/30",
      )}
    >
      {/* Row header */}
      <div
        className="flex cursor-pointer items-start gap-1.5 px-2 py-1.5"
        onClick={onNavigate}
      >
        {annotation.path ? (
          <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", COLOR_CLASS[annotation.color])} />
        ) : (
          <IconBookmark
            size={10}
            className={cn("mt-0.5 shrink-0", {
              "text-amber-500": annotation.color === "yellow",
              "text-green-500": annotation.color === "green",
              "text-red-500":   annotation.color === "red",
              "text-blue-500":  annotation.color === "blue",
            })}
          />
        )}

        <p className="min-w-0 flex-1 truncate text-[11px] leading-relaxed text-foreground">
          {annotation.text || (
            <span className="italic text-muted-foreground/60">Sin nota…</span>
          )}
        </p>

        <div className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Editar nota"
          >
            <IconChevronRight
              size={10}
              className={cn("transition-transform", isEditing && "rotate-90")}
            />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Eliminar anotación"
          >
            <IconTrash size={10} />
          </button>
        </div>
      </div>

      {/* Inline editor */}
      {isEditing && (
        <div className="border-t px-2 pb-2 pt-1.5">
          <textarea
            ref={textareaRef}
            value={annotation.text}
            onChange={(e) => updateAnnotationText(annotation.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                useAnotacionesStore.getState().setEditingAnnotation(null);
                e.currentTarget.blur();
              }
            }}
            placeholder="Escribe tu apunte…"
            rows={3}
            className={cn(
              "w-full resize-none rounded border border-input bg-background px-2 py-1.5",
              "text-[11px] leading-relaxed placeholder:text-muted-foreground/50",
              "focus:outline-none focus:ring-1 focus:ring-ring",
            )}
          />

          {/* Color selector */}
          <div className="mt-1.5 flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground/60">Color:</span>
            {(["yellow", "green", "red", "blue"] as AnnotationColor[]).map((c) => (
              <button
                key={c}
                onClick={() => updateAnnotationColor(annotation.id, c)}
                className={cn(
                  "h-3.5 w-3.5 rounded-full transition-all",
                  COLOR_CLASS[c],
                  annotation.color === c
                    ? "ring-2 ring-primary ring-offset-1"
                    : "opacity-60 hover:opacity-100",
                )}
                title={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function NotesPanel() {
  const {
    annotations,
    isLoaded,
    editingAnnotationId,
    setEditingAnnotation,
    deleteAnnotation,
    navigateTo,
    addAnnotation,
  } = useAnotacionesStore();

  const { isLoaded: revLoaded, meta, isOutsideClientes } = useRevisionStore();
  const activeTab = useEditorStore((s) => s.activeTab());
  const { openFile } = useEditorStore();
  const { root } = useExplorerStore();
  const currentVisiblePage = useAnotacionesStore((s) => s.currentVisiblePage);

  // Relative path of the currently open file (if any)
  const activeRelativePath = useMemo(() => {
    if (!activeTab) return null;
    if (meta) return relativeFrom(activeTab.path, meta.expedientePath);
    return `/${activeTab.name}`;
  }, [activeTab, meta]);

  // ── Add manual note for the currently open file ───────────────────────────

  /** Document-level note for the active file (no page anchor) */
  const addNoteForActiveFile = () => {
    addAnnotation({
      id: crypto.randomUUID(),
      relativeFilePath: activeRelativePath,
      pageNumber: null,
      path: null,
      color: "blue",
      text: "",
    });
  };

  /** Page-specific note for the current visible page */
  const addNoteForCurrentPage = () => {
    addAnnotation({
      id: crypto.randomUUID(),
      relativeFilePath: activeRelativePath,
      pageNumber: currentVisiblePage,
      path: null,
      color: "blue",
      text: "",
    });
  };

  const addNoteForFile = (relPath: string) => {
    addAnnotation({
      id: crypto.randomUUID(),
      relativeFilePath: relPath,
      pageNumber: null,
      path: null,
      color: "blue",
      text: "",
    });
  };

  // ── Navigate to annotation ────────────────────────────────────────────────

  const handleNavigate = (annotation: Annotation) => {
    const pageNumber = annotation.pageNumber ?? 1;

    if (!annotation.relativeFilePath) return; // expediente-level notes have no nav target

    const expPath = meta?.expedientePath;
    if (!expPath) return;

    const absFwd = absoluteFrom(expPath, annotation.relativeFilePath);
    const node   = findFileNode(root, absFwd);

    if (node) {
      openFile(node);
    } else {
      const name = annotation.relativeFilePath.split("/").filter(Boolean).pop() ?? "";
      openFile({ id: absFwd, name, type: "pdf", path: absFwd, loaded: true });
    }

    // Always navigate (even doc-level notes → page 1), passing the ID for flash effect
    navigateTo(absFwd, pageNumber, annotation.id);
  };

  // ── Group annotations into tree ───────────────────────────────────────────

  const tree = useMemo(() => {
    const expedienteNotes: Annotation[] = [];
    const byFile = new Map<string, Map<number | null, Annotation[]>>();

    for (const ann of annotations) {
      if (!ann.relativeFilePath) {
        expedienteNotes.push(ann);
        continue;
      }
      if (!byFile.has(ann.relativeFilePath)) byFile.set(ann.relativeFilePath, new Map());
      const pageMap = byFile.get(ann.relativeFilePath)!;
      const key = ann.pageNumber;
      if (!pageMap.has(key)) pageMap.set(key, []);
      pageMap.get(key)!.push(ann);
    }

    return { expedienteNotes, byFile };
  }, [annotations]);

  // ── Loading state ─────────────────────────────────────────────────────────

  if (!revLoaded || !isLoaded) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <IconFolderOpen size={36} strokeWidth={1} className="opacity-30" />
        <p className="text-sm">Abre un expediente para anotar</p>
      </div>
    );
  }

  const totalCount = annotations.length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <IconNotes size={13} className="shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Notas y anotaciones
        </span>
        {totalCount > 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground/60">{totalCount}</span>
        )}
      </div>

      <Separator className="shrink-0" />

      {/* Quick-add bar: per-page or general note for the current file */}
      {activeRelativePath && (
        <div className="flex shrink-0 items-center gap-2 border-b bg-muted/10 px-3 py-1.5">
          <IconFilePlus size={11} className="shrink-0 text-muted-foreground/60" />
          <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground/70">
            {activeTab?.name}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-5 gap-1 px-2 text-[10px] text-muted-foreground"
              onClick={addNoteForCurrentPage}
              title={`Agregar nota para la página ${currentVisiblePage}`}
            >
              <IconPlus size={9} />
              Pág. {currentVisiblePage}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 gap-1 px-2 text-[10px] text-muted-foreground/60"
              onClick={addNoteForActiveFile}
              title="Agregar nota general del documento (sin página específica)"
            >
              <IconPlus size={9} />
              General
            </Button>
          </div>
        </div>
      )}

      {/* Memory-only banner */}
      {isOutsideClientes && (
        <div className="flex shrink-0 items-center gap-2 border-b border-muted bg-muted/40 px-3 py-1.5">
          <IconCloudOff size={11} className="shrink-0 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground">
            Fuera de la carpeta de clientes — solo memoria, no se guarda
          </span>
        </div>
      )}

      {/* Scrollable tree */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 p-3">

          {/* Expediente-level notes */}
          <div>
            <div className="mb-1.5 flex items-center gap-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Expediente
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-4 w-4 text-muted-foreground"
                title="Agregar nota general del expediente"
                onClick={() =>
                  addAnnotation({ id: crypto.randomUUID(), relativeFilePath: null, pageNumber: null, path: null, color: "blue", text: "" })
                }
              >
                <IconPlus size={10} />
              </Button>
            </div>

            {tree.expedienteNotes.length === 0 ? (
              <p className="px-1 text-[10px] italic text-muted-foreground/40">Sin notas generales</p>
            ) : (
              <div className="space-y-1">
                {tree.expedienteNotes.map((ann) => (
                  <NoteRow
                    key={ann.id}
                    annotation={ann}
                    isEditing={editingAnnotationId === ann.id}
                    onNavigate={() => handleNavigate(ann)}
                    onEdit={() => setEditingAnnotation(editingAnnotationId === ann.id ? null : ann.id)}
                    onDelete={() => deleteAnnotation(ann.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Per-file groups */}
          {Array.from(tree.byFile.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([relPath, pageMap]) => {
              const fileName = relPath.split("/").filter(Boolean).pop() ?? relPath;
              return (
                <div key={relPath}>
                  {/* File header with + button */}
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <IconFileText size={11} className="shrink-0 text-muted-foreground/60" />
                    <p
                      className="min-w-0 flex-1 truncate text-[10px] font-semibold text-muted-foreground/80"
                      title={relPath}
                    >
                      {fileName}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      title="Agregar nota para este archivo"
                      onClick={() => addNoteForFile(relPath)}
                    >
                      <IconPlus size={10} />
                    </Button>
                  </div>

                  {/* Per-page groups */}
                  <div className="space-y-2 pl-3">
                    {Array.from(pageMap.entries())
                      .sort(([a], [b]) => (a ?? -1) - (b ?? -1))
                      .map(([pageNum, anns]) => (
                        <div key={pageNum ?? "doc"}>
                          {pageNum !== null && (
                            <p className="mb-1 text-[10px] text-muted-foreground/50">
                              Página {pageNum}
                            </p>
                          )}
                          <div className="space-y-1">
                            {anns.map((ann) => (
                              <NoteRow
                                key={ann.id}
                                annotation={ann}
                                isEditing={editingAnnotationId === ann.id}
                                onNavigate={() => handleNavigate(ann)}
                                onEdit={() =>
                                  setEditingAnnotation(editingAnnotationId === ann.id ? null : ann.id)
                                }
                                onDelete={() => deleteAnnotation(ann.id)}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}

          {/* Empty state */}
          {totalCount === 0 && (
            <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
              <IconNotes size={32} strokeWidth={1} className="opacity-20" />
              <p className="text-center text-[11px] opacity-50">
                Usa el modo anotación (lápiz) en el visor
                <br />
                para dibujar en el PDF, o usa
                <br />
                &ldquo;Nueva nota&rdquo; para escribir un apunte
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
