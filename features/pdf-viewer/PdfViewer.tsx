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
  IconEye,
  IconFocusCentered,
  IconEyeOff,
  IconSunHigh,
  IconSearch,
  IconChevronUp,
  IconChevronDown,
  IconX,
  IconLayoutGrid,
  IconLayoutColumns,
  IconLink,
  IconLinkOff,
  IconBookmark,
  IconBookmarkFilled,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { FileNode } from "@/types/expediente";
import type { AnnotationColor, NormalizedPoint, NormalizedRect } from "@/types/anotaciones";
import { CITA_DRAG_TYPE, type CitaDragPayload } from "@/types/citas";
import { useIsElectron } from "@/hooks/useIsElectron";
import { useEditorStore } from "@/state/editor.store";
import { useExplorerStore } from "@/state/explorer.store";
import { useRevisionStore } from "@/state/revision.store";
import { useAnotacionesStore } from "@/state/anotaciones.store";
import { useCitasStore } from "@/state/citas.store";
import { useDocStatusStore } from "@/state/docStatus.store";
import { useBookmarksStore } from "@/state/bookmarks.store";
import { useWorkbenchStore } from "@/state/workbench.store";
import { useUXStore } from "@/state/ux.store";
import { AnnotationOverlay, toCanonicalRect, toRotatedRect } from "@/features/annotations/AnnotationOverlay";
import { DocStatusButton } from "@/features/pdf-viewer/DocStatusButton";
import { PdfMinimap } from "@/features/pdf-viewer/PdfMinimap";
import { ExpedienteDashboard } from "@/features/expediente/ExpedienteDashboard";
import { cn } from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// ─── Constants ────────────────────────────────────────────────────────────────

/** Pages rendered around the current visible page. Pages outside this window
 *  are replaced with a same-sized placeholder, keeping scroll geometry intact
 *  while eliminating hundreds of canvas elements for large PDFs. */
const RENDER_WINDOW = 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLOR_DOT: Record<AnnotationColor, string> = {
  yellow: "bg-amber-400",
  green:  "bg-green-500",
  red:    "bg-red-500",
  blue:   "bg-blue-500",
};

const CITA_FILL: Record<AnnotationColor, string> = {
  yellow: "rgba(245,158,11,0.30)",
  green:  "rgba(34,197,94,0.30)",
  red:    "rgba(239,68,68,0.30)",
  blue:   "rgba(59,130,246,0.30)",
};

