"use client";

import { useRef } from "react";
import { IconX, IconFileTypePdf, IconFileTypeXml, IconFile } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useEditorStore } from "@/state/editor.store";
import type { Tab } from "@/types/expediente";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditorStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (tabs.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b bg-background scrollbar-none"
      style={{ scrollbarWidth: "none" }}
    >
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onActivate={() => setActiveTab(tab.id)}
          onClose={(e) => {
            e.stopPropagation();
            closeTab(tab.id);
          }}
        />
      ))}
    </div>
  );
}

// ─── Single Tab ───────────────────────────────────────────────────────────────

function TabItem({
  tab,
  isActive,
  onActivate,
  onClose,
}: {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onActivate}
      title={tab.path}
      className={cn(
        "group flex min-w-0 max-w-[200px] shrink-0 items-center gap-1.5 border-r px-3 text-sm",
        "transition-colors",
        isActive
          ? "border-b-2 border-b-primary bg-background text-foreground"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      <TabIcon type={tab.type} />
      <span className="min-w-0 truncate text-xs">{tab.name}</span>
      <span
        role="button"
        onClick={onClose}
        className={cn(
          "ml-0.5 shrink-0 rounded p-0.5 transition-opacity",
          "opacity-0 hover:bg-accent group-hover:opacity-100",
          isActive && "opacity-60",
        )}
      >
        <IconX size={11} />
      </span>
    </button>
  );
}

function TabIcon({ type }: { type: Tab["type"] }) {
  if (type === "pdf") return <IconFileTypePdf size={13} className="shrink-0 text-red-400" />;
  if (type === "xml") return <IconFileTypeXml size={13} className="shrink-0 text-blue-400" />;
  return <IconFile size={13} className="shrink-0 text-muted-foreground/50" />;
}
