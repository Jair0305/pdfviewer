"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { IconFileDescription, IconFolderOpen } from "@tabler/icons-react";
import { Separator } from "@/components/ui/separator";
import { useSintesisStore } from "@/state/sintesis.store";
import { useRevisionStore } from "@/state/revision.store";

export function SintesisPanel() {
  const { isLoaded, isSaving, setContent } = useSintesisStore();
  const { isLoaded: revLoaded, meta } = useRevisionStore();

  // Local state for instant textarea response — store is updated via debounce
  const [localContent, setLocalContent] = useState(() => useSintesisStore.getState().content);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When a new expediente is loaded/unloaded, sync from store once
  useEffect(() => {
    if (isLoaded) {
      setLocalContent(useSintesisStore.getState().content);
    } else {
      setLocalContent("");
    }
  }, [isLoaded]);

  const handleChange = (text: string) => {
    setLocalContent(text);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setContent(text), 600);
  };

  const wordCount = useMemo(() => {
    if (!localContent.trim()) return 0;
    return localContent.trim().split(/\s+/).filter(Boolean).length;
  }, [localContent]);

  if (!revLoaded || !isLoaded) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <IconFolderOpen size={36} strokeWidth={1} className="opacity-30" />
        <p className="text-sm">Abre un expediente para escribir la síntesis</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <IconFileDescription size={13} className="shrink-0 text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Síntesis del expediente
        </span>
      </div>

      <Separator className="shrink-0" />

      {/* Expediente info */}
      {meta && (
        <div className="flex shrink-0 flex-col gap-0.5 border-b bg-muted/20 px-3 py-2">
          <p className="truncate text-[11px] font-medium text-foreground/80">{meta.expedienteId}</p>
          <p className="truncate text-[10px] text-muted-foreground/60">{meta.relativePath}</p>
        </div>
      )}

      {/* Textarea */}
      <textarea
        className={
          "min-h-0 flex-1 w-full resize-none bg-background px-3 py-2 text-sm leading-relaxed " +
          "placeholder:text-muted-foreground/30 focus:outline-none"
        }
        placeholder="Escribe aquí el resumen del expediente…"
        value={localContent}
        onChange={(e) => handleChange(e.target.value)}
        spellCheck
      />

      {/* Footer */}
      <div className="flex shrink-0 items-center gap-2 border-t px-3 py-1 text-[10px] text-muted-foreground/50">
        <span>{wordCount} {wordCount === 1 ? "palabra" : "palabras"}</span>
        <span className="ml-auto">
          {isSaving
            ? "Guardando…"
            : localContent.trim()
              ? "Guardado ✓"
              : ""}
        </span>
      </div>
    </div>
  );
}
