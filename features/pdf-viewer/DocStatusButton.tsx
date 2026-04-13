"use client";

import { useState, useRef, useEffect } from "react";
import { useDocStatusStore } from "@/state/docStatus.store";
import type { DocStatus } from "@/types/docStatus";
import { cn } from "@/lib/utils";

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: DocStatus; label: string; dot: string; text: string }[] = [
  { value: "sin_revisar",       label: "Sin revisar",       dot: "bg-muted-foreground/40", text: "text-muted-foreground/60" },
  { value: "en_revision",       label: "En revisión",       dot: "bg-amber-500",           text: "text-amber-600"           },
  { value: "revisado",          label: "Revisado",           dot: "bg-green-500",           text: "text-green-600"           },
  { value: "con_observaciones", label: "Con observaciones", dot: "bg-red-500",             text: "text-red-600"             },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface DocStatusButtonProps {
  relativeFilePath: string;
}

export function DocStatusButton({ relativeFilePath }: DocStatusButtonProps) {
  const { statuses, setDocStatus } = useDocStatusStore();
  const status  = statuses[relativeFilePath] ?? "sin_revisar";
  const config  = STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[0];

  const [open, setOpen] = useState(false);
  const ref  = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors",
          "hover:bg-accent",
          config.text,
        )}
        title="Estado del documento"
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dot)} />
        {config.label}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-md border bg-popover py-1 shadow-lg text-[12px]">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setDocStatus(relativeFilePath, opt.value); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-1.5 transition-colors hover:bg-accent",
                opt.text,
                status === opt.value && "font-semibold",
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", opt.dot)} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
