"use client";

import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Questionnaire } from "@/features/questionnaire/Questionnaire";
import { NotesPanel } from "@/features/annotations/NotesPanel";
import { CitasPanel } from "@/features/citas/CitasPanel";
import { SintesisPanel } from "@/features/sintesis/SintesisPanel";
import { BookmarksPanel } from "@/features/bookmarks/BookmarksPanel";
import { useWorkbenchStore } from "@/state/workbench.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useCitasStore } from "@/state/citas.store";
import { useSintesisStore } from "@/state/sintesis.store";
import { useBookmarksStore } from "@/state/bookmarks.store";
import type { Question } from "@/types/expediente";
import { cn } from "@/lib/utils";

interface RightPanelProps {
  questions: Question[];
}

export function RightPanel({ questions }: RightPanelProps) {
  const { rightPanelTab, setRightPanelTab } = useWorkbenchStore();
  const annotationCount  = useAnotacionesStore((s) => s.annotations.length);
  const citasCount       = useCitasStore((s) => s.citas.length);
  const sintesisContent  = useSintesisStore((s) => s.content);
  const bookmarksCount   = useBookmarksStore((s) => s.bookmarks.length);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Tab bar — scrollable so it stays usable at any panel width */}
      <div className="flex shrink-0 items-stretch overflow-x-auto border-b border-border">
        <TabButton
          label="Cuestionario"
          active={rightPanelTab === "cuestionario"}
          onClick={() => setRightPanelTab("cuestionario")}
        />
        <TabButton
          label="Notas"
          active={rightPanelTab === "anotaciones"}
          onClick={() => setRightPanelTab("anotaciones")}
          badge={annotationCount > 0 ? String(annotationCount > 99 ? "99+" : annotationCount) : undefined}
        />
        <TabButton
          label="Citas"
          active={rightPanelTab === "citas"}
          onClick={() => setRightPanelTab("citas")}
          badge={citasCount > 0 ? String(citasCount > 99 ? "99+" : citasCount) : undefined}
        />
        <TabButton
          label="Síntesis"
          active={rightPanelTab === "sintesis"}
          onClick={() => setRightPanelTab("sintesis")}
          dot={sintesisContent.trim().length > 0}
        />
        <TabButton
          label="Marcadores"
          active={rightPanelTab === "bookmarks"}
          onClick={() => setRightPanelTab("bookmarks")}
          badge={bookmarksCount > 0 ? String(bookmarksCount > 99 ? "99+" : bookmarksCount) : undefined}
        />
      </div>

      <Separator className="shrink-0" />

      {/* Panel content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {rightPanelTab === "cuestionario" && <Questionnaire questions={questions} />}
        {rightPanelTab === "anotaciones"  && <NotesPanel />}
        {rightPanelTab === "citas"        && <CitasPanel />}
        {rightPanelTab === "sintesis"     && <SintesisPanel />}
        {rightPanelTab === "bookmarks"   && <BookmarksPanel />}
      </div>
    </div>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  label,
  active,
  onClick,
  badge,
  dot,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: string;
  dot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex-1 min-w-[58px] py-[6px] text-xs font-medium transition-colors whitespace-nowrap px-3",
        active
          ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[1px] after:bg-primary"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {badge && (
        <Badge
          variant="secondary"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-3.5 min-w-[14px] px-0.5 text-[8px] leading-none"
        >
          {badge}
        </Badge>
      )}
      {dot && !badge && (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary/60" />
      )}
    </button>
  );
}
