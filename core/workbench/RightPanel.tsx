"use client";

import {
  IconHelp, IconPencil, IconQuote, IconFileDescription, IconBookmark,
  IconChevronRight,
} from "@tabler/icons-react";
import { Questionnaire }  from "@/features/questionnaire/Questionnaire";
import { NotesPanel }     from "@/features/annotations/NotesPanel";
import { CitasPanel }     from "@/features/citas/CitasPanel";
import { SintesisPanel }  from "@/features/sintesis/SintesisPanel";
import { BookmarksPanel } from "@/features/bookmarks/BookmarksPanel";
import { useWorkbenchStore, type RightPanelTab } from "@/state/workbench.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useCitasStore }       from "@/state/citas.store";
import { useSintesisStore }    from "@/state/sintesis.store";
import { useBookmarksStore }   from "@/state/bookmarks.store";
import { cn } from "@/lib/utils";
import type { Question } from "@/types/expediente";

interface TabConfig {
  id:    RightPanelTab;
  icon:  React.ElementType;
  label: string;
  short: string;
}

const TABS: TabConfig[] = [
  { id: "cuestionario", icon: IconHelp,            label: "Cuestionario", short: "Cuest."  },
  { id: "anotaciones",  icon: IconPencil,          label: "Notas",        short: "Notas"   },
  { id: "citas",        icon: IconQuote,           label: "Citas",        short: "Citas"   },
  { id: "sintesis",     icon: IconFileDescription, label: "Síntesis",     short: "Sínt."   },
  { id: "bookmarks",    icon: IconBookmark,        label: "Marcadores",   short: "Marks."  },
];

interface RightPanelProps {
  questions:   Question[];
  onCollapse?: () => void;
}

export function RightPanel({ questions, onCollapse }: RightPanelProps) {
  const { rightPanelTab, setRightPanelTab } = useWorkbenchStore();

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

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-border bg-background">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center border-b border-border bg-muted/20 px-1 py-0.5 gap-0.5 overflow-x-auto scrollbar-none">
        {TABS.map(({ id, icon: Icon, label, short }) => {
          const badge    = badges[id];
          const isActive = rightPanelTab === id;
          return (
            <button
              key={id}
              onClick={() => setRightPanelTab(id)}
              title={label}
              className={cn(
                "group relative flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-all duration-150 whitespace-nowrap shrink-0",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50",
              )}
            >
              <Icon size={12} strokeWidth={isActive ? 2.2 : 1.6} />
              <span>{short}</span>

              {badge && typeof badge === "string" && (
                <span className="flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-primary/15 px-1 text-[9px] font-bold text-primary leading-none">
                  {badge}
                </span>
              )}
              {badge === true && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}

              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          );
        })}

        {onCollapse && (
          <button
            onClick={onCollapse}
            title="Colapsar panel"
            className="ml-auto shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-accent transition-colors"
          >
            <IconChevronRight size={13} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {rightPanelTab === "cuestionario" && <Questionnaire questions={questions} />}
        {rightPanelTab === "anotaciones"  && <NotesPanel />}
        {rightPanelTab === "citas"        && <CitasPanel />}
        {rightPanelTab === "sintesis"     && <SintesisPanel />}
        {rightPanelTab === "bookmarks"    && <BookmarksPanel />}
      </div>
    </div>
  );
}
