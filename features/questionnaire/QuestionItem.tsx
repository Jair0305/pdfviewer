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
        "group relative flex items-start gap-2 border-b border-border py-2.5 px-3 transition-colors",
        value === "yes" && "bg-green-500/5",
        value === "no" && "bg-destructive/5",
        value === null && "hover:bg-muted/30",
      )}
    >
      {/* Decorative left border for active state */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-[2px] transition-colors",
          value === "yes" ? "bg-green-500" : value === "no" ? "bg-destructive" : "bg-transparent group-hover:bg-border"
        )}
      />
      <div className="flex items-start gap-2">
        {/* Index */}
        <span className="mt-0.5 shrink-0 text-xs font-mono text-muted-foreground">
          {String(index).padStart(2, "0")}
        </span>

        {/* Question text */}
        <p className="flex-1 text-sm leading-snug">
          {question.text}
          {question.required && (
            <span className="ml-1 text-red-500" title="Obligatoria">*</span>
          )}
        </p>

        {/* Answer buttons */}
        <div className="flex shrink-0 items-center justify-end gap-0.5 mt-[2px]">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 rounded text-muted-foreground",
              value === "yes" && "bg-green-500/20 text-green-600 dark:text-green-400 hover:bg-green-500/30 hover:text-green-500",
              value !== "yes" && "hover:bg-muted"
            )}
            onClick={() => handleToggle("yes")}
            title="Sí"
          >
            <IconCheck size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 rounded text-muted-foreground",
              value === "no" && "bg-destructive/20 text-destructive hover:bg-destructive/30 hover:text-destructive",
              value !== "no" && "hover:bg-muted"
            )}
            onClick={() => handleToggle("no")}
            title="No"
          >
            <IconX size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
