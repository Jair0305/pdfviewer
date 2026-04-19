"use client";

import { useEffect } from "react";
import { IconX, IconKeyboard } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Shortcut {
  keys:  string[];
  label: string;
}

interface ShortcutGroup {
  title: string;
  items: Shortcut[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "General",
    items: [
      { keys: ["Ctrl", "K"], label: "Abrir paleta de comandos" },
      { keys: ["D"],         label: "Cambiar tema claro / oscuro" },
      { keys: ["?"],         label: "Mostrar esta referencia de atajos" },
      { keys: ["Esc"],       label: "Cerrar modal / salir de modo activo" },
    ],
  },
  {
    title: "Zoom",
    items: [
      { keys: ["+"],         label: "Aumentar zoom" },
      { keys: ["-"],         label: "Reducir zoom" },
      { keys: ["0"],         label: "Restablecer zoom (100%)" },
      { keys: ["Ctrl", "+"], label: "Zoom + (con foco en PDF)" },
      { keys: ["Ctrl", "-"], label: "Zoom - (con foco en PDF)" },
      { keys: ["Ctrl", "0"], label: "Reset zoom (con foco en PDF)" },
    ],
  },
  {
    title: "Anotaciones",
    items: [
      { keys: ["P"],             label: "Activar / desactivar lápiz" },
      { keys: ["E"],             label: "Activar / desactivar borrador" },
      { keys: ["Ctrl", "Z"],     label: "Deshacer última anotación" },
      { keys: ["Ctrl", "Y"],     label: "Rehacer" },
      { keys: ["Ctrl", "⇧", "Z"], label: "Rehacer (alternativo)" },
    ],
  },
  {
    title: "PDF — Búsqueda",
    items: [
      { keys: ["Ctrl", "F"],   label: "Abrir / cerrar barra de búsqueda" },
      { keys: ["Enter"],       label: "Ir al siguiente resultado" },
      { keys: ["Esc"],         label: "Cerrar búsqueda" },
    ],
  },
  {
    title: "Popup de nota",
    items: [
      { keys: ["Esc"],           label: "Cerrar y guardar nota" },
      { keys: ["Ctrl", "Enter"], label: "Cerrar y guardar nota" },
    ],
  },
  {
    title: "Vista",
    items: [
      { keys: ["Alt", "Z"], label: "Modo Zen — foco total" },
      { keys: ["Esc"],      label: "Salir de Modo Zen" },
    ],
  },
];

// ─── Kbd ──────────────────────────────────────────────────────────────────────

function Kbd({ children }: { children: string }) {
  return (
    <kbd className={cn(
      "inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md",
      "border border-border bg-muted text-[11px] font-semibold font-mono",
      "text-foreground/80 shadow-[0_1px_0_0_hsl(var(--border))]",
    )}>
      {children}
    </kbd>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[99997] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-[640px] max-w-[95vw] max-h-[80vh] rounded-2xl bg-background border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/15">
            <IconKeyboard size={15} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Atajos de teclado</h2>
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Presiona <Kbd>?</Kbd> en cualquier momento para mostrar esta guía</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <IconX size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6">
            {GROUPS.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-3">
                  {group.title}
                </p>
                {group.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-4 py-1">
                    <span className="text-xs text-foreground/70 min-w-0">{item.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, ki) => (
                        <span key={ki} className="flex items-center gap-1">
                          <Kbd>{k}</Kbd>
                          {ki < item.keys.length - 1 && (
                            <span className="text-[10px] text-muted-foreground/30">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border/40 px-6 py-3 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/40">Los atajos se ignoran cuando hay un campo de texto activo</span>
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
