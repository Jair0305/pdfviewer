"use client";

import { useEffect, useRef } from "react";
import {
  IconFilePlus,
  IconFolderPlus,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/types/expediente";

interface ContextMenuProps {
  x: number;
  y: number;
  node: FileNode;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function ContextMenu({
  x,
  y,
  node,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isFolder = node.type === "folder";

  // Close on outside click or Escape
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Adjust position so menu doesn't overflow viewport
  const style: React.CSSProperties = {
    position: "fixed",
    top: Math.min(y, window.innerHeight - 160),
    left: Math.min(x, window.innerWidth - 200),
    zIndex: 9999,
  };

  return (
    <div
      ref={ref}
      style={style}
      className="min-w-[180px] rounded-md border bg-popover py-1 shadow-lg text-popover-foreground text-[13px]"
    >
      {isFolder && (
        <>
          <MenuItem icon={<IconFilePlus size={13} />} label="Nuevo archivo" onClick={() => { onClose(); onNewFile(); }} />
          <MenuItem icon={<IconFolderPlus size={13} />} label="Nueva carpeta" onClick={() => { onClose(); onNewFolder(); }} />
          <div className="my-1 border-t" />
        </>
      )}
      <MenuItem icon={<IconPencil size={13} />} label="Renombrar" onClick={() => { onClose(); onRename(); }} />
      <MenuItem
        icon={<IconTrash size={13} />}
        label="Eliminar"
        onClick={() => { onClose(); onDelete(); }}
        danger
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        danger && "text-destructive hover:text-destructive",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
