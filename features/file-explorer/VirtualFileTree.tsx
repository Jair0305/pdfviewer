"use client";

import { useRef, useMemo, useState, useCallback, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  IconChevronRight,
  IconFolder,
  IconFolderOpen,
  IconFileTypePdf,
  IconFileTypeXml,
  IconFile,
  IconLoader2,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/types/expediente";
import { useExplorerStore } from "@/state/explorer.store";
import { useEditorStore } from "@/state/editor.store";
import { ContextMenu } from "./ContextMenu";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FlatNode {
  node: FileNode;
  depth: number;
  isLoading: boolean;
  isCreating?: boolean;
}

interface CreatingState {
  parentPath: string;
  type: "file" | "folder";
}

// Sentinel node used to represent the inline create row
const CREATING_SENTINEL: FileNode = {
  id: "__creating__",
  name: "",
  path: "__creating__",
  type: "unknown",
  loaded: true,
};

// ─── flattenTree ──────────────────────────────────────────────────────────────

function flattenTree(
  nodes: FileNode[],
  expanded: Set<string>,
  loading: Set<string>,
  creating: CreatingState | null,
  depth = 0,
): FlatNode[] {
  const result: FlatNode[] = [];
  for (const node of nodes) {
    const isLoading = loading.has(node.path);
    result.push({ node, depth, isLoading });

    if (node.type === "folder" && expanded.has(node.path) && !isLoading) {
      if (node.children) {
        result.push(...flattenTree(node.children, expanded, loading, creating, depth + 1));
      }
      // Insert inline create row as first child of the target folder
      if (creating && creating.parentPath === node.path) {
        result.push({ node: CREATING_SENTINEL, depth: depth + 1, isLoading: false, isCreating: true });
      }
    }
  }
  return result;
}

// ─── VirtualFileTree ──────────────────────────────────────────────────────────

const ROW_HEIGHT = 24;
const INDENT = 10;

interface VirtualFileTreeProps {
  nodes: FileNode[];
  /** Called to trigger creation in root when rootPath matches */
  creating: CreatingState | null;
  onCreatingCommit: (name: string) => void;
  onCreatingCancel: () => void;
}

export function VirtualFileTree({
  nodes,
  creating,
  onCreatingCommit,
  onCreatingCancel,
}: VirtualFileTreeProps) {
  const { expandedPaths, loadingPaths, toggleExpanded, root, moveNode, deleteNode, renameNode } =
    useExplorerStore();
  const { openFile } = useEditorStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Drag state ────────────────────────────────────────────────────────────
  const dragSourceRef = useRef<FileNode | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);

  // ── Context menu ──────────────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    node: FileNode;
  } | null>(null);

  // ── Inline rename ─────────────────────────────────────────────────────────
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Close context menu when clicking scroll area
  const handleScrollClick = useCallback(() => {
    if (ctxMenu) setCtxMenu(null);
  }, [ctxMenu]);

  // ── Flat list ─────────────────────────────────────────────────────────────
  const flatItems = useMemo(() => {
    const items = flattenTree(nodes, expandedPaths, loadingPaths, creating);
    // If creating in root, prepend a creating row at depth 0
    if (creating && root && creating.parentPath === root.path) {
      return [
        { node: CREATING_SENTINEL, depth: 0, isLoading: false, isCreating: true },
        ...items,
      ];
    }
    return items;
  }, [nodes, expandedPaths, loadingPaths, creating, root]);

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((node: FileNode) => {
    dragSourceRef.current = node;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, node: FileNode) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const targetPath = node.type === "folder" ? node.path : null;
    setDragOverPath(targetPath);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverPath(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetNode: FileNode) => {
      e.preventDefault();
      setDragOverPath(null);
      const src = dragSourceRef.current;
      if (!src) return;
      // Determine destination folder
      const destFolder =
        targetNode.type === "folder"
          ? targetNode.path
          : targetNode.path.replace(/[\\/][^\\/]+$/, ""); // parent of file
      // Don't drop on itself or its own parent
      const srcParent = src.path.replace(/[\\/][^\\/]+$/, "");
      if (src.path === targetNode.path) return;
      if (srcParent === destFolder) return;
      moveNode(src.path, destFolder);
      dragSourceRef.current = null;
    },
    [moveNode],
  );

  const handleDragEnd = useCallback(() => {
    dragSourceRef.current = null;
    setDragOverPath(null);
  }, []);

  // ── Context menu actions ───────────────────────────────────────────────────

  const [pendingCreate, setPendingCreate] = useState<CreatingState | null>(null);

  const handleCtxNewFile = useCallback(() => {
    if (!ctxMenu) return;
    // Signal parent (FileExplorer) via the creating prop mechanism
    // We trigger it by exposing a local pending state that FileExplorer reads
    // But since creating is a prop, we need another approach.
    // We'll dispatch a custom event that FileExplorer listens to.
    window.dispatchEvent(
      new CustomEvent("explorer:create", {
        detail: { parentPath: ctxMenu.node.path, type: "file" },
      }),
    );
  }, [ctxMenu]);

  const handleCtxNewFolder = useCallback(() => {
    if (!ctxMenu) return;
    window.dispatchEvent(
      new CustomEvent("explorer:create", {
        detail: { parentPath: ctxMenu.node.path, type: "folder" },
      }),
    );
  }, [ctxMenu]);

  const handleCtxRename = useCallback(() => {
    if (!ctxMenu) return;
    setRenamingPath(ctxMenu.node.path);
    setRenameValue(ctxMenu.node.name);
  }, [ctxMenu]);

  const handleCtxDelete = useCallback(() => {
    if (!ctxMenu) return;
    deleteNode(ctxMenu.node.path);
  }, [ctxMenu, deleteNode]);

  const commitRename = useCallback(() => {
    if (!renamingPath || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }
    renameNode(renamingPath, renameValue.trim());
    setRenamingPath(null);
  }, [renamingPath, renameValue, renameNode]);

  const cancelRename = useCallback(() => setRenamingPath(null), []);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto"
      onClick={handleScrollClick}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
        {virtualizer.getVirtualItems().map((vRow) => {
          const flat = flatItems[vRow.index];
          if (!flat) return null;

          // ── Inline create row ──────────────────────────────────────────
          if (flat.isCreating) {
            return (
              <div
                key={vRow.key}
                style={{
                  position: "absolute",
                  top: vRow.start,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT,
                }}
              >
                <InlineCreateRow
                  depth={flat.depth}
                  type={creating?.type ?? "file"}
                  onCommit={onCreatingCommit}
                  onCancel={onCreatingCancel}
                />
              </div>
            );
          }

          // ── Normal tree row ────────────────────────────────────────────
          const isDragOver =
            dragOverPath === flat.node.path && flat.node.type === "folder";

          return (
            <div
              key={vRow.key}
              style={{
                position: "absolute",
                top: vRow.start,
                left: 0,
                right: 0,
                height: ROW_HEIGHT,
              }}
            >
              <TreeRow
                flat={flat}
                isDragOver={isDragOver}
                isRenaming={renamingPath === flat.node.path}
                renameValue={renameValue}
                onToggle={() => toggleExpanded(flat.node)}
                onOpen={() => {
                  if (flat.node.type !== "folder") openFile(flat.node);
                  else toggleExpanded(flat.node);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ x: e.clientX, y: e.clientY, node: flat.node });
                }}
                onDragStart={() => handleDragStart(flat.node)}
                onDragOver={(e) => handleDragOver(e, flat.node)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, flat.node)}
                onDragEnd={handleDragEnd}
                onRenameChange={setRenameValue}
                onRenameCommit={commitRename}
                onRenameCancel={cancelRename}
              />
            </div>
          );
        })}
      </div>

      {flatItems.length === 0 && !creating && (
        <p className="p-4 text-xs text-muted-foreground/50 text-center">(carpeta vacía)</p>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          node={ctxMenu.node}
          onClose={() => setCtxMenu(null)}
          onNewFile={handleCtxNewFile}
          onNewFolder={handleCtxNewFolder}
          onRename={handleCtxRename}
          onDelete={handleCtxDelete}
        />
      )}
    </div>
  );
}

