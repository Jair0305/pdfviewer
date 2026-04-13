"use client";

import { useEffect, useRef } from "react";
import {
  IconFilePlus,
  IconFolderPlus,
  IconPencil,
  IconTrash,
  IconCircle,
  IconCircleFilled,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { FileNode } from "@/types/expediente";
import type { DocStatus } from "@/types/docStatus";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: DocStatus; label: string; color: string }[] = [
  { value: "sin_revisar",       label: "Sin revisar",       color: "text-muted-foreground/60" },
  { value: "en_revision",       label: "En revisión",       color: "text-amber-600"           },
  { value: "revisado",          label: "Revisado",           color: "text-green-600"           },
  { value: "con_observaciones", label: "Con observaciones", color: "text-red-600"             },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  node: FileNode;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  /** If provided, shows a "Marcar como" section for files */
  onSetDocStatus?:    (status: DocStatus) => void;
  currentDocStatus?:  DocStatus;
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
  onSetDocStatus,
  currentDocStatus,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isFolder = node.type === "folder";

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

  const style: React.CSSProperties = {
    position: "fixed",
    top:  Math.min(y, window.innerHeight - 220),
    left: Math.min(x, window.innerWidth  - 200),
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

      {/* Doc status section — only for non-folder files */}
      {!isFolder && onSetDocStatus && (
        <>
          <div className="my-1 border-t" />
          <p className="px-3 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
            Marcar como
          </p>
          {STATUS_OPTIONS.map((opt) => {
            const isActive = (currentDocStatus ?? "sin_revisar") === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => { onSetDocStatus(opt.value); onClose(); }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  opt.color,
                )}
              >
                {isActive
                  ? <IconCircleFilled size={8} className="shrink-0" />
                  : <IconCircle       size={8} className="shrink-0 opacity-40" />}
                {opt.label}
              </button>
            );
          })}
        </>
      )}
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
