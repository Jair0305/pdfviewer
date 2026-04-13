"use client";

import { useState, useCallback, useEffect } from "react";
import {
  IconFiles,
  IconFolderOpen,
  IconFolderPlus,
  IconFilePlus,
} from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { VirtualFileTree } from "./VirtualFileTree";
import { useExplorerStore } from "@/state/explorer.store";
import { useIsElectron } from "@/hooks/useIsElectron";

interface CreatingState {
  parentPath: string;
  type: "file" | "folder";
}

export function FileExplorer() {
  const { root, openDirectory, createFileNode, createFolderNode } = useExplorerStore();
  const inElectron = useIsElectron();
  const [creating, setCreating] = useState<CreatingState | null>(null);

  // Listen for context-menu triggered create events from VirtualFileTree
  useEffect(() => {
    const handler = (e: Event) => {
      const { parentPath, type } = (e as CustomEvent).detail as CreatingState;
      setCreating({ parentPath, type });
    };
    window.addEventListener("explorer:create", handler);
    return () => window.removeEventListener("explorer:create", handler);
  }, []);

  const handleCreatingCommit = useCallback(
    async (name: string) => {
      if (!creating) return;
      setCreating(null);
      if (creating.type === "file") {
        await createFileNode(creating.parentPath, name);
      } else {
        await createFolderNode(creating.parentPath, name);
      }
    },
    [creating, createFileNode, createFolderNode],
  );

  const handleCreatingCancel = useCallback(() => setCreating(null), []);

  const startCreate = useCallback(
    (type: "file" | "folder") => {
      if (!root) return;
      setCreating({ parentPath: root.path, type });
    },
    [root],
  );

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
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title="Abrir carpeta…"
              onClick={openDirectory}
            >
              <IconFolderOpen size={14} />
            </Button>
            {root && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Nuevo archivo"
                  onClick={() => startCreate("file")}
                >
                  <IconFilePlus size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  title="Nueva carpeta"
                  onClick={() => startCreate("folder")}
                >
                  <IconFolderPlus size={14} />
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
            <div className="text-foreground/20">
              <IconFolderOpen size={44} strokeWidth={1} />
            </div>
            {inElectron ? (
              <>
                <p className="text-[13px] font-medium text-foreground/80">Ningún expediente abierto</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-8 gap-2 bg-background/50 backdrop-blur hover:bg-accent text-xs font-semibold shadow-sm transition-all hover:scale-105 active:scale-95"
                  onClick={openDirectory}
                >
                  <IconFolderPlus size={14} />
                  Abrir carpeta
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
            <span className="truncate text-[11px] font-medium text-muted-foreground">
              {root.name}
            </span>
          </div>

          {/* Virtualized tree */}
          <div className="min-h-0 flex-1">
            <VirtualFileTree
              nodes={root.children ?? []}
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
