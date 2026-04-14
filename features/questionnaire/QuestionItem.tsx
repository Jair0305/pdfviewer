"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconCheck, IconX } from "@tabler/icons-react";
import type { Question, AnswerValue } from "@/types/expediente";

interface QuestionItemProps {
  question: Question;
  value: AnswerValue;
  onAnswer: (value: AnswerValue) => void;
  index: number;
}

export function QuestionItem({ question, value, onAnswer, index }: QuestionItemProps) {
  const handleToggle = (btn: "yes" | "no") => {
    onAnswer(value === btn ? null : btn);
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3 border-b border-border/50 py-4 px-4 transition-all duration-300",
        value === "yes" && "bg-green-500/[0.03]",
        value === "no" && "bg-destructive/[0.03]",
        value === null && "hover:bg-muted/[0.15]",
      )}
    >
      {/* Decorative indicator: Thicker and with a soft glow when active */}
      <div
        className={cn(
          "absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full transition-all duration-500",
          value === "yes" ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : 
          value === "no" ? "bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.3)]" : 
          "bg-transparent group-hover:bg-muted-foreground/20"
        )}
      />
      
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          {/* Index: subtle monospace for structure */}
          <span className="mt-1 shrink-0 text-[10px] font-mono font-medium text-muted-foreground/40 select-none">
            {String(index).padStart(2, "0")}
          </span>

          {/* Question text: relaxed leading for health-focused readability */}
          <p className={cn(
            "text-[13px] leading-relaxed transition-colors duration-300",
            value ? "text-foreground font-medium" : "text-foreground/80"
          )}>
            {question.text}
            {question.required && (
              <span className="ml-1 text-destructive/60 font-bold" title="Obligatoria">*</span>
            )}
          </p>
        </div>

        {/* Answer buttons: tactile and clear */}
        <div className="flex shrink-0 items-center justify-end gap-1.5 mt-0.5">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 rounded-lg border border-transparent transition-all duration-300",
              value === "yes" && "bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400 scale-110 shadow-sm",
              value !== "yes" && "text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground"
            )}
            onClick={() => handleToggle("yes")}
          >
            <IconCheck size={15} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 w-7 rounded-lg border border-transparent transition-all duration-300",
              value === "no" && "bg-destructive/10 border-destructive/20 text-destructive scale-110 shadow-sm",
              value !== "no" && "text-muted-foreground/40 hover:bg-muted hover:text-muted-foreground"
            )}
            onClick={() => handleToggle("no")}
          >
            <IconX size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}
