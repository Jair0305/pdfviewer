"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  IconZoomIn,
  IconZoomOut,
  IconLoader2,
  IconFileAlert,
  IconMaximize,
  IconRotate,
  IconRotateClockwise,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconPencil,
  IconEraser,
  IconPointer,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconQuote,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { FileNode } from "@/types/expediente";
import type { AnnotationColor, NormalizedPoint, NormalizedRect } from "@/types/anotaciones";
import { useIsElectron } from "@/hooks/useIsElectron";
import { useEditorStore } from "@/state/editor.store";
import { useRevisionStore } from "@/state/revision.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useCitasStore } from "@/state/citas.store";
import { useDocStatusStore } from "@/state/docStatus.store";
import { useWorkbenchStore } from "@/state/workbench.store";
import { AnnotationOverlay, toCanonicalRect } from "@/features/annotations/AnnotationOverlay";
import { DocStatusButton } from "@/features/pdf-viewer/DocStatusButton";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLOR_DOT: Record<AnnotationColor, string> = {
  yellow: "bg-amber-400",
  green:  "bg-green-500",
  red:    "bg-red-500",
  blue:   "bg-blue-500",
};

function computeRelativeFilePath(filePath: string, expedientePath: string): string {
  const fwd    = filePath.replace(/\\/g, "/");
  const expFwd = expedientePath.replace(/\\/g, "/").replace(/\/$/, "");
  if (fwd.startsWith(expFwd + "/")) return fwd.slice(expFwd.length);
  return "/" + (fwd.split("/").pop() ?? "");
}

// ─── Note popup ───────────────────────────────────────────────────────────────

interface NotePopupState {
  annotationId: string;
  pageNum:      number;
  x:            number; // overlay-pixel x (relative to page wrapper div)
  y:            number; // overlay-pixel y
}

interface NotePopupProps {
  state:      NotePopupState;
  pageWidth:  number;
  pageHeight: number;
  onClose:    () => void;
}

