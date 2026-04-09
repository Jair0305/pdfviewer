"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  IconListCheck,
  IconCircleCheck,
  IconCircleX,
  IconCircleDashed,
  IconFileAlert,
} from "@tabler/icons-react";
import { QuestionItem } from "./QuestionItem";
import { useQuestionnaireStore } from "@/state/questionnaire.store";
import type { Question } from "@/types/expediente";

interface QuestionnaireProps {
  questions: Question[];
  /** Active file path — answers are stored per file */
  filePath: string | null;
}

export function Questionnaire({ questions, filePath }: QuestionnaireProps) {
  const { getAnswers, getProgress, setAnswer } = useQuestionnaireStore();

  const answers  = filePath ? getAnswers(filePath) : {};
  const progress = filePath ? getProgress(filePath, questions.length) : { answered: 0, yes: 0, no: 0 };

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

  if (!filePath) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <IconFileAlert size={36} strokeWidth={1} className="opacity-30" />
        <p className="text-sm">Abre un PDF para revisar</p>
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
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-3">
          {Array.from(grouped.entries()).map(([category, qs]) => (
            <div key={category}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                {category}
              </p>
              <div className="space-y-1.5">
                {qs.map((q, i) => (
                  <QuestionItem
                    key={q.id}
                    question={q}
                    value={answers[q.id]?.value ?? null}
                    onAnswer={(val) => setAnswer(filePath, q.id, val)}
                    index={i + 1}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