function computeRelativeFilePath(filePath: string, expedientePath: string): string {
  const fwd    = filePath.replace(/\\/g, "/");
  const expFwd = expedientePath.replace(/\\/g, "/").replace(/\/$/, "");
  // Case-insensitive startsWith (Windows paths can differ in case)
  if (fwd.toLowerCase().startsWith(expFwd.toLowerCase() + "/")) return fwd.slice(expFwd.length);
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
  const updateAnnotationText = useAnotacionesStore((s) => s.updateAnnotationText);
  // Read initial text once — local state owns the textarea from here on.
  // Flushing to store only on blur/close prevents per-keystroke store updates
  // (which caused PdfViewer + all pages to re-render on every character typed).
  const initialText = useAnotacionesStore((s) => s.annotations.find((a) => a.id === state.annotationId)?.text ?? "");
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => textareaRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const flush = (value: string) => updateAnnotationText(state.annotationId, value);

  const handleClose = (value: string) => {
    flush(value);
    onClose();
  };

  // Position popup to the bottom-right of the stroke endpoint, clamped to page bounds
  const POPUP_W = 200;
  const POPUP_H = 136;
  const OFFSET  = 14;
  const left = Math.min(Math.max(state.x + OFFSET, 4), pageWidth  - POPUP_W - 4);
  const top  = Math.min(Math.max(state.y + OFFSET, 4), pageHeight - POPUP_H - 4);

  return (
    <div
      style={{ position: "absolute", left, top, width: POPUP_W, zIndex: 30 }}
      className="rounded-xl border border-border/60 bg-background/85 backdrop-blur-2xl shadow-2xl animate-in zoom-in-95 duration-150 ease-out overflow-hidden"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-2.5 py-1">
        <span className="text-[10px] font-medium text-muted-foreground">Añadir nota</span>
        <button
          onClick={() => handleClose(text)}
          className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
          title="Cerrar (Esc)"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Textarea — controlled by local state only; store updated on blur/close */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => flush(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") { handleClose(text); }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { handleClose(text); }
          e.stopPropagation();
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
          onClick={() => handleClose(text)}
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
  state:            SelectionBubbleState;
  relativeFilePath: string | null;
  activeColor:      AnnotationColor;
  onHighlight:      (color: AnnotationColor) => void;
  onAddToCitas:     () => void;
  onDismiss:        () => void;
}

function SelectionBubble({
  state,
  relativeFilePath,
  activeColor,
  onHighlight,
  onAddToCitas,
  onDismiss,
}: SelectionBubbleProps) {
  const BUBBLE_W = 148; // 4×color + sep + quote + sep + drag handle
  const BUBBLE_H = 32;
  const OFFSET   = 6;
  const left = Math.min(Math.max(state.viewportX + OFFSET, 8), window.innerWidth  - BUBBLE_W - 8);
  const top  = Math.min(Math.max(state.viewportY + OFFSET, 8), window.innerHeight - BUBBLE_H - 8);

  const handleDragStart = (e: React.DragEvent) => {
    // Clear text selection FIRST — prevents the browser from trying to drag
    // the PDF's selected text instead of our custom payload.
    window.getSelection()?.removeAllRanges();

    const payload: CitaDragPayload = {
      text:             state.selectedText,
      relativeFilePath: relativeFilePath,
      pageNumber:       state.pageNum,
      color:            activeColor,
      normalizedRects:  state.normalizedRects,
    };
    e.dataTransfer.setData(CITA_DRAG_TYPE, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
    // NOTE: do NOT unmount here — removing the drag source from the DOM
    // while the drag is active cancels the operation in Chromium/Electron.
    // Dismissal happens in onDragEnd instead.
  };

  const handleDragEnd = () => {
    // Fires whether the drop succeeded or the user cancelled (Escape / released outside).
    onDismiss();
  };

  return (
    <div
      style={{ position: "fixed", left, top, zIndex: 9000 }}
      className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/85 backdrop-blur-2xl px-2.5 py-2 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out"
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
      <div className="mx-0.5 h-4 w-px bg-border" />
      {/* Drag handle — drag onto a note / Citas panel / other PDF pane */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="cursor-grab rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-primary active:cursor-grabbing"
        title="Arrastra hacia una nota o al panel de Citas para crear una cita vinculada"
      >
        <IconLink size={13} />
      </div>
    </div>
  );
}

// ─── PdfViewer ────────────────────────────────────────────────────────────────

interface PdfViewerProps {
  file: FileNode | null;
  /** True when this viewer is the right pane of a split layout */
  isSplitPane?: boolean;
  /** Called when the user closes the split pane */
  onCloseSplit?: () => void;
  /** Which logical pane this viewer occupies — used for focused navigation */
  paneId?: "left" | "right";
}

export function PdfViewer({ file, isSplitPane = false, onCloseSplit, paneId = "left" }: PdfViewerProps) {
  const inElectron        = useIsElectron();
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  
  // UX/Health Settings
  const { privacyBlur, zenMode, setZenMode, lighthouseMode } = useUXStore();

  const lighthouseOverlayRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!lighthouseMode || !lighthouseOverlayRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    lighthouseOverlayRef.current.style.top = `${y - 30}px`;
  }, [lighthouseMode]);

  const root = useExplorerStore((s) => s.root);

  const [numPages, setNumPages]             = useState(0);
  const [currentPage, setCurrentPage]       = useState(1);
  const [scale, setScale]                   = useState(1.0);
  const [renderScale, setRenderScale]       = useState(1.0);

  // ── Split view, gallery & sync scroll ────────────────────────────────────
  const { setSplitFile, registerScrollEl, registerPaneActions, setPaneState } = useWorkbenchStore();
  const [galleryMode, setGalleryMode] = useState(false);

  // ── PDF text search ───────────────────────────────────────────────────────
  const [showSearch, setShowSearch]                 = useState(false);
  const [searchQuery, setSearchQuery]               = useState("");
  const [searchMatchPages, setSearchMatchPages]     = useState<number[]>([]);
  const [searchMatchCounts, setSearchMatchCounts]   = useState<Record<number, number>>({});
  const [searchCurrentPageIdx, setSearchCurrentPageIdx] = useState(0);
  const pdfProxyRef  = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renderScaleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showThumbs, setShowThumbs]         = useState(true);
  const [isFocused, setIsFocused]           = useState(true);
  const [notePopup, setNotePopup]           = useState<NotePopupState | null>(null);

  // Track window focus for "Privacy/Mental Health" blur (only if enabled)
  useEffect(() => {
    if (!privacyBlur) {
      setIsFocused(true);
      return;
    }
    const onFocus = () => setIsFocused(true);
    const onBlur  = () => setIsFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur",  onBlur);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur",  onBlur);
    };
  }, [privacyBlur]);

  // Keyboard shortcut for ZEN MODE (Alt + Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle with Alt+Z
      if (e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setZenMode(!zenMode);
      }
      // Exit with Esc
      if (e.key === 'Escape' && zenMode) {
        setZenMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zenMode, setZenMode]);

  const [selectionBubble, setSelectionBubble] = useState<SelectionBubbleState | null>(null);

  /**
   * Per-page drop overlay refs — manipulated SYNCHRONOUSLY via native window
   * dragstart/dragend so pointer-events flip before the first dragover fires.
   * (React setState is async and would lose the race against Chromium's drop check.)
   */
  const dropOverlayRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

  useEffect(() => {
    const setOverlays = (pe: "all" | "none") => {
      dropOverlayRefs.current.forEach((div) => {
        if (div) div.style.pointerEvents = pe;
      });
    };
    const onStart = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes(CITA_DRAG_TYPE)) setOverlays("all");
    };
    const onEnd = () => setOverlays("none");
    window.addEventListener("dragstart", onStart);
    window.addEventListener("dragend",   onEnd);
    window.addEventListener("drop",      onEnd);
    return () => {
      window.removeEventListener("dragstart", onStart);
      window.removeEventListener("dragend",   onEnd);
      window.removeEventListener("drop",      onEnd);
    };
  }, []);

  // Blob URL for the current PDF
  const [pdfSrc, setPdfSrc]       = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Per-page rotation (view-only, not saved to disk)
  const { pageRotations, setPageRotation } = useEditorStore();
  
  const getPageRotation = useCallback((pageNum: number) => {
    if (!file) return 0;
    const key = `${file.path}:${pageNum}`;
    return (pageRotations[key] ?? 0) as 0 | 90 | 180 | 270;
  }, [file, pageRotations]);

  const rotation = getPageRotation(currentPage); // For toolbar display

  const rotateLeft  = () => file && setPageRotation(`${file.path}:${currentPage}`, rotation - 90);
  const rotateRight = () => file && setPageRotation(`${file.path}:${currentPage}`, rotation + 90);
  const resetRotation = () => file && setPageRotation(`${file.path}:${currentPage}`, 0);

  // Refs for scroll-based page tracking
  const mainScrollRef   = useRef<HTMLDivElement>(null);
  const pageRefsMap     = useRef<Map<number, HTMLDivElement>>(new Map());
  const thumbRefsMap    = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef     = useRef<IntersectionObserver | null>(null);
  const ignoreScrollRef  = useRef(false);
  const isEditingPageRef = useRef(false);
  // Prevents echo-loop: true while this pane's scrollTop is being set by the other pane
  const receivingSyncRef = useRef(false);

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
    undo,
    redo,
    undoStack,
    redoStack,
  } = useAnotacionesStore();

  // Flash states (local — not persisted)
  const [flashingAnnotationId, setFlashingAnnotationId] = useState<string | null>(null);
  const [flashingPageNum, setFlashingPageNum]           = useState<number | null>(null);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Citas store (for adding quotes from text selection + backward badges)
  const { addCita, citas } = useCitasStore();
  // Bookmarks store
  const { bookmarks, toggleBookmark } = useBookmarksStore();
  // Doc status store — loaded flag for toolbar button
  const { isLoaded: docStatusLoaded } = useDocStatusStore();
  const { setRightPanelTab, setFocusedPane, splitFile } = useWorkbenchStore();

  // Revision meta for building relative file paths.
  // Use expedientePath directly — it's set even when meta is null (outside clientesFolder).
  const expedientePath = useRevisionStore((s) => s.expedientePath);

  const relativeFilePath = useMemo(() => {
    if (!file) return null;
    if (expedientePath) return computeRelativeFilePath(file.path, expedientePath);
    return `/${file.name}`;
  }, [file, expedientePath]);

  // Pre-bucket annotations and citas by page — avoids O(annotations × pages) filter in render loop
  const annotationsByPage = useMemo(() => {
    const map: Record<number, typeof annotations> = {};
    if (!relativeFilePath) return map;
    for (const ann of annotations) {
      if (ann.relativeFilePath === relativeFilePath && ann.pageNumber != null) {
        (map[ann.pageNumber] ??= []).push(ann);
      }
    }
    return map;
  }, [annotations, relativeFilePath]);

  const citasByPage = useMemo(() => {
    const map: Record<number, typeof citas> = {};
    if (!relativeFilePath) return map;
    for (const cita of citas) {
      if (cita.relativeFilePath === relativeFilePath && cita.pageNumber != null) {
        (map[cita.pageNumber] ??= []).push(cita);
      }
      if (cita.targetRelativeFilePath === relativeFilePath && cita.targetPageNumber != null) {
        const p = cita.targetPageNumber;
        const arr = (map[p] ??= []);
        if (!arr.find((c) => c.id === cita.id)) arr.push(cita);
      }
    }
    return map;
  }, [citas, relativeFilePath]);

  // Set of bookmarked page numbers for current file — O(1) lookup in render loop
  const bookmarkedPages = useMemo(() => {
    const set = new Set<number>();
    if (!relativeFilePath) return set;
    for (const bm of bookmarks) {
      if (bm.relativeFilePath === relativeFilePath) set.add(bm.pageNumber);
    }
    return set;
  }, [bookmarks, relativeFilePath]);

  // ── Debounce renderScale behind scale to avoid per-keystroke canvas redraws ──
  useEffect(() => {
    if (renderScaleTimerRef.current) clearTimeout(renderScaleTimerRef.current);
    renderScaleTimerRef.current = setTimeout(() => setRenderScale(scale), 250);
  }, [scale]);


  // ── Load PDF via IPC → Blob URL ──────────────────────────────────────────
  useEffect(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setPdfSrc(null);
    setNumPages(0);
    setCurrentPage(1);
    setScale(1.0);
    setRenderScale(1.0);
    setLoadError(null);
    setPageIntrinsics({});
    setNotePopup(null);
    setSelectionBubble(null);
    setShowSearch(false);
    setSearchQuery("");
    setSearchMatchPages([]);
    setSearchMatchCounts({});
    setSearchCurrentPageIdx(0);
    setGalleryMode(false);
    pdfProxyRef.current = null;

    // Default exit zen mode if reading a new PDF
    setZenMode(false);

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
    // If navigation was targeted at a specific pane, ignore if we're the other one
    if (pendingNavigation.targetPane && pendingNavigation.targetPane !== paneId) return;
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

  // ── Sync scroll: register this pane's scroll container ───────────────────
  useEffect(() => {
    registerScrollEl(paneId, mainScrollRef.current);
    return () => registerScrollEl(paneId, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId, numPages]); // re-register after PDF loads so the element ref is fresh

  // ── Sync scroll: direct DOM listener — reads store state fresh to avoid stale closures ──
  useEffect(() => {
    const container = mainScrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { syncScroll, _scrollEls } = useWorkbenchStore.getState();
      if (!syncScroll) return;
      if ((container as any).__receivingSync) return;

      const otherEl = _scrollEls[paneId === "left" ? "right" : "left"];
      if (!otherEl) return;

      const maxSrc = container.scrollHeight - container.clientHeight;
      if (maxSrc <= 0) return;
      const ratio = container.scrollTop / maxSrc;
      const maxDst = otherEl.scrollHeight - otherEl.clientHeight;

      (otherEl as any).__receivingSync = true;
      otherEl.scrollTop = ratio * maxDst;
      requestAnimationFrame(() => { (otherEl as any).__receivingSync = false; });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId, numPages]); // re-attach when PDF content changes

  // ── Pane state sync → store (toolbar reads from here) ────────────────────
  useEffect(() => {
    setPaneState(paneId, {
      file: file ?? null,
      currentPage,
      numPages,
      scale,
      rotation,
      galleryMode,
      showSearch,
      showThumbs,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId, file, currentPage, numPages, scale, rotation, galleryMode, showSearch, showThumbs]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";

      // Escape: close search bar first, then bubble/popup, then exit mode
      if (e.key === "Escape") {
        if (showSearch) { setShowSearch(false); setSearchQuery(""); setSearchMatchPages([]); setSearchMatchCounts({}); setSearchCurrentPageIdx(0); return; }
        if (selectionBubble) { setSelectionBubble(null); window.getSelection()?.removeAllRanges(); return; }
        if (notePopup) { setNotePopup(null); return; }
        if (annotationMode) { setAnnotationMode(null); return; }
        setZenMode(false);
        return;
      }

      // Ctrl+F → toggle search bar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowSearch((v) => {
          if (!v) setTimeout(() => searchInputRef.current?.focus(), 50);
          return !v;
        });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotationMode, notePopup, selectionBubble, showSearch, undo, redo, setAnnotationMode]);

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

  const onDocumentLoadSuccess = useCallback((pdf: any) => {
    pdfProxyRef.current = pdf;
    setNumPages(pdf.numPages);
    setCurrentPage(1);
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
    thumbRefsMap.current.get(page)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setTimeout(() => { ignoreScrollRef.current = false; }, 600);
  }, []);

  // ── Pane action registry → store (toolbar calls these) ───────────────────
  // Must be after scrollToPage declaration
  useEffect(() => {
    registerPaneActions(paneId, {
      goToPage:          (p) => { if (p >= 1 && p <= numPages) scrollToPage(p); },
      zoomIn:            () => setScale((s) => Math.min(s + 0.15, 5)),
      zoomOut:           () => setScale((s) => Math.max(s - 0.15, 0.25)),
      fitPage:           () => setScale(1.0),
      rotateLeft:        () => file && setPageRotation(`${file.path}:${currentPage}`, rotation - 90),
      rotateRight:       () => file && setPageRotation(`${file.path}:${currentPage}`, rotation + 90),
      resetRotation:     () => file && setPageRotation(`${file.path}:${currentPage}`, 0),
      toggleGallery:     () => setGalleryMode((v) => !v),
      toggleSearch:      () => setShowSearch((v) => { if (!v) setTimeout(() => searchInputRef.current?.focus(), 50); return !v; }),
      toggleThumbs:      () => setShowThumbs((v) => !v),
      toggleReadingMode: () => useUXStore.getState().setReadingMode(!useUXStore.getState().readingMode),
      openInSplit:       () => file && setSplitFile(file),
    });
    return () => registerPaneActions(paneId, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paneId, currentPage, numPages, rotation, file?.path, scrollToPage]);

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

  // ── Search: compute matches asynchronously when query or pages change ────────
  useEffect(() => {
    if (!searchQuery.trim() || !pdfProxyRef.current || numPages === 0) {
      setSearchMatchPages([]);
      setSearchMatchCounts({});
      setSearchCurrentPageIdx(0);
      return;
    }
    let cancelled = false;
    const query = searchQuery.toLowerCase();
    const proxy = pdfProxyRef.current;
    (async () => {
      const counts: Record<number, number> = {};
      for (let p = 1; p <= numPages; p++) {
        if (cancelled) return;
        try {
          const page    = await proxy.getPage(p);
          const content = await page.getTextContent();
          const text    = (content.items as any[])
            .map((item) => item.str ?? "")
            .join(" ")
            .toLowerCase();
          let count = 0;
          let idx   = 0;
          while ((idx = text.indexOf(query, idx)) !== -1) { count++; idx += query.length; }
          if (count > 0) counts[p] = count;
        } catch { /* ignore page errors */ }
      }
      if (cancelled) return;
      const pages = Object.keys(counts).map(Number).sort((a, b) => a - b);
      setSearchMatchCounts(counts);
      setSearchMatchPages(pages);
      setSearchCurrentPageIdx(0);
      if (pages.length > 0) scrollToPage(pages[0]);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, numPages]);

  const goToNextMatch = useCallback(() => {
    if (!searchMatchPages.length) return;
    const next = (searchCurrentPageIdx + 1) % searchMatchPages.length;
    setSearchCurrentPageIdx(next);
    scrollToPage(searchMatchPages[next]);
  }, [searchMatchPages, searchCurrentPageIdx, scrollToPage]);

  const goToPrevMatch = useCallback(() => {
    if (!searchMatchPages.length) return;
    const prev = (searchCurrentPageIdx - 1 + searchMatchPages.length) % searchMatchPages.length;
    setSearchCurrentPageIdx(prev);
    scrollToPage(searchMatchPages[prev]);
  }, [searchMatchPages, searchCurrentPageIdx, scrollToPage]);

  // Memoised text renderer — only recreated when query changes
  const customTextRenderer = useMemo(() => {
    if (!searchQuery.trim()) return undefined;
    return ({ str }: { str: string }) => {
      if (!str) return str;
      try {
        const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return str.replace(
          new RegExp(`(${escaped})`, "gi"),
          '<mark class="pdf-search-mark">$1</mark>',
        );
      } catch {
        return str;
      }
    };
  }, [searchQuery]);

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
      const rotation   = getPageRotation(pageNum);

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
  }, [annotationMode, pageIntrinsics, scale, getPageRotation]);

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
      rects:            selectionBubble.normalizedRects,
    });
    setRightPanelTab("citas");
    window.getSelection()?.removeAllRanges();
    setSelectionBubble(null);
  }, [selectionBubble, relativeFilePath, activeColor, addCita, setRightPanelTab]);

  // ── Guard states ──────────────────────────────────────────────────────────

  if (!file) {
    if (root) return <ExpedienteDashboard />;
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
    <div 
      ref={viewerContainerRef} 
      className={cn(
        "flex h-full flex-col overflow-hidden transition-all duration-500", 
        zenMode ? "fixed inset-0 z-[9999] bg-background" : "relative",
        !isFocused && "blur-[8px] grayscale-[0.5] opacity-40 scale-[0.99] pointer-events-none"
      )}
    >
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
        .pdf-search-mark {
          background: rgba(245,158,11,0.45);
          color: inherit;
          border-radius: 2px;
          padding: 0 1px;
        }
      `}</style>

      {lighthouseMode && (
        <div
          ref={lighthouseOverlayRef}
          className="pointer-events-none absolute left-0 right-0 z-[50] backdrop-brightness-[1.1] backdrop-contrast-[1.1]"
          style={{
            top: '-30px',
            height: '60px',
            background: 'linear-gradient(to bottom, transparent, rgba(59, 130, 246, 0.05), transparent)',
            borderTop: '1px solid rgba(59, 130, 246, 0.1)',
            borderBottom: '1px solid rgba(59, 130, 246, 0.1)',
            boxShadow: '0 0 100px rgba(59, 130, 246, 0.05)'
          }}
        />
      )}

      {!isFocused && (
        <div className="absolute inset-0 z-[10000] flex flex-col items-center justify-center bg-background/20 backdrop-blur-sm">
          <IconEyeOff size={48} className="text-muted-foreground/20 animate-pulse" />
          <p className="mt-4 text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground/40">Pausado por salud mental</p>
        </div>
      )}

      {/* ── Search bar ────────────────────────────────────────────────────── */}
      {showSearch && (
        <div className="flex shrink-0 items-center gap-1.5 border-b bg-muted/10 px-2 py-1.5 animate-in slide-in-from-top-2 duration-200">
          <IconSearch size={12} className="shrink-0 text-muted-foreground/60" />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); goToNextMatch(); }
              if (e.key === "Escape") { setShowSearch(false); setSearchQuery(""); setSearchMatchPages([]); setSearchMatchCounts({}); setSearchCurrentPageIdx(0); }
              e.stopPropagation();
            }}
            placeholder="Buscar en el documento… (Ctrl+F)"
            className="flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/30"
          />
          {searchQuery.trim() && (
            <span className={cn(
              "whitespace-nowrap text-[10px] tabular-nums",
              searchMatchPages.length === 0 ? "text-red-500/70" : "text-muted-foreground/60",
            )}>
              {searchMatchPages.length === 0
                ? "Sin resultados"
                : `${searchCurrentPageIdx + 1} / ${searchMatchPages.length} pág.`}
            </span>
          )}
          <button
            onClick={goToPrevMatch}
            disabled={searchMatchPages.length === 0}
            className="rounded p-0.5 text-muted-foreground/50 hover:bg-accent hover:text-foreground disabled:opacity-30"
            title="Resultado anterior"
          >
            <IconChevronUp size={13} />
          </button>
          <button
            onClick={goToNextMatch}
            disabled={searchMatchPages.length === 0}
            className="rounded p-0.5 text-muted-foreground/50 hover:bg-accent hover:text-foreground disabled:opacity-30"
            title="Resultado siguiente (Enter)"
          >
            <IconChevronDown size={13} />
          </button>
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchMatchPages([]); setSearchMatchCounts({}); setSearchCurrentPageIdx(0); }}
            className="rounded p-0.5 text-muted-foreground/50 hover:bg-accent hover:text-foreground"
            title="Cerrar búsqueda (Esc)"
          >
            <IconX size={13} />
          </button>
        </div>
      )}

      {/* Selection bubble (position: fixed — outside scroll area) */}
      {selectionBubble && (
        <SelectionBubble
          state={selectionBubble}
          relativeFilePath={relativeFilePath}
          activeColor={activeColor}
          onHighlight={handleHighlightFromBubble}
          onAddToCitas={handleAddToCitas}
          onDismiss={() => { setSelectionBubble(null); window.getSelection()?.removeAllRanges(); }}
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
            {/* ── Gallery view (inside Document so <Page> has context) ─── */}
            {galleryMode && numPages > 0 && (
              <div className="flex-1 overflow-y-auto bg-zinc-100 dark:bg-zinc-900 p-4">
                <div
                  className="grid w-full gap-3"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}
                >
                  {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                    <div
                      key={pageNum}
                      onClick={() => {
                        setGalleryMode(false);
                        setTimeout(() => scrollToPage(pageNum), 80);
                      }}
                      className={cn(
                        "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg p-1.5 transition-all hover:bg-primary/10",
                        currentPage === pageNum && "bg-primary/15 ring-1 ring-primary/40",
                      )}
                      title={`Ir a página ${pageNum}`}
                    >
                      <div className={cn(
                        "overflow-hidden rounded border transition-all duration-300",
                        currentPage === pageNum
                          ? "border-primary/60 shadow-md shadow-primary/10"
                          : "border-border/40",
                      )}>
                        <Page
                          pageNumber={pageNum}
                          width={136}
                          rotate={getPageRotation(pageNum)}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          loading={
                            <div style={{ width: 136, height: 192 }} className="bg-muted/40 animate-pulse rounded" />
                          }
                        />
                      </div>
                      <span className={cn(
                        "text-[10px] tabular-nums",
                        currentPage === pageNum ? "font-bold text-primary" : "text-muted-foreground/60",
                      )}>
                        {pageNum}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Thumbnail panel ─────────────────────────────────────── */}
            {!galleryMode && showThumbs && numPages > 0 && (
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
                    <div className="transition-all duration-500">
                      <Page
                        pageNumber={pageNum}
                        width={88}
                        rotate={getPageRotation(pageNum)}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        loading={
                          <div style={{ width: 88, height: 124 }} className="rounded bg-muted/40" />
                        }
                      />
                    </div>
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
                galleryMode  && "hidden",
              )}
              onMouseDown={() => { setSelectionBubble(null); setFocusedPane(paneId); }}
            >
              <div className="flex flex-col items-center gap-8 py-8 px-4">
                {numPages > 0 &&
                  Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
                    const pageAnnotations = annotationsByPage[pageNum] ?? [];
                    const pageCitas       = citasByPage[pageNum] ?? [];
                    const pageCitaCount   = pageCitas.length;
                    const isBookmarked    = bookmarkedPages.has(pageNum);

                    const intrinsic    = pageIntrinsics[pageNum] ?? { w: 595, h: 842 };
                    const pageRotation = getPageRotation(pageNum);

                    // Display dimensions at current (visual) scale
                    const isLandscape = pageRotation === 90 || pageRotation === 270;
                    const pageW = isLandscape ? intrinsic.h * scale : intrinsic.w * scale;
                    const pageH = isLandscape ? intrinsic.w * scale : intrinsic.h * scale;

                    // Only render heavy content (canvas + overlays) for pages near the viewport.
                    // Outer div always present so scroll geometry and IntersectionObserver stay correct.
                    const isInWindow = Math.abs(pageNum - currentPage) <= RENDER_WINDOW;

                    // Rendered dimensions at the debounced scale (only needed in-window)
                    const renderPageW = isLandscape ? intrinsic.h * renderScale : intrinsic.w * renderScale;
                    const renderPageH = isLandscape ? intrinsic.w * renderScale : intrinsic.h * renderScale;
                    const cssScaleFactor = renderScale > 0 ? scale / renderScale : 1;

                    return (
                      <div
                        key={pageNum}
                        ref={makePageRef(pageNum)}
                        data-page={pageNum}
                        className="group/page relative shadow-[0_4px_24px_0_rgba(0,0,0,0.1)] dark:shadow-[0_4px_24px_0_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.04)] border border-border/10 overflow-hidden"
                        style={{ width: pageW, height: pageH }}
                        onMouseUp={isInWindow ? (e) => handlePageMouseUp(e, pageNum) : undefined}
                      >
                        {isInWindow ? (
                          <>
                            {/* Drop overlay — pointer-events flipped synchronously via dropOverlayRefs on drag start */}
                            <div
                              ref={(el) => {
                                if (el) dropOverlayRefs.current.set(pageNum, el);
                                else dropOverlayRefs.current.delete(pageNum);
                              }}
                              className="absolute inset-0 z-20"
                              style={{ pointerEvents: "none" }}
                              onWheel={(e) => { mainScrollRef.current?.scrollBy({ top: e.deltaY }); }}
                              onDragOver={(e) => { if (e.dataTransfer.types.includes(CITA_DRAG_TYPE)) e.preventDefault(); }}
                              onDrop={(e) => {
                                e.preventDefault();
                                const raw = e.dataTransfer.getData(CITA_DRAG_TYPE);
                                if (!raw) return;
                                const payload = JSON.parse(raw) as CitaDragPayload;
                                if (payload.relativeFilePath === relativeFilePath && payload.pageNumber === pageNum) return;
                                addCita({
                                  id:                     crypto.randomUUID(),
                                  text:                   payload.text,
                                  relativeFilePath:       payload.relativeFilePath,
                                  pageNumber:             payload.pageNumber,
                                  color:                  payload.color,
                                  note:                   "",
                                  createdAt:              new Date().toISOString(),
                                  rects:                  payload.normalizedRects.length > 0 ? payload.normalizedRects : undefined,
                                  targetRelativeFilePath: relativeFilePath ?? undefined,
                                  targetPageNumber:       pageNum,
                                });
                                setRightPanelTab("citas");
                              }}
                            />

                            {/* Bookmark toggle button — visible on hover or when bookmarked */}
                            {relativeFilePath && annotationMode !== "pen" && annotationMode !== "erase" && (
                              <button
                                className={cn(
                                  "absolute top-2 z-30 rounded p-0.5 transition-all duration-300 ease-out",
                                  isBookmarked
                                    ? "left-2 text-amber-500 opacity-100"
                                    : "-left-8 text-muted-foreground/40 opacity-0 group-hover/page:left-2 group-hover/page:opacity-100 hover:text-amber-400",
                                )}
                                title={isBookmarked ? "Quitar marcador" : "Marcar página"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleBookmark(relativeFilePath, pageNum);
                                  if (!isBookmarked) setRightPanelTab("bookmarks");
                                }}
                              >
                                {isBookmarked
                                  ? <IconBookmarkFilled size={14} />
                                  : <IconBookmark size={14} />}
                              </button>
                            )}

                            {/* Citation badge */}
                            {pageCitaCount > 0 && (
                              <button
                                className="absolute top-1 right-1 z-30 flex items-center gap-0.5 rounded-full bg-amber-500/80 px-1.5 py-0.5 text-white hover:bg-amber-500 transition-colors shadow-sm"
                                title={`${pageCitaCount} cita${pageCitaCount > 1 ? "s" : ""} vinculada${pageCitaCount > 1 ? "s" : ""} a esta página`}
                                onClick={(e) => { e.stopPropagation(); setRightPanelTab("citas"); }}
                              >
                                <IconQuote size={8} />
                                {pageCitaCount > 1 && <span className="text-[8px] font-semibold leading-none">{pageCitaCount}</span>}
                              </button>
                            )}

                            {/* Cita highlight rects */}
                            {pageCitas.some((c) => c.rects?.length) && (
                              <svg style={{ position: "absolute", inset: 0, width: pageW, height: pageH, pointerEvents: "none", zIndex: 8 }}>
                                {pageCitas.flatMap((cita) =>
                                  (cita.rects ?? []).map((rect, i) => {
                                    const r = toRotatedRect(rect, intrinsic.w * scale, intrinsic.h * scale, pageRotation);
                                    return <rect key={`${cita.id}-${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={CITA_FILL[cita.color]} />;
                                  })
                                )}
                              </svg>
                            )}

                            {/* Inner wrapper: rendered at renderScale, CSS-scaled to displayScale */}
                            <div
                              style={{
                                position: "absolute", top: 0, left: 0,
                                width: renderPageW, height: renderPageH,
                                transform: `scale(${cssScaleFactor})`,
                                transformOrigin: "top left",
                              }}
                            >
                              <Page
                                pageNumber={pageNum}
                                scale={renderScale}
                                rotate={getPageRotation(pageNum)}
                                renderTextLayer
                                renderAnnotationLayer
                                customTextRenderer={customTextRenderer}
                                onRenderSuccess={({ originalWidth, originalHeight }) => {
                                  setPageIntrinsics((prev) => ({
                                    ...prev,
                                    [pageNum]: { w: originalWidth, h: originalHeight },
                                  }));
                                }}
                                loading={
                                  <div
                                    style={{ width: Math.round(intrinsic.w * renderScale), height: Math.round(intrinsic.h * renderScale) }}
                                    className="flex flex-col p-8 gap-5 bg-white dark:bg-zinc-800 rounded shadow-sm border border-border/10 overflow-hidden"
                                  >
                                    <div className="w-2/3 h-6 bg-muted/40 rounded animate-pulse" />
                                    <div className="w-full h-3 bg-muted/20 rounded mt-4 animate-pulse" />
                                    <div className="w-full h-3 bg-muted/20 rounded animate-pulse" />
                                    <div className="w-5/6 h-3 bg-muted/20 rounded animate-pulse" />
                                    <div className="w-full h-3 bg-muted/20 rounded animate-pulse" />
                                    <div className="w-4/5 h-3 bg-muted/20 rounded animate-pulse" />
                                  </div>
                                }
                              />
                            </div>

                            {/* Annotation overlay — at display scale, outside CSS transform */}
                            <AnnotationOverlay
                              pageNumber={pageNum}
                              scale={scale}
                              rotation={pageRotation}
                              intrinsicWidth={intrinsic.w}
                              intrinsicHeight={intrinsic.h}
                              annotationMode={annotationMode}
                              activeColor={activeColor}
                              annotations={pageAnnotations}
                              flashingAnnotationId={flashingAnnotationId}
                              onCreated={(path, endX, endY) => handleAnnotationCreated(pageNum, path, endX, endY)}
                              onAnnotationClick={handleAnnotationClick}
                              onAnnotationDelete={handleAnnotationDelete}
                            />

                            {flashingPageNum === pageNum && (
                              <div style={{ position: "absolute", inset: 0, zIndex: 25, pointerEvents: "none", background: "rgba(245,158,11,0.3)", animation: "pageFlash 2s ease-out forwards" }} />
                            )}

                            {notePopup?.pageNum === pageNum && (
                              <NotePopup state={notePopup} pageWidth={pageW} pageHeight={pageH} onClose={() => setNotePopup(null)} />
                            )}
                          </>
                        ) : (
                          /* Placeholder — keeps scroll geometry intact without rendering canvas/SVG */
                          <div className="h-full w-full bg-white dark:bg-zinc-800" />
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* ── Minimap sidebar ────────────────────────────────────────── */}
            {!galleryMode && (
              <PdfMinimap
                numPages={numPages}
                currentPage={currentPage}
                annotations={annotations}
                bookmarks={bookmarks}
                relativeFilePath={relativeFilePath}
                mainScrollRef={mainScrollRef}
                scrollToPage={scrollToPage}
              />
            )}
          </Document>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ icon, message, sub }: { icon: React.ReactNode; message: string; sub: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-muted-foreground relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40 dark:mix-blend-screen">
        <div className="h-72 w-72 rounded-full bg-primary/10 blur-[80px]" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-3 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-foreground/20">{icon}</div>
        <div className="text-center">
          <p className="text-[15px] font-medium text-foreground/80">{message}</p>
          <p className="mt-1 text-xs opacity-60 max-w-[250px]">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden text-muted-foreground">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-40 dark:mix-blend-screen">
        <div className="h-72 w-72 rounded-full bg-primary/10 blur-[80px]" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-3 animate-in fade-in duration-500">
        <IconLoader2 size={24} className="animate-spin text-primary/60" />
        <span className="text-sm font-medium">Cargando PDF…</span>
      </div>
    </div>
  );
}

function ErrorState({ message, path }: { message?: string; path?: string }) {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden text-muted-foreground">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30 dark:mix-blend-screen">
        <div className="h-72 w-72 rounded-full bg-destructive/20 blur-[80px]" />
      </div>
      <div className="relative z-10 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <IconFileAlert size={36} strokeWidth={1} className="text-destructive/60" />
        <span className="text-sm font-medium text-destructive/90">{message ?? "Error al cargar el PDF"}</span>
        {path && (
          <span className="max-w-[280px] truncate text-center text-[10px] opacity-60">{path}</span>
        )}
      </div>
    </div>
  );
}
