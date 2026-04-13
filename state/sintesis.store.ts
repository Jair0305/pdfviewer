"use client";

import { create } from "zustand";
import type { SintesisData } from "@/types/sintesis";

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
  content:       "",
  isLoaded:      false,
  isSaving:      false,
  _revisionPath: null as string | null,
};

interface SintesisState {
  content:       string;
  isLoaded:      boolean;
  isSaving:      boolean;
  _revisionPath: string | null;

  loadSintesis:   (revisionPath: string) => Promise<void>;
  unloadSintesis: () => void;
  setContent:     (text: string) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useSintesisStore = create<SintesisState>((set, get) => ({
  ...EMPTY_STATE,

  loadSintesis: async (revisionPath) => {
    cancelPendingSave();
    set({ ...EMPTY_STATE });

    const api = getApi();
    if (!api || !api.revision) {
      set({ _revisionPath: revisionPath, isLoaded: true });
      return;
    }

    try {
      const raw  = await api.revision.loadStep(revisionPath, "sintesis");
      const data = raw as SintesisData | null;
      set({
        _revisionPath: revisionPath,
        content:       data?.content ?? "",
        isLoaded:      true,
      });
    } catch (err) {
      console.error("[SINTESIS ERROR] loadSintesis:", err);
      set({ _revisionPath: revisionPath, isLoaded: true });
    }
  },

  unloadSintesis: () => {
    cancelPendingSave();
    set({ ...EMPTY_STATE });
  },

  setContent: (text) => {
    set({ content: text, isSaving: true });
    scheduleSave(get, set);
  },
}));

// ─── Debounced save ────────────────────────────────────────────────────────────

function scheduleSave(
  get: () => SintesisState,
  set: (partial: Partial<SintesisState>) => void,
) {
  cancelPendingSave();
  saveTimeout = setTimeout(() => {
    const { _revisionPath, content } = get();
    const api = getApi();
    if (!_revisionPath || !api || !api.revision) {
      set({ isSaving: false });
      return;
    }
    const data: SintesisData = { content, updatedAt: new Date().toISOString() };
    api.revision
      .saveStep(_revisionPath, "sintesis", data)
      .then(() => set({ isSaving: false }))
      .catch((err: unknown) => {
        console.error("[SINTESIS ERROR] saveStep:", err);
        set({ isSaving: false });
      });
  }, 1000);
}
