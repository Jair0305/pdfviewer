"use client";

import {
  IconHelp, IconPencil, IconQuote, IconFileDescription, IconBookmark, IconX,
} from "@tabler/icons-react";
import { RightPanel } from "./RightPanel";
import { useWorkbenchStore, type RightPanelTab } from "@/state/workbench.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useCitasStore } from "@/state/citas.store";
import { useSintesisStore } from "@/state/sintesis.store";
import { useBookmarksStore } from "@/state/bookmarks.store";
import type { Question } from "@/types/expediente";
import { cn } from "@/lib/utils";

// ─── Tab config ───────────────────────────────────────────────────────────────

interface TabConfig {
  id:    RightPanelTab;
  icon:  React.ElementType;
  label: string;
}

const TABS: TabConfig[] = [
  { id: "cuestionario", icon: IconHelp,            label: "Cuestionario" },
  { id: "anotaciones",  icon: IconPencil,          label: "Notas"        },
  { id: "citas",        icon: IconQuote,           label: "Citas"        },
  { id: "sintesis",     icon: IconFileDescription, label: "Síntesis"     },
  { id: "bookmarks",    icon: IconBookmark,        label: "Marcadores"   },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function RightPanelStrip({ questions }: { questions: Question[] }) {
  const { rightPanelTab, rightPanelOpen, openRightPanelTab, setRightPanelOpen } = useWorkbenchStore();

  const annotationCount = useAnotacionesStore((s) => s.annotations.length);
  const citasCount      = useCitasStore((s) => s.citas.length);
  const sintesisContent = useSintesisStore((s) => s.content);
  const bookmarksCount  = useBookmarksStore((s) => s.bookmarks.length);

  const badges: Partial<Record<RightPanelTab, string | boolean>> = {
    anotaciones: annotationCount > 0 ? String(annotationCount > 99 ? "99+" : annotationCount) : undefined,
    citas:       citasCount > 0      ? String(citasCount > 99 ? "99+" : citasCount)           : undefined,
    sintesis:    sintesisContent.trim().length > 0,
    bookmarks:   bookmarksCount > 0  ? String(bookmarksCount > 99 ? "99+" : bookmarksCount)   : undefined,
  };

  const handleTabClick = (id: RightPanelTab) => {
    if (rightPanelOpen && rightPanelTab === id) {
      setRightPanelOpen(false); // same tab → toggle close
    } else {
      openRightPanelTab(id);
    }
  };

  return (
    <>
      {/* Icon strip — always visible, 48px wide */}
      <div className="relative z-30 flex w-12 shrink-0 flex-col items-center border-l border-border bg-background/95 py-2 gap-0.5">
        {TABS.map(({ id, icon: Icon, label }) => {
          const badge   = badges[id];
          const isActive = rightPanelOpen && rightPanelTab === id;
          return (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              title={label}
              className={cn(
                "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-150",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground/50 hover:bg-accent/80 hover:text-foreground",
              )}
            >
              <Icon size={18} strokeWidth={1.6} />

              {/* Badge */}
              {badge && typeof badge === "string" && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground leading-none">
                  {badge}
                </span>
              )}
              {badge === true && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
              )}

              {/* Active left indicator */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-primary" />
              )}

              {/* Label tooltip */}
              <span className="pointer-events-none absolute right-full mr-2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[10px] font-medium text-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {label}
              </span>
            </button>
          );
        })}

        {/* Close button — only when open */}
        {rightPanelOpen && (
          <button
            onClick={() => setRightPanelOpen(false)}
            title="Cerrar panel"
            className="mt-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-accent hover:text-foreground transition-colors"
          >
            <IconX size={14} />
          </button>
        )}
      </div>

      {/* Backdrop — click to close (covers only the PDF, not the strip) */}
      {rightPanelOpen && (
        <div
          className="absolute inset-0 z-20"
          style={{ right: 48 }}
          onClick={() => setRightPanelOpen(false)}
        />
      )}

      {/* Overlay panel — slides in from right */}
      <div
        className={cn(
          "absolute top-0 bottom-0 z-25 w-[320px] bg-background border-l border-border shadow-2xl",
          "transition-transform duration-200 ease-out",
          rightPanelOpen ? "translate-x-0" : "translate-x-full",
        )}
        style={{ right: 48 }}
      >
        <RightPanel questions={questions} />
      </div>
    </>
  );
}
