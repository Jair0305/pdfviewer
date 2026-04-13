"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  IconListCheck,
  IconCircleCheck,
  IconCircleX,
  IconCircleDashed,
  IconFolderOpen,
  IconAlertTriangle,
  IconCloudOff,
  IconX,
} from "@tabler/icons-react";
import { QuestionItem } from "./QuestionItem";
import { useRevisionStore } from "@/state/revision.store";
import type { Question } from "@/types/expediente";

interface QuestionnaireProps {
  questions: Question[];
}

export function Questionnaire({ questions }: QuestionnaireProps) {
  const { isLoaded, meta, warning, isOutsideClientes, dismissWarning, getAnswers, getProgress, setAnswer } =
    useRevisionStore();

  const answers  = getAnswers();
  const progress = getProgress(questions.length);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const q of questions) {
      const cat = q.category ?? "General";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(q);
    }
    return map;
  }, [questions]);

  if (!isLoaded) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center overflow-hidden text-muted-foreground">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40 dark:mix-blend-screen">
          <div className="h-48 w-48 rounded-full bg-primary/10 blur-[60px]" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-700">
          <div className="text-foreground/20">
            <IconFolderOpen size={48} strokeWidth={1} />
          </div>
          <p className="text-[13px] font-medium text-foreground/70">Abre un expediente para revisar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <IconListCheck size={13} className="shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cuestionario
        </span>
      </div>

      <Separator className="shrink-0" />

      {/* Active expediente indicator */}
      {meta && (
        <div className="flex shrink-0 flex-col gap-0.5 bg-muted/20 px-3 py-1.5">
          <div className="flex items-center gap-1.5">
            <IconFolderOpen size={11} className="shrink-0 text-yellow-500" />
            <span
              className="truncate text-[11px] font-semibold text-foreground"
              title={meta.expedientePath}
            >
              {meta.expedienteId}
            </span>
          </div>
          {meta.relativePath !== meta.expedienteId && (
            <span
              className="truncate pl-[19px] text-[10px] text-muted-foreground"
              title={meta.relativePath}
            >
              {meta.relativePath}
            </span>
          )}
        </div>
      )}

      {/* Outside clientesFolder — memory-only indicator */}
      {isOutsideClientes && (
        <div className="flex shrink-0 items-center gap-2 border-b border-muted bg-muted/40 px-3 py-1.5">
          <IconCloudOff size={11} className="shrink-0 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground">
            Fuera de la carpeta de clientes — solo memoria, no se guarda
          </span>
        </div>
      )}

      {/* Name-collision warning */}
      {warning?.type === "name_collision" && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2">
          <div className="flex items-start gap-2">
            <IconAlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                Posible conflicto de nombre
              </p>
              <p className="mt-0.5 break-all text-[10px] text-muted-foreground">
                Esta revisión fue creada para:{" "}
                <span className="font-mono">{warning.conflictPath}</span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 text-muted-foreground"
              onClick={dismissWarning}
            >
              <IconX size={11} />
            </Button>
          </div>
        </div>
      )}

      <Separator className="shrink-0" />

      {/* Stats */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <Badge variant="outline" className="gap-1 text-[11px]">
          <IconCircleDashed size={11} />
          {progress.answered}/{questions.length}
        </Badge>
        <Badge variant="outline" className="gap-1 text-[11px] text-green-600 border-green-500/30">
          <IconCircleCheck size={11} />
          {progress.yes}
        </Badge>
        <Badge variant="outline" className="gap-1 text-[11px] text-red-600 border-red-500/30">
          <IconCircleX size={11} />
          {progress.no}
        </Badge>
      </div>

      <Separator className="shrink-0" />

      {/* Questions */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-4 p-3">
            {Array.from(grouped.entries()).map(([category, qs]) => (
              <div key={category}>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {category}
                </p>
                <div className="flex flex-col">
                  {qs.map((q, i) => (
                    <QuestionItem
                      key={q.id}
                      question={q}
                      value={answers[q.id]?.value ?? null}
                      onAnswer={(val) => setAnswer(q.id, val)}
                      index={i + 1}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
