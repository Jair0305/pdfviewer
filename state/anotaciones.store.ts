"use client";

import { create } from "zustand";
import type { Annotation, AnnotationColor, AnotacionesData } from "@/types/anotaciones";
import type { NormalizedPoint } from "@/types/anotaciones";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApi() {
  if (typeof window !== "undefined" && "api" in window) return window.api;
  return null;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function cancelPendingSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}

const MAX_UNDO = 50;

const EMPTY_STATE = {
  annotations:         [] as Annotation[],
  isLoaded:            false,
  _revisionPath:       null as string | null,
  editingAnnotationId: null as string | null,
  pendingNavigation:   null as { filePath: string; pageNumber: number; highlightAnnotationId?: string; targetPane?: "left" | "right" } | null,
  /** "pen" = drawing new strokes; "erase" = click-to-delete; null = view-only */
  annotationMode:      null as "pen" | "erase" | null,
  activeColor:         "yellow" as AnnotationColor,
  undoStack:           [] as Annotation[][],
  redoStack:           [] as Annotation[][],
  currentVisiblePage:  1,
};

// ─── State ────────────────────────────────────────────────────────────────────

interface AnotacionesState {
  annotations:         Annotation[];
  isLoaded:            boolean;
  _revisionPath:       string | null;
  editingAnnotationId: string | null;
  pendingNavigation:   { filePath: string; pageNumber: number; highlightAnnotationId?: string; targetPane?: "left" | "right" } | null;
  annotationMode:      "pen" | "erase" | null;
  activeColor:         AnnotationColor;
  undoStack:           Annotation[][];
  redoStack:           Annotation[][];
  currentVisiblePage:  number;

  // Lifecycle
  loadAnotaciones:   (revisionPath: string) => Promise<void>;
  unloadAnotaciones: () => void;

  // CRUD — caller supplies the id so PdfViewer can reference it for the popup
  addAnnotation:         (a: Omit<Annotation, "createdAt" | "updatedAt">) => void;
  updateAnnotationText:  (id: string, text: string) => void;
  updateAnnotationColor: (id: string, color: AnnotationColor) => void;
  deleteAnnotation:      (id: string) => void;

  // Undo / redo
  undo: () => void;
  redo: () => void;

  // UI actions
  setEditingAnnotation:   (id: string | null) => void;
  setAnnotationMode:      (mode: "pen" | "erase" | null) => void;
  setActiveColor:         (color: AnnotationColor) => void;
  navigateTo:             (filePath: string, pageNumber: number, highlightAnnotationId?: string, targetPane?: "left" | "right") => void;
  clearPendingNavigation: () => void;
  setCurrentVisiblePage:  (page: number) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAnotacionesStore = create<AnotacionesState>((set, get) => ({
  ...EMPTY_STATE,

  loadAnotaciones: async (revisionPath: string) => {
    cancelPendingSave();
    set({ ...EMPTY_STATE });

    const api = getApi();
    if (!api || !api.revision) {
      set({ _revisionPath: revisionPath, isLoaded: true });
      return;
    }

    try {
      const raw  = await api.revision.loadStep(revisionPath, "anotaciones");
      const data = raw as AnotacionesData | null;
      set({
        _revisionPath: revisionPath,
        annotations:   data?.annotations ?? [],
        isLoaded:      true,
      });
    } catch (err) {
      console.error("[ANOTACIONES ERROR] loadAnotaciones:", err);
      set({ _revisionPath: revisionPath, isLoaded: true });
    }
  },

  unloadAnotaciones: () => {
    cancelPendingSave();
    set({ ...EMPTY_STATE });
  },

  // Caller generates the id (via crypto.randomUUID()) so the popup can reference it.
  addAnnotation: (partial) => {
    const now        = new Date().toISOString();
    const annotation: Annotation = { ...partial, createdAt: now, updatedAt: now };
    set((s) => ({
      undoStack:  [...s.undoStack.slice(-(MAX_UNDO - 1)), s.annotations],
      redoStack:  [],
      annotations: [...s.annotations, annotation],
    }));
    scheduleSave(get);
  },

  updateAnnotationText: (id, text) => {
    set((s) => ({
      undoStack:  [...s.undoStack.slice(-(MAX_UNDO - 1)), s.annotations],
      redoStack:  [],
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, text, updatedAt: new Date().toISOString() } : a,
      ),
    }));
    scheduleSave(get);
  },

  updateAnnotationColor: (id, color) => {
    set((s) => ({
      undoStack:  [...s.undoStack.slice(-(MAX_UNDO - 1)), s.annotations],
      redoStack:  [],
      annotations: s.annotations.map((a) =>
        a.id === id ? { ...a, color, updatedAt: new Date().toISOString() } : a,
      ),
    }));
    scheduleSave(get);
  },

  deleteAnnotation: (id) => {
    set((s) => ({
      undoStack:  [...s.undoStack.slice(-(MAX_UNDO - 1)), s.annotations],
      redoStack:  [],
      annotations:         s.annotations.filter((a) => a.id !== id),
      editingAnnotationId: s.editingAnnotationId === id ? null : s.editingAnnotationId,
    }));
    scheduleSave(get);
  },

  undo: () => {
    const { undoStack, annotations, redoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      undoStack:  undoStack.slice(0, -1),
      redoStack:  [...redoStack.slice(-(MAX_UNDO - 1)), annotations],
      annotations: prev,
    });
    scheduleSave(get);
  },

  redo: () => {
    const { redoStack, annotations, undoStack } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      redoStack:  redoStack.slice(0, -1),
      undoStack:  [...undoStack.slice(-(MAX_UNDO - 1)), annotations],
      annotations: next,
    });
    scheduleSave(get);
  },

  setEditingAnnotation:   (id)       => set({ editingAnnotationId: id }),
  setAnnotationMode:      (mode)     => set({ annotationMode: mode }),
  setActiveColor:         (c)        => set({ activeColor: c }),
  navigateTo:             (fp, pg, hid?, pane?) => set({ pendingNavigation: { filePath: fp, pageNumber: pg, highlightAnnotationId: hid, targetPane: pane } }),
  clearPendingNavigation: ()         => set({ pendingNavigation: null }),
  setCurrentVisiblePage:  (page)     => set({ currentVisiblePage: page }),
}));

// ─── Debounced save ────────────────────────────────────────────────────────────

function scheduleSave(get: () => AnotacionesState) {
  cancelPendingSave();
  saveTimeout = setTimeout(() => {
    const { _revisionPath, annotations } = get();
    const api = getApi();
    if (!_revisionPath || !api || !api.revision) return;
    const data: AnotacionesData = { annotations, updatedAt: new Date().toISOString() };
    api.revision
      .saveStep(_revisionPath, "anotaciones", data)
      .catch((err: unknown) => console.error("[ANOTACIONES ERROR] saveStep:", err));
  }, 1000);
}
