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

        {inElectron && root && (
          <div className="flex items-center gap-0.5">
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
          </div>
        )}

        {inElectron && !root && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Abrir expediente"
            onClick={openDirectory}
          >
            <IconFolderPlus size={14} />
          </Button>
        )}
      </div>

      <Separator className="shrink-0" />

      {!root ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-muted-foreground">
          <IconFolderOpen size={40} strokeWidth={1} className="opacity-30" />
          {inElectron ? (
            <>
              <p className="text-xs">Ningún expediente abierto</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={openDirectory}
              >
                <IconFolderPlus size={13} />
                Abrir carpeta
              </Button>
            </>
          ) : (
            <p className="text-xs">Abre la app en Electron para navegar archivos</p>
          )}
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
