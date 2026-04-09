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
        "rounded-md border p-3 transition-colors",
        value === "yes" && "border-green-500/40 bg-green-500/5",
        value === "no" && "border-red-500/40 bg-red-500/5",
        value === null && "border-border",
      )}
    >
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
        <div className="flex shrink-0 gap-1">
          <Button
            variant={value === "yes" ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 w-10 text-xs",
              value === "yes" && "bg-green-600 hover:bg-green-700 border-green-600",
            )}
            onClick={() => handleToggle("yes")}
          >
            <IconCheck size={13} />
          </Button>
          <Button
            variant={value === "no" ? "default" : "outline"}
            size="sm"
            className={cn(
              "h-7 w-10 text-xs",
              value === "no" && "bg-red-600 hover:bg-red-700 border-red-600",
            )}
            onClick={() => handleToggle("no")}
          >
            <IconX size={13} />
          </Button>
        </div>
      </div>
    </div>
  );
}
