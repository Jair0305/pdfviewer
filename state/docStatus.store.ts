"use client";

import { create } from "zustand";
import type { DocStatus, DocStatusData } from "@/types/docStatus";

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
  statuses:      {} as Record<string, DocStatus>,
  isLoaded:      false,
  _revisionPath: null as string | null,
};

interface DocStatusState {
  statuses:      Record<string, DocStatus>;
  isLoaded:      boolean;
  _revisionPath: string | null;

  loadDocStatus:   (revisionPath: string) => Promise<void>;
  unloadDocStatus: () => void;

  setDocStatus: (relativeFilePath: string, status: DocStatus) => void;
  getDocStatus: (relativeFilePath: string) => DocStatus | undefined;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDocStatusStore = create<DocStatusState>((set, get) => ({
  ...EMPTY_STATE,

  loadDocStatus: async (revisionPath) => {
    cancelPendingSave();
    set({ ...EMPTY_STATE });

    const api = getApi();
    if (!api || !api.revision) {
      set({ _revisionPath: revisionPath, isLoaded: true });
      return;
    }

    try {
      const raw  = await api.revision.loadStep(revisionPath, "docStatus");
      const data = raw as DocStatusData | null;
      set({
        _revisionPath: revisionPath,
        statuses:      data?.statuses ?? {},
        isLoaded:      true,
      });
    } catch (err) {
      console.error("[DOC_STATUS ERROR] loadDocStatus:", err);
      set({ _revisionPath: revisionPath, isLoaded: true });
    }
  },

  unloadDocStatus: () => {
    cancelPendingSave();
    set({ ...EMPTY_STATE });
  },

  setDocStatus: (relativeFilePath, status) => {
    set((s) => ({
      statuses: { ...s.statuses, [relativeFilePath]: status },
    }));
    scheduleSave(get);
  },

  getDocStatus: (relativeFilePath) => get().statuses[relativeFilePath],
}));

// ─── Debounced save ────────────────────────────────────────────────────────────

function scheduleSave(get: () => DocStatusState) {
  cancelPendingSave();
  saveTimeout = setTimeout(() => {
    const { _revisionPath, statuses } = get();
    const api = getApi();
    if (!_revisionPath || !api || !api.revision) return;
    const data: DocStatusData = { statuses, updatedAt: new Date().toISOString() };
    api.revision
      .saveStep(_revisionPath, "docStatus", data)
      .catch((err: unknown) => console.error("[DOC_STATUS ERROR] saveStep:", err));
  }, 1000);
}
