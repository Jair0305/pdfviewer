"use client";

import { IconFiles, IconSearch, IconSettings2, IconLoader2, IconFolderOpen, IconKeyboard } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useWorkbenchStore, type SidebarView } from "@/state/workbench.store";
import { useExplorerStore } from "@/state/explorer.store";
import { Tooltip } from "@/components/ui/tooltip";
import {
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ActivityBarItem {
  id: SidebarView;
  icon: React.ElementType;
  label: string;
}

const ITEMS: ActivityBarItem[] = [
  { id: "explorer", icon: IconFiles,    label: "Explorador (E)" },
  { id: "search",   icon: IconSearch,   label: "Buscar (B)"     },
];

const BOTTOM_ITEMS: ActivityBarItem[] = [
  { id: "settings", icon: IconSettings2, label: "Configuración" },
];

export function ActivityBar() {
  const { activeSidebarView, toggleSidebarView, setSettingsOpen, setShortcutsOpen } = useWorkbenchStore();
  const { indexStatus } = useExplorerStore();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full w-12 shrink-0 flex-col items-center border-r bg-[oklch(0.99_0_0)] dark:bg-[oklch(0.115_0_0)] py-1">
        {ITEMS.map(({ id, icon: Icon, label }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => toggleSidebarView(id)}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-150 ease-out",
                  "hover:bg-accent/80 hover:text-accent-foreground",
                  activeSidebarView === id
                    ? "text-primary before:absolute before:left-0 before:h-6 before:w-[3px] before:rounded-r-md before:bg-primary"
                    : "text-muted-foreground/60",
                )}
              >
                <Icon size={22} strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Shortcuts button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShortcutsOpen(true)}
              className="relative flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-150 ease-out hover:bg-accent/80 hover:text-accent-foreground text-muted-foreground/60"
            >
              <IconKeyboard size={20} strokeWidth={1.5} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Atajos de teclado (?)
          </TooltipContent>
        </Tooltip>

        {/* Bottom items (settings, etc.) */}
        {BOTTOM_ITEMS.map(({ id, icon: Icon, label }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  if (id === "settings") {
                    setSettingsOpen(true);
                  } else {
                    toggleSidebarView(id);
                  }
                }}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-150 ease-out",
                  "hover:bg-accent/80 hover:text-accent-foreground",
                  "text-muted-foreground/60",
                )}
              >
                <Icon size={22} strokeWidth={1.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Index status indicator */}
        {indexStatus.state === "indexing" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-11 w-11 items-center justify-center text-muted-foreground/40">
                <IconLoader2 size={14} className="animate-spin" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Indexando… {indexStatus.total} archivos
            </TooltipContent>
          </Tooltip>
        )}

        {indexStatus.state === "complete" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-11 w-11 items-center justify-center text-muted-foreground/30">
                <IconFolderOpen size={14} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {indexStatus.total} archivos indexados
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
