"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTheme } from "next-themes";
import {
  IconSearch, IconZoomIn, IconZoomOut, IconMaximize,
  IconRotate, IconRotateClockwise, IconEye, IconFocusCentered,
  IconSunHigh, IconLayoutGrid, IconLayoutColumns, IconLayoutSidebarLeftExpand,
  IconPencil, IconEraser, IconPointer, IconArrowBackUp, IconArrowForwardUp,
  IconSearch as IconSearchPdf, IconKeyboard, IconSettings2,
  IconSun, IconMoon, IconDeviceDesktop, IconBookmark, IconQuote,
  IconFileDescription, IconNotes, IconHelp, IconFolderOpen, IconFolderX,
  IconChevronRight,
} from "@tabler/icons-react";
import { useWorkbenchStore } from "@/state/workbench.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useExplorerStore } from "@/state/explorer.store";
import { useUXStore } from "@/state/ux.store";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Command {
  id:           string;
  label:        string;
  description?: string;
  keywords:     string[];
  icon:         React.ElementType;
  group:        string;
  action:       () => void;
}

// ─── Search ───────────────────────────────────────────────────────────────────

function scoreCommand(cmd: Command, query: string): number {
  if (!query) return 1;
  const q   = query.toLowerCase();
  const lbl = cmd.label.toLowerCase();
  const kw  = cmd.keywords.join(" ").toLowerCase();
  if (lbl.startsWith(q))    return 3;
  if (lbl.includes(q))      return 2;
  if (kw.includes(q))       return 1;
  return 0;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded-sm">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── CommandPalette ───────────────────────────────────────────────────────────

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLDivElement>(null);

  const { theme, setTheme } = useTheme();

  // Store refs — read at execution time to avoid stale closures
  const wb  = useWorkbenchStore;
  const ann = useAnotacionesStore;
  const exp = useExplorerStore;
  const ux  = useUXStore;

  const paneAction = useCallback((fn: (actions: NonNullable<ReturnType<typeof wb.getState>["_paneActions"]["left"]>) => void) => {
    const { focusedPane, _paneActions } = wb.getState();
    const actions = _paneActions[focusedPane];
    if (actions) fn(actions);
  }, []);

  // ── Command definitions ────────────────────────────────────────────────────

  const COMMANDS = useMemo<Command[]>(() => [
    // ── Vista ──────────────────────────────────────────────────────────────
    {
      id: "zoom-in", label: "Aumentar zoom", keywords: ["zoom", "acercar", "+"],
      icon: IconZoomIn, group: "Vista",
      action: () => paneAction((a) => a.zoomIn()),
    },
    {
      id: "zoom-out", label: "Reducir zoom", keywords: ["zoom", "alejar", "-"],
      icon: IconZoomOut, group: "Vista",
      action: () => paneAction((a) => a.zoomOut()),
    },
    {
      id: "zoom-reset", label: "Zoom 100%", keywords: ["zoom", "reset", "original", "0"],
      icon: IconMaximize, group: "Vista",
      action: () => paneAction((a) => a.fitPage()),
    },
    {
      id: "rotate-left", label: "Rotar a la izquierda", keywords: ["rotar", "girar", "izquierda"],
      icon: IconRotate, group: "Vista",
      action: () => paneAction((a) => a.rotateLeft()),
    },
    {
      id: "rotate-right", label: "Rotar a la derecha", keywords: ["rotar", "girar", "derecha"],
      icon: IconRotateClockwise, group: "Vista",
      action: () => paneAction((a) => a.rotateRight()),
    },
    {
      id: "thumbs", label: "Mostrar / ocultar miniaturas", keywords: ["miniaturas", "thumbnails", "sidebar"],
      icon: IconLayoutSidebarLeftExpand, group: "Vista",
      action: () => paneAction((a) => a.toggleThumbs()),
    },
    {
      id: "gallery", label: "Vista galería de páginas", keywords: ["galeria", "galería", "páginas", "grid"],
      icon: IconLayoutGrid, group: "Vista",
      action: () => paneAction((a) => a.toggleGallery()),
    },
    {
      id: "split", label: "Abrir panel dividido", keywords: ["split", "dividir", "panel", "doble"],
      icon: IconLayoutColumns, group: "Vista",
      action: () => paneAction((a) => a.openInSplit()),
    },
    {
      id: "zen", label: "Modo Zen — foco total", keywords: ["zen", "foco", "focus", "distracción"],
      icon: IconFocusCentered, group: "Vista",
      action: () => ux.getState().setZenMode(!ux.getState().zenMode),
    },
    {
      id: "reading", label: "Modo Lectura (filtro ámbar)", keywords: ["lectura", "descanso", "ambar", "ojos", "luz"],
      icon: IconSunHigh, group: "Vista",
      action: () => ux.getState().setReadingMode(!ux.getState().readingMode),
    },

    // ── Anotaciones ────────────────────────────────────────────────────────
    {
      id: "pen", label: "Activar lápiz", keywords: ["lapiz", "lápiz", "anotar", "dibujar", "pen", "P"],
      icon: IconPencil, group: "Anotaciones",
      action: () => ann.getState().setAnnotationMode(ann.getState().annotationMode === "pen" ? null : "pen"),
    },
    {
      id: "eraser", label: "Activar borrador", keywords: ["borrar", "borrador", "erase", "E"],
      icon: IconEraser, group: "Anotaciones",
      action: () => ann.getState().setAnnotationMode(ann.getState().annotationMode === "erase" ? null : "erase"),
    },
    {
      id: "pointer", label: "Modo normal (cursor)", keywords: ["normal", "cursor", "puntero", "pointer"],
      icon: IconPointer, group: "Anotaciones",
      action: () => ann.getState().setAnnotationMode(null),
    },
    {
      id: "undo", label: "Deshacer anotación", keywords: ["deshacer", "undo", "ctrl+z"],
      icon: IconArrowBackUp, group: "Anotaciones",
      action: () => ann.getState().undo(),
    },
    {
      id: "redo", label: "Rehacer anotación", keywords: ["rehacer", "redo", "ctrl+y"],
      icon: IconArrowForwardUp, group: "Anotaciones",
      action: () => ann.getState().redo(),
    },

    // ── Paneles ────────────────────────────────────────────────────────────
    {
      id: "tab-cuestionario", label: "Ir a Cuestionario", keywords: ["cuestionario", "preguntas", "checklist"],
      icon: IconHelp, group: "Paneles",
      action: () => wb.getState().openRightPanelTab("cuestionario"),
    },
    {
      id: "tab-notas", label: "Ir a Notas / Anotaciones", keywords: ["notas", "anotaciones", "notes"],
      icon: IconNotes, group: "Paneles",
      action: () => wb.getState().openRightPanelTab("anotaciones"),
    },
    {
      id: "tab-citas", label: "Ir a Citas", keywords: ["citas", "fragmentos", "quotes"],
      icon: IconQuote, group: "Paneles",
      action: () => wb.getState().openRightPanelTab("citas"),
    },
    {
      id: "tab-sintesis", label: "Ir a Síntesis", keywords: ["sintesis", "síntesis", "resumen", "summary"],
      icon: IconFileDescription, group: "Paneles",
      action: () => wb.getState().openRightPanelTab("sintesis"),
    },
    {
      id: "tab-bookmarks", label: "Ir a Marcadores", keywords: ["marcadores", "bookmarks", "favoritos"],
      icon: IconBookmark, group: "Paneles",
      action: () => wb.getState().setRightPanelTab("bookmarks"),
    },

    // ── Búsqueda ───────────────────────────────────────────────────────────
    {
      id: "search-pdf", label: "Buscar en PDF (Ctrl+F)", keywords: ["buscar", "busqueda", "búsqueda", "search", "find"],
      icon: IconSearchPdf, group: "Herramientas",
      action: () => paneAction((a) => a.toggleSearch()),
    },

    // ── Expediente ─────────────────────────────────────────────────────────
    {
      id: "open-folder", label: "Abrir expediente", keywords: ["abrir", "carpeta", "expediente", "folder"],
      icon: IconFolderOpen, group: "Expediente",
      action: () => exp.getState().openDirectory(),
    },
    {
      id: "close-folder", label: "Cerrar expediente", keywords: ["cerrar", "close", "expediente"],
      icon: IconFolderX, group: "Expediente",
      action: () => exp.getState().closeDirectory(),
    },

    // ── Tema ───────────────────────────────────────────────────────────────
    {
      id: "theme-light", label: "Tema claro", keywords: ["claro", "light", "blanco", "tema"],
      icon: IconSun, group: "Apariencia",
      action: () => setTheme("light"),
    },
    {
      id: "theme-dark", label: "Tema oscuro", keywords: ["oscuro", "dark", "negro", "tema"],
      icon: IconMoon, group: "Apariencia",
      action: () => setTheme("dark"),
    },
    {
      id: "theme-system", label: "Tema del sistema", keywords: ["sistema", "system", "auto", "tema"],
      icon: IconDeviceDesktop, group: "Apariencia",
      action: () => setTheme("system"),
    },

    // ── App ────────────────────────────────────────────────────────────────
    {
      id: "shortcuts", label: "Ver atajos de teclado", keywords: ["atajos", "shortcuts", "teclado", "keyboard", "?"],
      icon: IconKeyboard, group: "App",
      action: () => wb.getState().setShortcutsOpen(true),
    },
    {
      id: "settings", label: "Abrir configuración", keywords: ["configuracion", "configuración", "settings", "ajustes"],
      icon: IconSettings2, group: "App",
      action: () => wb.getState().setSettingsOpen(true),
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [paneAction, setTheme]);

  // ── Filtered + grouped results ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    const scored = COMMANDS
      .map((cmd) => ({ cmd, score: scoreCommand(cmd, query) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    // Group preserving score order
    const groups: Record<string, Command[]> = {};
    for (const { cmd } of scored) {
      (groups[cmd.group] ??= []).push(cmd);
    }
    return groups;
  }, [COMMANDS, query]);

  const flatList = useMemo(() =>
    Object.values(filtered).flat(),
  [filtered]);

  // Clamp selected index when results change
  useEffect(() => {
    setSelected((s) => Math.min(s, Math.max(flatList.length - 1, 0)));
  }, [flatList.length]);

  // Auto-focus input
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, flatList.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = flatList[selected];
        if (cmd) { onClose(); cmd.action(); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flatList, onClose, selected]);

  const execute = (cmd: Command) => { onClose(); cmd.action(); };

  let flatIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[99996] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-[580px] max-w-[95vw] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <IconSearch size={16} className="shrink-0 text-muted-foreground/50" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            placeholder="Buscar comando…"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground/40 focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(""); setSelected(0); inputRef.current?.focus(); }}
              className="text-muted-foreground/40 hover:text-foreground transition-colors">
              ✕
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/60">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[400px] overflow-y-auto py-2">
          {flatList.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground/40">
              Sin resultados para "{query}"
            </p>
          ) : (
            Object.entries(filtered).map(([group, cmds]) => (
              <div key={group}>
                {/* Group header */}
                <p className="px-4 pb-1 pt-3 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/35">
                  {group}
                </p>
                {cmds.map((cmd) => {
                  const idx      = flatIdx++;
                  const isActive = idx === selected;
                  const Icon     = cmd.icon;
                  return (
                    <button
                      key={cmd.id}
                      data-idx={idx}
                      onClick={() => execute(cmd)}
                      onMouseEnter={() => setSelected(idx)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                        isActive ? "bg-primary/8 text-foreground" : "text-foreground/70 hover:bg-muted/50",
                      )}
                    >
                      <div className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        isActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border/60 bg-muted/40 text-muted-foreground/60",
                      )}>
                        <Icon size={13} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{highlightMatch(cmd.label, query)}</p>
                        {cmd.description && (
                          <p className="text-[10px] text-muted-foreground/50 truncate">{cmd.description}</p>
                        )}
                      </div>
                      {isActive && <IconChevronRight size={12} className="shrink-0 text-primary/50" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-border/50 px-4 py-2 text-[10px] text-muted-foreground/40">
          <span><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono">Enter</kbd> ejecutar</span>
          <span><kbd className="font-mono">Esc</kbd> cerrar</span>
          <span className="ml-auto">{flatList.length} comandos</span>
        </div>
      </div>
    </div>
  );
}