function NotePopup({ state, pageWidth, pageHeight, onClose }: NotePopupProps) {
  const { updateAnnotationText, annotations } = useAnotacionesStore();
  const annotation = annotations.find((a) => a.id === state.annotationId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  // Position popup to the bottom-right of the stroke endpoint, clamped to page bounds
  const POPUP_W = 200;
  const POPUP_H = 136;
  const OFFSET  = 14;
  const left = Math.min(Math.max(state.x + OFFSET, 4), pageWidth  - POPUP_W - 4);
  const top  = Math.min(Math.max(state.y + OFFSET, 4), pageHeight - POPUP_H - 4);

  return (
    <div
      style={{ position: "absolute", left, top, width: POPUP_W, zIndex: 30 }}
      className="rounded-lg border bg-background shadow-2xl"
      // Prevent clicks on the popup from propagating to the page (which would close it or start drawing)
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-2.5 py-1">
        <span className="text-[10px] font-medium text-muted-foreground">Añadir nota</span>
        <button
          onClick={onClose}
          className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
          title="Cerrar (Esc)"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={annotation?.text ?? ""}
        onChange={(e) => updateAnnotationText(state.annotationId, e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onClose();
          e.stopPropagation(); // don't let Escape reach PdfViewer keyboard handler
        }}
        placeholder="Escribe tu apunte… (Ctrl+Enter para cerrar)"
        rows={3}
        className={cn(
          "w-full resize-none bg-background px-2.5 py-1.5",
          "text-[11px] leading-relaxed placeholder:text-muted-foreground/40",
          "focus:outline-none",
        )}
      />

      {/* Footer */}
      <div className="flex items-center justify-between border-t px-2.5 py-1">
        <span className="text-[9px] text-muted-foreground/40">Esc para cerrar</span>
        <button
          onClick={onClose}
          className="rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground hover:opacity-90"
        >
          Listo
        </button>
      </div>
    </div>
  );
}

// ─── Selection bubble ─────────────────────────────────────────────────────────

interface SelectionBubbleState {
  pageNum:         number;
  viewportX:       number; // fixed viewport coords (right edge of selection)
  viewportY:       number; // fixed viewport coords (bottom edge of selection)
  normalizedRects: NormalizedRect[];
  selectedText:    string;
}

const COLOR_DOT_BUBBLE: Record<AnnotationColor, string> = {
  yellow: "bg-amber-400",
  green:  "bg-green-500",
  red:    "bg-red-500",
  blue:   "bg-blue-500",
};

interface SelectionBubbleProps {
  state:           SelectionBubbleState;
  relativeFilePath: string | null;
  activeColor:     AnnotationColor;
  onHighlight:     (color: AnnotationColor) => void;
  onAddToCitas:    () => void;
}

function SelectionBubble({
  state,
  onHighlight,
  onAddToCitas,
}: SelectionBubbleProps) {
  const BUBBLE_W = 116; // approx width: 4×color + gap + quote icon
  const BUBBLE_H = 32;
  const OFFSET   = 6;
  const left = Math.min(Math.max(state.viewportX + OFFSET, 8), window.innerWidth  - BUBBLE_W - 8);
  const top  = Math.min(Math.max(state.viewportY + OFFSET, 8), window.innerHeight - BUBBLE_H - 8);

  return (
    <div
      style={{ position: "fixed", left, top, zIndex: 9000 }}
      className="flex items-center gap-1 rounded-lg border bg-background px-2 py-1.5 shadow-xl"
      onMouseDown={(e) => e.stopPropagation()} // don't clear via scroll-area mousedown
    >
      {(["yellow", "green", "red", "blue"] as AnnotationColor[]).map((c) => (
        <button
          key={c}
          onClick={() => onHighlight(c)}
          className={cn(
            "h-4 w-4 rounded-full transition-all hover:scale-110 hover:ring-2 hover:ring-primary/40 hover:ring-offset-1",
            COLOR_DOT_BUBBLE[c],
          )}
          title={`Resaltar en ${c}`}
        />
      ))}
      <div className="mx-0.5 h-4 w-px bg-border" />
      <button
        onClick={onAddToCitas}
        className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        title="Añadir a citas"
      >
        <IconQuote size={13} />
      </button>
    </div>
  );
}

// ─── PdfViewer ────────────────────────────────────────────────────────────────

interface PdfViewerProps {
  file: FileNode | null;
}

export function PdfViewer({ file }: PdfViewerProps) {
  const inElectron        = useIsElectron();
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages]             = useState(0);
  const [currentPage, setCurrentPage]       = useState(1);
  const [scale, setScale]                   = useState(1.0);
  // renderScale follows scale with a short debounce so the PDF canvas only
  // re-renders after the user stops zooming — CSS transform bridges the gap visually
  const [renderScale, setRenderScale]       = useState(1.0);
  const renderScaleTimerRef                 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pageInputValue, setPageInputValue] = useState("1");
  const [showThumbs, setShowThumbs]         = useState(true);
  const [notePopup, setNotePopup]           = useState<NotePopupState | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<SelectionBubbleState | null>(null);

  // Blob URL for the current PDF
  const [pdfSrc, setPdfSrc]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Per-file rotation (view-only, not saved to disk)
  const { pageRotations, setPageRotation } = useEditorStore();
  const rotation = (file ? (pageRotations[file.path] ?? 0) : 0) as 0 | 90 | 180 | 270;

  const rotateLeft  = () => file && setPageRotation(file.path, rotation - 90);
  const rotateRight = () => file && setPageRotation(file.path, rotation + 90);

  // Refs for scroll-based page tracking
  const mainScrollRef   = useRef<HTMLDivElement>(null);
  const pageRefsMap     = useRef<Map<number, HTMLDivElement>>(new Map());
  const thumbRefsMap    = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef     = useRef<IntersectionObserver | null>(null);
  const ignoreScrollRef = useRef(false);
  const isEditingPageRef = useRef(false);

  // Intrinsic page dimensions (STATE so overlay mounts when values arrive)
  const [pageIntrinsics, setPageIntrinsics] = useState<Record<number, { w: number; h: number }>>({});

  // Annotations state
  const {
    annotations,
    annotationMode,
    activeColor,
    pendingNavigation,
    addAnnotation,
    deleteAnnotation,
    setAnnotationMode,
    setActiveColor,
    setEditingAnnotation,
    clearPendingNavigation,
    setCurrentVisiblePage,
    undo,
    redo,
    undoStack,
    redoStack,
  } = useAnotacionesStore();

  // Flash states (local — not persisted)
  const [flashingAnnotationId, setFlashingAnnotationId] = useState<string | null>(null);
  const [flashingPageNum, setFlashingPageNum]           = useState<number | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Citas store (for adding quotes from text selection)
  const { addCita } = useCitasStore();
  // Doc status store — loaded flag for toolbar button
  const { isLoaded: docStatusLoaded } = useDocStatusStore();
  const { setRightPanelTab } = useWorkbenchStore();

  // Revision meta for building relative file paths
  const meta = useRevisionStore((s) => s.meta);

  const relativeFilePath = useMemo(() => {
    if (!file) return null;
    if (meta) return computeRelativeFilePath(file.path, meta.expedientePath);
    return `/${file.name}`;
  }, [file, meta]);

  // ── Debounce renderScale behind scale to avoid per-keystroke canvas redraws ──
  useEffect(() => {
    if (renderScaleTimerRef.current) clearTimeout(renderScaleTimerRef.current);
    renderScaleTimerRef.current = setTimeout(() => setRenderScale(scale), 250);
  }, [scale]);

  // ── Page input sync ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isEditingPageRef.current) setPageInputValue(String(currentPage));
    setCurrentVisiblePage(currentPage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // ── Load PDF via IPC → Blob URL ──────────────────────────────────────────
  useEffect(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPdfSrc(null);
    setNumPages(0);
    setCurrentPage(1);
    setPageInputValue("1");
    setScale(1.0);
    setRenderScale(1.0);
    setLoadError(null);
    setPageIntrinsics({});
    setNotePopup(null);
    setSelectionBubble(null);

    if (!file || file.type !== "pdf") return;

    if (!inElectron) {
      setPdfSrc(file.path);
      return;
    }

    let cancelled = false;
    setLoading(true);

    window.api
      .readFile(file.path)
      .then((base64) => {
        if (cancelled) return;
        if (!base64 || base64.length === 0) {
          setLoadError("El archivo PDF está vacío (0 bytes).");
          return;
        }
        const binary = atob(base64);
        if (binary.length === 0) {
          setLoadError("El archivo PDF está vacío (0 bytes).");
          return;
        }
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url  = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setPdfSrc(url);
      })
      .catch(() => { if (!cancelled) setLoadError("No se pudo leer el archivo."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [file?.path, inElectron]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, []);

  // ── IntersectionObserver for current page tracking ───────────────────────
  useEffect(() => {
    if (!numPages || !mainScrollRef.current) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (ignoreScrollRef.current) return;
        let best = 0;
        let bestPage = currentPage;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > best) {
            best = entry.intersectionRatio;
            bestPage = Number((entry.target as HTMLElement).dataset.page);
          }
        }
        if (bestPage !== currentPage) {
          setCurrentPage(bestPage);
          thumbRefsMap.current.get(bestPage)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      },
      { root: mainScrollRef.current, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    pageRefsMap.current.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numPages]);

  // ── pendingNavigation ────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingNavigation || !file) return;
    const normFwd = (p: string) => p.replace(/\\/g, "/");
    if (normFwd(pendingNavigation.filePath) !== normFwd(file.path)) return;
    if (numPages === 0) return;
    scrollToPage(pendingNavigation.pageNumber);

    // Flash effect after a brief scroll delay
    const { highlightAnnotationId } = pendingNavigation;
    if (highlightAnnotationId) {
      const ann = useAnotacionesStore.getState().annotations.find((a) => a.id === highlightAnnotationId);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      setFlashingAnnotationId(null);
      setFlashingPageNum(null);
      setTimeout(() => {
        if (ann?.path && ann.path.length >= 2) {
          setFlashingAnnotationId(highlightAnnotationId);
        } else {
          // Page-level or doc-level note without stroke → flash entire page
          setFlashingPageNum(pendingNavigation.pageNumber);
        }
        flashTimeoutRef.current = setTimeout(() => {
          setFlashingAnnotationId(null);
          setFlashingPageNum(null);
        }, 2000);
      }, 300);
    }

    clearPendingNavigation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNavigation, file?.path, numPages]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";

      // Escape: close bubble/popup first, then exit mode
      if (e.key === "Escape") {
        if (selectionBubble) { setSelectionBubble(null); window.getSelection()?.removeAllRanges(); return; }
        if (notePopup) { setNotePopup(null); return; }
        if (annotationMode) { setAnnotationMode(null); return; }
        return;
      }

      // Undo / redo (always allowed, even while typing — standard behavior)
      if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.ctrlKey && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+zoom: only intercept when focus is inside the PDF viewer
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "0") {
          const viewerEl     = viewerContainerRef.current;
          const focused      = document.activeElement;
          // "PDF has focus" = focused element is inside viewer OR nothing specific is focused
          const pdfHasFocus  = !viewerEl || viewerEl.contains(focused) || focused === document.body;
          if (pdfHasFocus && !isTyping) {
            e.preventDefault(); // stop browser/OS zoom only when PDF owns focus
            if (e.key === "=" || e.key === "+") setScale((s) => Math.min(+(s + 0.2).toFixed(1), 3.0));
            else if (e.key === "-")             setScale((s) => Math.max(+(s - 0.2).toFixed(1), 0.4));
            else if (e.key === "0")             setScale(1.0);
          }
          // When a panel (e.g. Síntesis textarea) has focus: fall through → browser zoom works normally
          return;
        }
      }

      // Plain zoom & mode toggles (skip when typing or ctrl held)
      if (!isTyping && !e.ctrlKey && !e.altKey && !e.metaKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setScale((s) => Math.min(+(s + 0.2).toFixed(1), 3.0));
          return;
        }
        if (e.key === "-") {
          e.preventDefault();
          setScale((s) => Math.max(+(s - 0.2).toFixed(1), 0.4));
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          setScale(1.0);
          return;
        }
        // Mode toggles
        if (e.key === "p" || e.key === "P") {
          e.preventDefault();
          setAnnotationMode(annotationMode === "pen" ? null : "pen");
          return;
        }
        if (e.key === "e" || e.key === "E") {
          e.preventDefault();
          setAnnotationMode(annotationMode === "erase" ? null : "erase");
          return;
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [annotationMode, notePopup, selectionBubble, undo, redo, setAnnotationMode]);

  // ── Ctrl+scroll → zoom PDF (only when scrolling inside the viewer) ────────
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      setScale((s) => parseFloat(Math.min(Math.max(s + delta, 0.4), 3.0).toFixed(1)));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  // re-attach whenever the scroll area mounts (pdfSrc load / numPages change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfSrc, numPages]);

  // ── Callbacks ────────────────────────────────────────────────────────────

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setCurrentPage(1);
    setPageInputValue("1");
  }, []);

  const onDocumentLoadError = useCallback((error: Error) => {
    const msg = error?.message ?? "Error desconocido";
    setLoadError(
      msg.includes("zero bytes") || msg.includes("empty")
        ? "El archivo PDF está vacío (0 bytes)."
        : "No se pudo cargar el PDF.",
    );
    setPdfSrc(null);
  }, []);

  const scrollToPage = useCallback((page: number) => {
    const el = pageRefsMap.current.get(page);
    if (!el || !mainScrollRef.current) return;
    ignoreScrollRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentPage(page);
    setPageInputValue(String(page));
    thumbRefsMap.current.get(page)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => { ignoreScrollRef.current = false; }, 600);
  }, []);

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const p = parseInt(pageInputValue, 10);
      if (!isNaN(p) && p >= 1 && p <= numPages) scrollToPage(p);
      else setPageInputValue(String(currentPage));
      isEditingPageRef.current = false;
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      setPageInputValue(String(currentPage));
      isEditingPageRef.current = false;
      e.currentTarget.blur();
    }
  };

  const makePageRef = useCallback((pageNum: number) => (el: HTMLDivElement | null) => {
    if (el) {
      pageRefsMap.current.set(pageNum, el);
      observerRef.current?.observe(el);
    } else {
      const prev = pageRefsMap.current.get(pageNum);
      if (prev) observerRef.current?.unobserve(prev);
      pageRefsMap.current.delete(pageNum);
    }
  }, []);

  const makeThumbRef = useCallback((pageNum: number) => (el: HTMLDivElement | null) => {
    if (el) thumbRefsMap.current.set(pageNum, el);
    else thumbRefsMap.current.delete(pageNum);
  }, []);

  const zoomIn  = () => setScale((s) => Math.min(+(s + 0.2).toFixed(1), 3.0));
  const zoomOut = () => setScale((s) => Math.max(+(s - 0.2).toFixed(1), 0.4));
  const fitPage = () => setScale(1.0);

  // ── Annotation handlers ──────────────────────────────────────────────────

  const handleAnnotationCreated = useCallback((
    pageNum: number,
    path: NormalizedPoint[],
    endX: number,
    endY: number,
  ) => {
    if (!relativeFilePath) return;
    const id = crypto.randomUUID();
    addAnnotation({
      id,
      relativeFilePath,
      pageNumber: pageNum,
      path,
      color: activeColor,
      text: "",
    });
    setNotePopup({ annotationId: id, pageNum, x: endX, y: endY });
    setRightPanelTab("anotaciones");
  }, [relativeFilePath, activeColor, addAnnotation, setRightPanelTab]);

  const handleAnnotationClick = useCallback((id: string) => {
    setEditingAnnotation(id);
    setRightPanelTab("anotaciones");
  }, [setEditingAnnotation, setRightPanelTab]);

  const handleAnnotationDelete = useCallback((id: string) => {
    deleteAnnotation(id);
  }, [deleteAnnotation]);

  // ── Text selection → bubble ───────────────────────────────────────────────

  const handlePageMouseUp = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    pageNum: number,
  ) => {
    if (annotationMode === "pen" || annotationMode === "erase") return;
    // Small delay so the selection is finalized before we read it
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelectionBubble(null);
        return;
      }
      const selectedText = sel.toString().trim();
      if (!selectedText) { setSelectionBubble(null); return; }

      const range       = sel.getRangeAt(0);
      const clientRects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
      if (!clientRects.length) { setSelectionBubble(null); return; }

      const pageEl = pageRefsMap.current.get(pageNum);
      if (!pageEl) { setSelectionBubble(null); return; }

      const pageBounds = pageEl.getBoundingClientRect();
      const intrinsic  = pageIntrinsics[pageNum] ?? { w: 595, h: 842 };
      const canonW     = intrinsic.w * scale;
      const canonH     = intrinsic.h * scale;

      const normalizedRects: NormalizedRect[] = clientRects.map((r) =>
        toCanonicalRect(
          r.left - pageBounds.left,
          r.top  - pageBounds.top,
          r.width,
          r.height,
          canonW, canonH, rotation,
        ),
      );

      const last = clientRects[clientRects.length - 1];
      setSelectionBubble({
        pageNum,
        viewportX:       last.right,
        viewportY:       last.bottom,
        normalizedRects,
        selectedText,
      });
    }, 0);
  }, [annotationMode, pageIntrinsics, scale, rotation]);

  const handleHighlightFromBubble = useCallback((color: AnnotationColor) => {
    if (!selectionBubble || !relativeFilePath) return;
    const id = crypto.randomUUID();
    addAnnotation({
      id,
      type: "highlight",
      relativeFilePath,
      pageNumber: selectionBubble.pageNum,
      path: null,
      rects: selectionBubble.normalizedRects,
      selectedText: selectionBubble.selectedText,
      color,
      text: "",
    });
    // Position popup relative to the page div using page-local coords from viewport coords
    const pageEl = pageRefsMap.current.get(selectionBubble.pageNum);
    if (pageEl) {
      const bounds = pageEl.getBoundingClientRect();
      setNotePopup({
        annotationId: id,
        pageNum:      selectionBubble.pageNum,
        x:            selectionBubble.viewportX - bounds.left,
        y:            selectionBubble.viewportY - bounds.top,
      });
    }
    setRightPanelTab("anotaciones");
    window.getSelection()?.removeAllRanges();
    setSelectionBubble(null);
  }, [selectionBubble, relativeFilePath, addAnnotation, setRightPanelTab]);

  const handleAddToCitas = useCallback(() => {
    if (!selectionBubble) return;
    addCita({
      id:               crypto.randomUUID(),
      text:             selectionBubble.selectedText,
      relativeFilePath: relativeFilePath,
      pageNumber:       selectionBubble.pageNum,
      color:            activeColor,
      note:             "",
      createdAt:        new Date().toISOString(),
    });
    setRightPanelTab("citas");
    window.getSelection()?.removeAllRanges();
    setSelectionBubble(null);
  }, [selectionBubble, relativeFilePath, activeColor, addCita, setRightPanelTab]);

  // ── Guard states ──────────────────────────────────────────────────────────

  if (!file) {
    return (
      <EmptyState
        icon={<IconFileAlert size={44} strokeWidth={1} className="opacity-30" />}
        message="Selecciona un archivo PDF"
        sub="Haz clic en un PDF del explorador"
      />
    );
  }

  if (file.type !== "pdf") {
    return (
      <EmptyState
        icon={<IconFileAlert size={44} strokeWidth={1} className="opacity-30" />}
        message="Archivo no compatible"
        sub={`El visor soporta únicamente PDFs — ${file.name}`}
      />
    );
  }

  const isAnnotating = annotationMode === "pen";
  const isErasing    = annotationMode === "erase";

  return (
    <div ref={viewerContainerRef} className="flex h-full flex-col overflow-hidden">
      <style>{`
        @keyframes pageFlash {
          0%   { opacity: 0.55; }
          45%  { opacity: 0.55; }
          100% { opacity: 0; }
        }
        @keyframes annotFlash {
          0%   { opacity: 1; }
          30%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-1 border-b bg-background px-2 py-1">
        {/* Thumbnail toggle */}
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          onClick={() => setShowThumbs((v) => !v)}
          title={showThumbs ? "Ocultar miniaturas" : "Mostrar miniaturas"}
        >
          {showThumbs
            ? <IconLayoutSidebarLeftCollapse size={13} />
            : <IconLayoutSidebarLeftExpand  size={13} />}
        </Button>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* File name */}
        <span className="mr-1 max-w-[120px] truncate text-xs text-muted-foreground" title={file.name}>
          {file.name}
        </span>

        {/* Doc status button */}
        {relativeFilePath && docStatusLoaded && (
          <DocStatusButton relativeFilePath={relativeFilePath} />
        )}

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Page input */}
        <input
          type="text"
          value={pageInputValue}
          onChange={(e) => { isEditingPageRef.current = true; setPageInputValue(e.target.value); }}
          onFocus={(e) => { isEditingPageRef.current = true; e.target.select(); }}
          onBlur={() => { isEditingPageRef.current = false; setPageInputValue(String(currentPage)); }}
          onKeyDown={handlePageInputKeyDown}
          className={cn(
            "h-5 w-8 rounded border border-transparent bg-transparent text-center text-xs tabular-nums",
            "text-muted-foreground hover:border-border focus:border-border focus:outline-none",
          )}
          title="Ir a página (Enter para confirmar)"
        />
        <span className="text-xs text-muted-foreground/60">/ {numPages > 0 ? numPages : "—"}</span>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Zoom */}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomOut} title="Reducir zoom (-)">
          <IconZoomOut size={13} />
        </Button>
        <button
          onClick={fitPage}
          className="min-w-[42px] rounded px-1 text-center text-xs tabular-nums text-muted-foreground hover:bg-accent"
          title="Restablecer zoom (0)"
        >
          {Math.round(scale * 100)}%
        </button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={zoomIn} title="Ampliar zoom (+)">
          <IconZoomIn size={13} />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fitPage} title="Zoom 100% (0)">
          <IconMaximize size={13} />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Rotation */}
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={rotateLeft} title="Rotar a la izquierda">
          <IconRotate size={13} />
        </Button>
        <button
          onClick={() => file && setPageRotation(file.path, 0)}
          className="min-w-[32px] rounded px-1 text-center text-xs tabular-nums text-muted-foreground hover:bg-accent"
          title="Restablecer rotación"
        >
          {rotation}°
        </button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={rotateRight} title="Rotar a la derecha">
          <IconRotateClockwise size={13} />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Undo / redo */}
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          onClick={undo}
          disabled={undoStack.length === 0}
          title="Deshacer (Ctrl+Z)"
        >
          <IconArrowBackUp size={13} />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-6 w-6"
          onClick={redo}
          disabled={redoStack.length === 0}
          title="Rehacer (Ctrl+Y)"
        >
          <IconArrowForwardUp size={13} />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-4" />

        {/* Normal / pointer mode */}
        <Button
          variant={annotationMode === null ? "secondary" : "ghost"}
          size="icon"
          className="h-6 w-6"
          onClick={() => setAnnotationMode(null)}
          title="Modo normal — selección (cursor)"
        >
          <IconPointer size={13} />
        </Button>

        {/* Pen mode */}
        <Button
          variant={isAnnotating ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-6 w-6",
            isAnnotating && "bg-amber-500 hover:bg-amber-600 text-white dark:text-white",
          )}
          onClick={() => setAnnotationMode(isAnnotating ? null : "pen")}
          title={isAnnotating ? "Salir del modo lápiz (Esc / P)" : "Modo lápiz — dibujar anotación (P)"}
        >
          <IconPencil size={13} />
        </Button>

        {/* Erase mode */}
        <Button
          variant={isErasing ? "default" : "ghost"}
          size="icon"
          className={cn(
            "h-6 w-6",
            isErasing && "bg-red-500 hover:bg-red-600 text-white dark:text-white",
          )}
          onClick={() => setAnnotationMode(isErasing ? null : "erase")}
          title={isErasing ? "Salir del modo borrador (Esc / E)" : "Borrador — clic en trazo para eliminar (E)"}
        >
          <IconEraser size={13} />
        </Button>

        {/* Color picker (only visible when pen is active) */}
        {isAnnotating && (
          <div className="flex items-center gap-1 pl-1">
            {(["yellow", "green", "red", "blue"] as AnnotationColor[]).map((c) => (
              <button
                key={c}
                onClick={() => setActiveColor(c)}
                className={cn(
                  "h-3.5 w-3.5 rounded-full transition-all",
                  COLOR_DOT[c],
                  activeColor === c
                    ? "ring-2 ring-primary ring-offset-1 scale-110"
                    : "opacity-60 hover:opacity-100",
                )}
                title={c}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selection bubble (position: fixed — outside scroll area) */}
      {selectionBubble && (
        <SelectionBubble
          state={selectionBubble}
          relativeFilePath={relativeFilePath}
          activeColor={activeColor}
          onHighlight={handleHighlightFromBubble}
          onAddToCitas={handleAddToCitas}
        />
      )}

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {loading && (
          <div className="flex flex-1 items-center justify-center">
            <LoadingState />
          </div>
        )}

        {!loading && loadError && (
          <div className="flex flex-1 items-center justify-center">
            <ErrorState message={loadError} path={file.path} />
          </div>
        )}

        {!loading && !loadError && pdfSrc && (
          <Document
            file={pdfSrc}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex flex-1 items-center justify-center">
                <LoadingState />
              </div>
            }
            error={
              <div className="flex flex-1 items-center justify-center">
                <ErrorState path={file.path} />
              </div>
            }
            className="flex min-h-0 flex-1 overflow-hidden"
          >
            {/* ── Thumbnail panel ─────────────────────────────────────── */}
            {showThumbs && numPages > 0 && (
              <div className="flex w-[112px] shrink-0 flex-col overflow-y-auto border-r bg-muted/20 py-2">
                {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <div
                    key={pageNum}
                    ref={makeThumbRef(pageNum)}
                    onClick={() => scrollToPage(pageNum)}
                    className={cn(
                      "mx-auto mb-2 cursor-pointer rounded-sm ring-offset-background transition-all",
                      currentPage === pageNum
                        ? "ring-2 ring-primary ring-offset-1"
                        : "opacity-70 hover:opacity-100",
                    )}
                    title={`Página ${pageNum}`}
                  >
                    <Page
                      pageNumber={pageNum}
                      width={88}
                      rotate={rotation}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      loading={
                        <div style={{ width: 88, height: 124 }} className="rounded bg-muted/40" />
                      }
                    />
                    <p className="mt-0.5 text-center text-[9px] text-muted-foreground">{pageNum}</p>
                  </div>
                ))}
              </div>
            )}

            {/* ── Main scroll area ────────────────────────────────────── */}
            <div
              ref={mainScrollRef}
              className={cn(
                "flex-1 overflow-y-auto bg-zinc-100 dark:bg-zinc-900",
                isAnnotating && "cursor-crosshair",
                isErasing    && "cursor-default",
              )}
              onMouseDown={() => setSelectionBubble(null)}
            >
              <div className="flex flex-col items-center gap-4 py-4">
                {numPages > 0 &&
                  Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                    const pageAnnotations = relativeFilePath
                      ? annotations.filter(
                          (a) =>
                            a.relativeFilePath === relativeFilePath &&
                            a.pageNumber === pageNum,
                        )
                      : [];

                    const intrinsic = pageIntrinsics[pageNum] ?? { w: 595, h: 842 };

                    // Display dimensions at current (visual) scale
                    const pageW = rotation === 90 || rotation === 270
                      ? intrinsic.h * scale
                      : intrinsic.w * scale;
                    const pageH = rotation === 90 || rotation === 270
                      ? intrinsic.w * scale
                      : intrinsic.h * scale;

                    // Rendered dimensions at the debounced scale
                    const renderPageW = rotation === 90 || rotation === 270
                      ? intrinsic.h * renderScale
                      : intrinsic.w * renderScale;
                    const renderPageH = rotation === 90 || rotation === 270
                      ? intrinsic.w * renderScale
                      : intrinsic.h * renderScale;

                    // CSS scale factor: stretches renderScale content to fill displayScale area
                    const cssScaleFactor = renderScale > 0 ? scale / renderScale : 1;

                    return (
                      <div
                        key={pageNum}
                        ref={makePageRef(pageNum)}
                        data-page={pageNum}
                        className="relative shadow-lg"
                        style={{ width: pageW, height: pageH }}
                        onMouseUp={(e) => handlePageMouseUp(e, pageNum)}
                      >
                        {/*
                          Inner wrapper: rendered at renderScale, CSS-scaled to displayScale.
                          This means the PDF canvas is never blank during rapid zoom —
                          the old render stays visible (just blurry) until the new render completes.
                        */}
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: renderPageW,
                            height: renderPageH,
                            transform: `scale(${cssScaleFactor})`,
                            transformOrigin: "top left",
                          }}
                        >
                          <Page
                            pageNumber={pageNum}
                            scale={renderScale}
                            rotate={rotation}
                            renderTextLayer
                            renderAnnotationLayer
                            onRenderSuccess={({ originalWidth, originalHeight }) => {
                              setPageIntrinsics((prev) => ({
                                ...prev,
                                [pageNum]: { w: originalWidth, h: originalHeight },
                              }));
                            }}
                            loading={
                              <div
                                style={{
                                  width:  Math.round(intrinsic.w * renderScale),
                                  height: Math.round(intrinsic.h * renderScale),
                                }}
                                className="flex items-center justify-center rounded bg-white dark:bg-zinc-800"
                              >
                                <IconLoader2 size={16} className="animate-spin text-muted-foreground/40" />
                              </div>
                            }
                          />
                        </div>

                        {/*
                          Annotation overlay lives at display scale (outside the CSS transform).
                          This keeps drawing coordinates correct regardless of renderScale.
                        */}
                        <AnnotationOverlay
                          pageNumber={pageNum}
                          scale={scale}
                          rotation={rotation}
                          intrinsicWidth={intrinsic.w}
                          intrinsicHeight={intrinsic.h}
                          annotationMode={annotationMode}
                          activeColor={activeColor}
                          annotations={pageAnnotations}
                          flashingAnnotationId={flashingAnnotationId}
                          onCreated={(path, endX, endY) =>
                            handleAnnotationCreated(pageNum, path, endX, endY)
                          }
                          onAnnotationClick={handleAnnotationClick}
                          onAnnotationDelete={handleAnnotationDelete}
                        />

                        {/* Page-level flash overlay */}
                        {flashingPageNum === pageNum && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              zIndex: 25,
                              pointerEvents: "none",
                              background: "rgba(245,158,11,0.3)",
                              animation: "pageFlash 2s ease-out forwards",
                            }}
                          />
                        )}

                        {/* Note popup — appears after drawing, positioned within this page div */}
                        {notePopup?.pageNum === pageNum && (
                          <NotePopup
                            state={notePopup}
                            pageWidth={pageW}
                            pageHeight={pageH}
                            onClose={() => setNotePopup(null)}
                          />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ icon, message, sub }: { icon: React.ReactNode; message: string; sub: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
      {icon}
      <p className="text-sm font-medium">{message}</p>
      <p className="text-xs opacity-60">{sub}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground">
      <IconLoader2 size={18} className="animate-spin" />
      <span className="text-sm">Cargando PDF…</span>
    </div>
  );
}

function ErrorState({ message, path }: { message?: string; path?: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
      <IconFileAlert size={32} strokeWidth={1} className="text-amber-500/70" />
      <span className="text-sm">{message ?? "Error al cargar el PDF"}</span>
      {path && (
        <span className="max-w-xs break-all text-center text-[10px] opacity-50">{path}</span>
      )}
    </div>
  );
}
