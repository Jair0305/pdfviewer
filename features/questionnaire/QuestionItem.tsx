"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconCheck, IconX } from "@tabler/icons-react";
import { useAudioFeedback } from "@/hooks/useAudioFeedback";
import { useUXStore } from "@/state/ux.store";
import type { Question, AnswerValue } from "@/types/expediente";

function BionicText({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => {
        const mid = Math.ceil(word.length / 2);
        const bold = word.slice(0, mid);
        const rest = word.slice(mid);
        return (
          <span key={i} className="mr-1 inline-block">
            <span className="font-bold text-foreground/90">{bold}</span>
            <span className="opacity-70">{rest}</span>
          </span>
        );
      })}
    </>
  );
}

interface QuestionItemProps {
  question: Question;
  value: AnswerValue;
  onAnswer: (value: AnswerValue) => void;
  index: number;
  isFocused?: boolean;
}

export function QuestionItem({ question, value, onAnswer, index, isFocused }: QuestionItemProps) {
  const { playTick } = useAudioFeedback();
  const { bionicReading } = useUXStore();

  const handleToggle = (newValue: AnswerValue) => {
    playTick();
    onAnswer(value === newValue ? null : newValue);
  };

  return (
    <div 
      className={cn(
        "group/item relative flex flex-col gap-3 rounded-xl border border-border/40 bg-muted/20 p-4 transition-all duration-300",
        "hover:bg-background hover:border-primary/20 hover:shadow-md"
      )}
    >
      {/* Decorative indicator */}
      <div
        className={cn(
          "absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full transition-all duration-500",
          value === "yes" ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : 
          value === "no" ? "bg-destructive shadow-[0_0_10px_rgba(239,68,68,0.3)]" : 
          "bg-transparent group-hover/item:bg-muted-foreground/20"
        )}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 pl-1">
          {/* Index: subtle monospace for structure */}
          <span className="mt-1 shrink-0 text-[10px] font-mono font-medium text-muted-foreground/40 select-none">
            {String(index).padStart(2, "0")}
          </span>

          {/* Question text: relaxed leading for health-focused readability */}
          <div className={cn(
            "text-[13px] leading-relaxed transition-colors duration-300",
            value ? "text-foreground font-medium" : "text-foreground/80"
          )}>
            {bionicReading ? <BionicText text={question.text} /> : question.text}
            {question.required && (
              <span className="ml-1 text-destructive/60 font-bold" title="Obligatoria">*</span>
            )}
          </div>
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
