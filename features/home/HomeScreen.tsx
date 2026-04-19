"use client";

import { useState, useEffect, useCallback } from "react";
import { IconFolderOpen, IconClock, IconChevronRight, IconLayoutGrid } from "@tabler/icons-react";
import { useExplorerStore } from "@/state/explorer.store";
import { useIsElectron } from "@/hooks/useIsElectron";
import { loadRecents, type RecentExpediente } from "./recents";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60_000);
    const hours = Math.floor(diff / 3_600_000);
    const days  = Math.floor(diff / 86_400_000);
    if (mins < 1)   return "Ahora mismo";
    if (mins < 60)  return `Hace ${mins} min`;
    if (hours < 24) return `Hace ${hours}h`;
    if (days === 1) return "Ayer";
    if (days < 7)   return `Hace ${days} días`;
    return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  } catch { return ""; }
}

function shortPath(path: string): string {
  // Show last 2-3 segments so it's meaningful but not overwhelming
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length <= 3) return parts.join(" / ");
  return `…/${parts.slice(-3).join("/")}`;
}

// ─── RecentCard ───────────────────────────────────────────────────────────────

function RecentCard({
  recent, onOpen, index,
}: {
  recent: RecentExpediente;
  onOpen: (path: string) => void;
  index: number;
}) {
  return (
    <button
      onClick={() => onOpen(recent.path)}
      className="group flex items-center gap-3 w-full rounded-xl border border-border/60 bg-muted/20 px-4 py-3 text-left transition-all duration-150 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm animate-in fade-in slide-in-from-bottom-2"
      style={{ animationDelay: `${index * 40}ms`, animationFillMode: "both" }}
    >
      {/* Folder icon */}
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 group-hover:bg-primary/15 transition-colors">
        <IconLayoutGrid size={16} className="text-primary/70 group-hover:text-primary transition-colors" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground/90 group-hover:text-foreground">{recent.name}</p>
        <p className="truncate text-[10px] text-muted-foreground/50 font-mono mt-0.5">{shortPath(recent.path)}</p>
      </div>

      {/* Time + arrow */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
          <IconClock size={10} />
          {relativeTime(recent.lastOpenedAt)}
        </div>
        <IconChevronRight size={14} className="text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
      </div>
    </button>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export function HomeScreen() {
  const { openDirectoryByPath } = useExplorerStore();
  const inElectron = useIsElectron();
  const [recents, setRecents] = useState<RecentExpediente[]>([]);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    setRecents(loadRecents());
  }, []);

  const handleOpen = useCallback(async () => {
    if (!inElectron || opening) return;
    setOpening(true);
    try {
      const picked = await window.api.openDirectory();
      if (picked) openDirectoryByPath(picked, []);
    } finally {
      setOpening(false);
    }
  }, [inElectron, opening, openDirectoryByPath]);

  const handleOpenRecent = useCallback((path: string) => {
    openDirectoryByPath(path, []);
  }, [openDirectoryByPath]);

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto p-8">
      <div className="w-full max-w-[480px] space-y-8 animate-in fade-in zoom-in-95 duration-400">

        {/* Logo / title */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/15 shadow-sm shadow-primary/10">
            <IconFolderOpen size={26} strokeWidth={1.4} className="text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground/90">Revisor de Expedientes</h1>
            <p className="text-xs text-muted-foreground/50 mt-0.5">Abre un expediente para comenzar</p>
          </div>
        </div>

        {/* Open button */}
        <button
          onClick={handleOpen}
          disabled={!inElectron || opening}
          className={cn(
            "w-full flex items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-primary/30 py-4 text-sm font-medium text-primary/70",
            "hover:border-primary/60 hover:bg-primary/5 hover:text-primary transition-all duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          <IconFolderOpen size={16} />
          {opening ? "Abriendo…" : "Abrir expediente…"}
        </button>

        {/* Recents */}
        {recents.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40 px-1">
              Recientes
            </p>
            <div className="space-y-1.5">
              {recents.map((r, i) => (
                <RecentCard key={r.path} recent={r} onOpen={handleOpenRecent} index={i} />
              ))}
            </div>
          </div>
        )}

        {recents.length === 0 && (
          <p className="text-center text-[11px] text-muted-foreground/30">
            Tus expedientes recientes aparecerán aquí
          </p>
        )}
      </div>
    </div>
  );
}
