"use client";

import { create } from "zustand";
import type { Cita, CitasData } from "@/types/citas";
import type { AnnotationColor } from "@/types/anotaciones";

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

// ─── State ────────────────────────────────────────────────────────────────────

const EMPTY_STATE = {
  citas:         [] as Cita[],
  isLoaded:      false,
  _revisionPath: null as string | null,
};

interface CitasState {
  citas:         Cita[];
  isLoaded:      boolean;
  _revisionPath: string | null;

  loadCitas:   (revisionPath: string) => Promise<void>;
  unloadCitas: () => void;

  addCita:              (c: Cita) => void;
  deleteCita:           (id: string) => void;
  updateCitaNote:       (id: string, note: string) => void;
  updateCitaColor:      (id: string, color: AnnotationColor) => void;
  updateCitaAnnotation: (id: string, annotationId: string | undefined) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCitasStore = create<CitasState>((set, get) => ({
  ...EMPTY_STATE,

  loadCitas: async (revisionPath) => {
    cancelPendingSave();
    set({ ...EMPTY_STATE });

    const api = getApi();
    if (!api || !api.revision) {
      set({ _revisionPath: revisionPath, isLoaded: true });
      return;
    }

    try {
      const raw  = await api.revision.loadStep(revisionPath, "citas");
      const data = raw as CitasData | null;
      set({
        _revisionPath: revisionPath,
        citas:         data?.citas ?? [],
        isLoaded:      true,
      });
    } catch (err) {
      console.error("[CITAS ERROR] loadCitas:", err);
      set({ _revisionPath: revisionPath, isLoaded: true });
    }
  },

  unloadCitas: () => {
    cancelPendingSave();
    set({ ...EMPTY_STATE });
  },

  addCita: (c) => {
    set((s) => ({ citas: [...s.citas, c] }));
    scheduleSave(get);
  },

  deleteCita: (id) => {
    set((s) => ({ citas: s.citas.filter((c) => c.id !== id) }));
    scheduleSave(get);
  },

  updateCitaNote: (id, note) => {
    set((s) => ({
      citas: s.citas.map((c) => (c.id === id ? { ...c, note } : c)),
    }));
    scheduleSave(get);
  },

  updateCitaColor: (id, color) => {
    set((s) => ({
      citas: s.citas.map((c) => (c.id === id ? { ...c, color } : c)),
    }));
    scheduleSave(get);
  },

  updateCitaAnnotation: (id, annotationId) => {
    set((s) => ({
      citas: s.citas.map((c) =>
        c.id === id ? { ...c, annotationId } : c,
      ),
    }));
    scheduleSave(get);
  },
}));

// ─── Debounced save ────────────────────────────────────────────────────────────

function scheduleSave(get: () => CitasState) {
  cancelPendingSave();
  saveTimeout = setTimeout(() => {
    const { _revisionPath, citas } = get();
    const api = getApi();
    if (!_revisionPath || !api || !api.revision) return;
    const data: CitasData = { citas, updatedAt: new Date().toISOString() };
    api.revision
      .saveStep(_revisionPath, "citas", data)
      .catch((err: unknown) => console.error("[CITAS ERROR] saveStep:", err));
  }, 1000);
}