// ─── TreeRow ──────────────────────────────────────────────────────────────────

function TreeRow({
  flat,
  isDragOver,
  isRenaming,
  renameValue,
  onToggle,
  onOpen,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onRenameChange,
  onRenameCommit,
  onRenameCancel,
}: {
  flat: FlatNode;
  isDragOver: boolean;
  isRenaming: boolean;
  renameValue: string;
  onToggle: () => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onRenameChange: (v: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}) {
  const { node, depth, isLoading } = flat;
  const { expandedPaths } = useExplorerStore();
  const { activeTabId } = useEditorStore();
  const renameRef = useRef<HTMLInputElement>(null);

  const isFolder   = node.type === "folder";
  const isExpanded = expandedPaths.has(node.path);
  const isActive   = activeTabId === node.path;

  useEffect(() => {
    if (isRenaming) renameRef.current?.focus();
  }, [isRenaming]);

  return (
    <button
      draggable
      onClick={onOpen}
      onContextMenu={onContextMenu}
      onDragStart={(e) => { e.stopPropagation(); onDragStart(); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      title={node.path}
      className={cn(
        "flex h-full w-full items-center gap-1 pr-2 text-left text-[13px] transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        isActive && "bg-accent text-accent-foreground",
        isDragOver && "bg-primary/20 outline outline-1 outline-primary/50",
      )}
      style={{ paddingLeft: `${depth * INDENT + 6}px` }}
    >
      {/* Chevron / spinner */}
      {isFolder ? (
        isLoading ? (
          <IconLoader2 size={13} className="shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <IconChevronRight
            size={13}
            className={cn(
              "shrink-0 text-muted-foreground/50 transition-transform",
              isExpanded && "rotate-90",
            )}
          />
        )
      ) : (
        <span className="w-[13px] shrink-0" />
      )}

      {/* Icon */}
      <FileIcon node={node} isExpanded={isExpanded} />

      {/* Name or rename input */}
      {isRenaming ? (
        <input
          ref={renameRef}
          value={renameValue}
          onChange={(e) => onRenameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.stopPropagation(); onRenameCommit(); }
            if (e.key === "Escape") { e.stopPropagation(); onRenameCancel(); }
          }}
          onBlur={onRenameCommit}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded bg-background px-1 text-[13px] outline outline-1 outline-primary"
        />
      ) : (
        <span className="truncate">{node.name}</span>
      )}
    </button>
  );
}

// ─── InlineCreateRow ──────────────────────────────────────────────────────────

function InlineCreateRow({
  depth,
  type,
  onCommit,
  onCancel,
}: {
  depth: number;
  type: "file" | "folder";
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const icon =
    type === "folder" ? (
      <IconFolder size={14} className="shrink-0 text-yellow-500" />
    ) : (
      <IconFile size={14} className="shrink-0 text-muted-foreground/60" />
    );

  return (
    <div
      className="flex h-full w-full items-center gap-1 pr-2 bg-accent/40"
      style={{ paddingLeft: `${depth * INDENT + 6 + 14}px` }}
    >
      {icon}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onCommit(value.trim());
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => { if (value.trim()) onCommit(value.trim()); else onCancel(); }}
        placeholder={type === "folder" ? "nombre_carpeta" : "archivo.pdf"}
        className="min-w-0 flex-1 rounded bg-background px-1 text-[13px] outline outline-1 outline-primary"
      />
    </div>
  );
}

// ─── FileIcon ─────────────────────────────────────────────────────────────────

function FileIcon({ node, isExpanded }: { node: FileNode; isExpanded: boolean }) {
  if (node.type === "folder") {
    return isExpanded
      ? <IconFolderOpen size={14} className="shrink-0 text-yellow-400" />
      : <IconFolder     size={14} className="shrink-0 text-yellow-500" />;
  }
  if (node.type === "pdf") return <IconFileTypePdf size={14} className="shrink-0 text-red-400" />;
  if (node.type === "xml") return <IconFileTypeXml size={14} className="shrink-0 text-blue-400" />;
  return <IconFile size={14} className="shrink-0 text-muted-foreground/40" />;
}
