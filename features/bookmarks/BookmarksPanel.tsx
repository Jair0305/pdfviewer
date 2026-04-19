"use client";

import { useState } from "react";
import {
  IconBookmark,
  IconTrash,
  IconFolderOpen,
  IconChevronRight,
  IconChevronDown,
  IconCloudOff,
} from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { useBookmarksStore } from "@/state/bookmarks.store";
import { useRevisionStore } from "@/state/revision.store";
import { useEditorStore } from "@/state/editor.store";
import { useExplorerStore } from "@/state/explorer.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useWorkbenchStore } from "@/state/workbench.store";
import type { Bookmark } from "@/types/bookmarks";
import type { FileNode } from "@/types/expediente";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function absoluteFrom(expedientePath: string, relativeFilePath: string): string {
  return expedientePath.replace(/\/$/, "") + "/" + relativeFilePath.replace(/^\//, "");
}

function findFileNode(root: FileNode | null, absoluteFwdPath: string): FileNode | null {
  if (!root) return null;
  const norm = (p: string) => p.replace(/\\/g, "/");
  function walk(node: FileNode): FileNode | null {
    if (norm(node.path) === absoluteFwdPath) return node;
    if (node.children) for (const c of node.children) { const f = walk(c); if (f) return f; }
    return null;
  }
  return walk(root);
}

function fileName(relPath: string): string {
  return relPath.split("/").filter(Boolean).pop() ?? relPath;
}

// ─── Bookmark row ─────────────────────────────────────────────────────────────

function BookmarkRow({
  bookmark,
  onNavigate,
  onDelete,
  onLabelChange,
}: {
  bookmark:     Bookmark;
  onNavigate:   () => void;
  onDelete:     () => void;
  onLabelChange:(label: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState(bookmark.label);

  const commitLabel = () => {
    setEditing(false);
    onLabelChange(draft.trim());
  };

  return (
    <div className="group/row flex items-start gap-1.5 rounded px-2 py-1 hover:bg-accent/50 transition-colors">
      {/* Page badge — click to navigate */}
      <button
        onClick={onNavigate}
        className="mt-0.5 shrink-0 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-amber-600 hover:bg-amber-500/25 transition-colors"
        title="Ir a esta página"
      >
        {bookmark.pageNumber}
      </button>

      {/* Label — editable inline */}
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") commitLabel();
              e.stopPropagation();
            }}
            placeholder="Añadir etiqueta…"
            className="w-full rounded border border-primary/30 bg-background px-1 py-0.5 text-[10px] focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="block w-full truncate text-left text-[10px] text-muted-foreground/70 hover:text-foreground"
            title={bookmark.label || "Clic para añadir etiqueta"}
          >
            {bookmark.label || <span className="italic opacity-40">sin etiqueta</span>}
          </button>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={onDelete}
        className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground/30 opacity-0 group-hover/row:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
        title="Eliminar marcador"
      >
        <IconTrash size={10} />
      </button>
    </div>
  );
}

// ─── File group ───────────────────────────────────────────────────────────────

function FileGroup({
  relPath,
  bookmarks,
  onNavigate,
  onDelete,
  onLabelChange,
}: {
  relPath:      string;
  bookmarks:    Bookmark[];
  onNavigate:   (b: Bookmark) => void;
  onDelete:     (id: string) => void;
  onLabelChange:(id: string, label: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const name = fileName(relPath);

  return (
    <div className="border-b border-border/30 last:border-b-0">
      {/* Group header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1 px-2 py-1 text-left hover:bg-accent/40 transition-colors"
      >
        {open
          ? <IconChevronDown size={10} className="shrink-0 text-muted-foreground/50" />
          : <IconChevronRight size={10} className="shrink-0 text-muted-foreground/50" />}
        <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-muted-foreground" title={relPath}>
          {name}
        </span>
        <span className="shrink-0 text-[9px] text-muted-foreground/40">{bookmarks.length}</span>
      </button>

      {open && (
        <div className="pb-1">
          {bookmarks
            .slice()
            .sort((a, b) => a.pageNumber - b.pageNumber)
            .map((bm) => (
              <BookmarkRow
                key={bm.id}
                bookmark={bm}
                onNavigate={() => onNavigate(bm)}
                onDelete={() => onDelete(bm.id)}
                onLabelChange={(label) => onLabelChange(bm.id, label)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export function BookmarksPanel() {
  const { bookmarks, isLoaded, deleteBookmark, updateBookmarkLabel } = useBookmarksStore();
  const { isLoaded: revLoaded, meta, isOutsideClientes } = useRevisionStore();
  const { openFile }   = useEditorStore();
  const { root }       = useExplorerStore();
  const { navigateTo } = useAnotacionesStore();
  const { focusedPane, splitFile, setSplitFile } = useWorkbenchStore();

  const navigate = (bm: Bookmark) => {
    const expPath = meta?.expedientePath;
    if (!expPath) return;
    const absFwd = absoluteFrom(expPath, bm.relativeFilePath);
    const node   = findFileNode(root, absFwd);
    const fileNode = node ?? {
      id: absFwd,
      name: fileName(bm.relativeFilePath),
      type: "pdf" as const,
      path: absFwd,
      loaded: true,
    };
    if (focusedPane === "right" && splitFile !== null) setSplitFile(fileNode);
    else openFile(fileNode);
    navigateTo(absFwd, bm.pageNumber, undefined, focusedPane);
  };

  if (!revLoaded || !isLoaded) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <IconFolderOpen size={36} strokeWidth={1} className="opacity-30" />
        <p className="text-sm">Abre un expediente para ver marcadores</p>
      </div>
    );
  }

  // Group by file
  const grouped: Record<string, Bookmark[]> = {};
  for (const bm of bookmarks) {
    (grouped[bm.relativeFilePath] ??= []).push(bm);
  }
  const sortedFiles = Object.keys(grouped).sort((a, b) => fileName(a).localeCompare(fileName(b)));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <IconBookmark size={13} className="shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Marcadores
        </span>
        {bookmarks.length > 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground/60">{bookmarks.length}</span>
        )}
      </div>

      <Separator className="shrink-0" />

      {isOutsideClientes && (
        <div className="flex shrink-0 items-center gap-2 border-b border-muted bg-muted/40 px-3 py-1.5">
          <IconCloudOff size={11} className="shrink-0 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground">Fuera de la carpeta de clientes — solo memoria</span>
        </div>
      )}

      {bookmarks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
          <IconBookmark size={32} strokeWidth={1} className="opacity-20" />
          <p className="text-[11px] leading-relaxed opacity-60">
            Haz clic en el ícono <IconBookmark size={10} className="inline" /> de cualquier página para marcarla
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {sortedFiles.map((relPath) => (
            <FileGroup
              key={relPath}
              relPath={relPath}
              bookmarks={grouped[relPath]}
              onNavigate={navigate}
              onDelete={deleteBookmark}
              onLabelChange={updateBookmarkLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}
