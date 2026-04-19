"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import {
  IconX,
  IconFileTypePdf,
  IconFileTypeXml,
  IconFile,
  IconPin,
  IconPinFilled,
  IconCopy,
  IconFolderSearch,
  IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/state/editor.store";
import { useWorkbenchStore } from "@/state/workbench.store";
import { useIsElectron } from "@/hooks/useIsElectron";
import type { Tab } from "@/types/expediente";

// ─── Tab context menu ─────────────────────────────────────────────────────────

interface CtxMenuState {
  x: number;
  y: number;
  tab: Tab;
  index: number;
}

interface TabContextMenuProps extends CtxMenuState {
  onClose: () => void;
}

function TabContextMenu({ x, y, tab, index, onClose }: TabContextMenuProps) {
  const {
    tabs,
    closeTab,
    closeOtherTabs,
    closeTabsToRight,
    closeAllTabs,
    togglePin,
  } = useEditorStore();
  const { setSidebarView } = useWorkbenchStore();
  const inElectron = useIsElectron();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [onClose]);

  // Adjust position so menu stays inside viewport
  const menuStyle: React.CSSProperties = {
    position: "fixed",
    top: y,
    left: x,
    zIndex: 9999,
  };

  const run = (fn: () => void) => {
    fn();
    onClose();
  };

  const hasTabsToRight = index < tabs.length - 1;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(tab.path).catch(() => {});
    onClose();
  };

  const handleRevealInFolder = () => {
    if (inElectron && window.api?.showInFolder) {
      window.api.showInFolder(tab.path);
    }
    onClose();
  };

  const handleRevealInExplorer = () => {
    setSidebarView("explorer");
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="min-w-[210px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
    >
      {/* Pin / Unpin */}
      <MenuItem
        icon={tab.isPinned ? <IconPinFilled size={13} /> : <IconPin size={13} />}
        label={tab.isPinned ? "Desanclar pestaña" : "Anclar pestaña"}
        onClick={() => run(() => togglePin(tab.id))}
      />

      <MenuSeparator />

      {/* Close actions */}
      <MenuItem
        icon={<IconX size={13} />}
        label="Cerrar"
        onClick={() => run(() => closeTab(tab.id))}
        disabled={!!tab.isPinned}
      />
      <MenuItem
        icon={<IconX size={13} />}
        label="Cerrar otras"
        onClick={() => run(() => closeOtherTabs(tab.id))}
      />
      <MenuItem
        icon={<IconX size={13} />}
        label="Cerrar a la derecha"
        onClick={() => run(() => closeTabsToRight(tab.id))}
        disabled={!hasTabsToRight}
      />
      <MenuItem
        icon={<IconX size={13} />}
        label="Cerrar todo"
        onClick={() => run(() => closeAllTabs())}
      />

      <MenuSeparator />

      {/* File actions */}
      <MenuItem
        icon={<IconCopy size={13} />}
        label="Copiar ruta"
        onClick={handleCopyPath}
      />
      {inElectron && (
        <MenuItem
          icon={<IconFolderSearch size={13} />}
          label="Mostrar en explorador de archivos"
          onClick={handleRevealInFolder}
        />
      )}
      <MenuItem
        icon={<IconLayoutSidebarLeftExpand size={13} />}
        label="Mostrar en vista de archivos"
        onClick={handleRevealInExplorer}
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs",
        "transition-colors hover:bg-accent hover:text-accent-foreground",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      {label}
    </button>
  );
}

function MenuSeparator() {
  return <div className="my-1 h-px bg-border" />;
}

// ─── TabBar ───────────────────────────────────────────────────────────────────

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, moveTab } = useEditorStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const draggingIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tab: Tab, index: number) => {
      e.preventDefault();
      setCtxMenu({ x: e.clientX, y: e.clientY, tab, index });
    },
    [],
  );

  // ── Drag reorder ────────────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    draggingIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
    // Transparent drag ghost
    const ghost = document.createElement("div");
    ghost.style.opacity = "0";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      setDragOverIndex(null);
      const fromIndex = draggingIndexRef.current;
      if (fromIndex === null || fromIndex === toIndex) return;
      moveTab(fromIndex, toIndex);
      draggingIndexRef.current = null;
    },
    [moveTab],
  );

  const handleDragEnd = useCallback(() => {
    draggingIndexRef.current = null;
    setDragOverIndex(null);
  }, []);

  if (tabs.length === 0) return null;

  return (
    <>
      <div
        ref={scrollRef}
        className="flex h-[38px] shrink-0 items-stretch overflow-x-auto border-b border-border bg-gradient-to-b from-background/80 to-background/40 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 z-10 sticky top-0"
        style={{ scrollbarWidth: "none" }}
        onDragLeave={() => setDragOverIndex(null)}
      >
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            index={index}
            isActive={tab.id === activeTabId}
            isDragOver={dragOverIndex === index}
            onActivate={() => setActiveTab(tab.id)}
            onClose={(e) => {
              e.stopPropagation();
              closeTab(tab.id);
            }}
            onContextMenu={(e) => handleContextMenu(e, tab, index)}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          />
        ))}
      </div>

      {ctxMenu && (
        <TabContextMenu
          {...ctxMenu}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </>
  );
}

// ─── Single Tab ───────────────────────────────────────────────────────────────

function TabItem({
  tab,
  index,
  isActive,
  isDragOver,
  onActivate,
  onClose,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  tab: Tab;
  index: number;
  isActive: boolean;
  isDragOver: boolean;
  onActivate: () => void;
  onClose: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <button
      draggable
      onClick={onActivate}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      title={tab.path}
      className={cn(
        "group relative flex min-w-0 max-w-[200px] shrink-0 items-center gap-2 border-r border-border px-3 text-[13px]",
        "transition-all duration-150 ease-out select-none",
        isActive
          ? "bg-background text-primary font-medium before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-primary shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          : "bg-muted/20 text-muted-foreground hover:bg-muted/50 hover:text-foreground",
        isDragOver && "bg-primary/10 outline outline-1 outline-primary/40",
        tab.isPinned && "pr-2",
      )}
    >
      {tab.isPinned ? (
        <IconPinFilled size={11} className="shrink-0 text-primary/60" />
      ) : (
        <TabIcon type={tab.type} />
      )}

      <span className={cn("min-w-0 truncate text-xs", isActive ? "font-semibold" : "font-medium")}>{tab.name}</span>

      {/* Close — hidden for pinned tabs */}
      {!tab.isPinned && (
        <span
          role="button"
          onClick={onClose}
          className={cn(
            "ml-0.5 shrink-0 rounded p-0.5 transition-opacity duration-200",
            "opacity-0 hover:bg-accent/80 group-hover:opacity-100",
            isActive && "opacity-60",
          )}
        >
          <IconX size={11} />
        </span>
      )}
    </button>
  );
}

function TabIcon({ type }: { type: Tab["type"] }) {
  if (type === "pdf") return <IconFileTypePdf size={13} className="shrink-0 text-red-400" />;
  if (type === "xml") return <IconFileTypeXml size={13} className="shrink-0 text-blue-400" />;
  return <IconFile size={13} className="shrink-0 text-muted-foreground/50" />;
}
