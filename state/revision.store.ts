"use client";

import { create } from "zustand";
import type { Answer, AnswerValue } from "@/types/expediente";
import type { RevisionMeta, QuestionnaireData, StepStatus } from "@/types/revision";
import { useSettingsStore } from "./settings.store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getApi() {
  if (typeof window !== "undefined" && "api" in window) return window.api;
  return null;
}

// Module-level debounce timer — lives outside Zustand state intentionally.
// MUST be cancelled whenever loadRevision or unloadRevision is called so
// saves from a previous session never bleed into the current one.
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

/** Returns true if `child` is nested inside `parent` (both normalized). */
function isInsideFolder(child: string, parent: string): boolean {
  const c = child.replace(/\\/g, "/");
  const p = parent.replace(/\\/g, "/").replace(/\/$/, "");
  return c.startsWith(p + "/");
}

function cancelPendingSave() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
}

/** The blank-slate shape we always reset to before loading a new revision. */
const EMPTY_STATE = {
  meta: null,
  revisionPath: null,
  expedientePath: null,
  answers: {} as Record<string, Answer>,
  isLoaded: false,
  warning: null,
  /**
   * True when the opened folder is outside the configured clientesFolder.
   * In this case the app works in memory-only mode and nothing is written
   * to the revisiones Dropbox — same logic as an IDE not loading history
   * for a folder that isn't the configured workspace.
   */
  isOutsideClientes: false,
} as const;

// ─── State ────────────────────────────────────────────────────────────────────

export interface RevisionWarning {
  type: "name_collision";
  conflictPath: string;
}

interface RevisionState {
  meta: RevisionMeta | null;
  revisionPath: string | null;
  expedientePath: string | null;
  /** Questionnaire answers for the WHOLE expediente, keyed by questionId. */
  answers: Record<string, Answer>;
  isLoaded: boolean;
  warning: RevisionWarning | null;
  isOutsideClientes: boolean;

  loadRevision: (expedientePath: string) => Promise<void>;
  unloadRevision: () => void;
  dismissWarning: () => void;
  setAnswer: (questionId: string, value: AnswerValue) => void;
  getAnswers: () => Record<string, Answer>;
  getProgress: (totalQuestions: number) => { answered: number; yes: number; no: number };
  updateStepStatus: (stepId: string, status: StepStatus) => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useRevisionStore = create<RevisionState>((set, get) => ({
  ...EMPTY_STATE,

  loadRevision: async (expedientePath: string) => {
    // 1. Always cancel any pending save from the previous session first.
    //    This prevents a slow debounced write from landing in the wrong file.
    cancelPendingSave();

    // 2. Immediately reset to blank slate so the UI never shows stale data
    //    from the previous expediente while the new one is loading.
    set({ ...EMPTY_STATE });

    const api = getApi();
    const { revisionesFolder, clientesFolder } = useSettingsStore.getState();

    // 3a. If clientesFolder is configured and the opened folder is outside it,
    //     work in memory-only mode. Nothing is written to the revisiones Dropbox.
    //     (Prevents phantom revision files for folders unrelated to client work.)
    if (clientesFolder && !isInsideFolder(expedientePath, clientesFolder)) {
      set({ expedientePath, isLoaded: true, isOutsideClientes: true });
      return;
    }

    // 3b. Memory-only mode when Electron API or revisionesFolder aren't ready.
    if (!api || !api.revision || !revisionesFolder) {
      set({ expedientePath, isLoaded: true });
      return;
    }

    try {
      const result = await api.revision.init(expedientePath, clientesFolder, revisionesFolder);

      let warning: RevisionWarning | null = null;
      if (result.status === "name_collision") {
        warning = { type: "name_collision", conflictPath: result.conflictPath };
        console.warn(
          `[REVISION WARN] Name collision: revision at "${result.meta.revisionPath}" ` +
          `was created for "${result.conflictPath}", not "${expedientePath}"`,
        );
      }

      const { meta } = result;
      const raw  = await api.revision.loadStep(meta.revisionPath, "cuestionario");
      const data = raw as QuestionnaireData | null;

      set({
        meta,
        revisionPath: meta.revisionPath,
        expedientePath,
        answers: data?.answers ?? {},
        isLoaded: true,
        warning,
      });
    } catch (err) {
      console.error("[REVISION ERROR] loadRevision:", err);
      // Fallback to memory-only — UI stays functional, no stale revisionPath
      set({ expedientePath, isLoaded: true });
    }
  },

  unloadRevision: () => {
    cancelPendingSave();
    set({ ...EMPTY_STATE });
  },

  dismissWarning: () => set({ warning: null }),

  setAnswer: (questionId, value) => {
    set((s) => ({
      answers: {
        ...s.answers,
        [questionId]: { questionId, value } satisfies Answer,
      },
    }));

    // Debounced auto-save: reads state at fire time via get(), so it always
    // uses the current revisionPath — if it was cleared, the save is skipped.
    cancelPendingSave();
    saveTimeout = setTimeout(() => {
      const { revisionPath, answers } = get();
      const api = getApi();
      if (!revisionPath || !api || !api.revision) return;
      const data: QuestionnaireData = { answers, updatedAt: new Date().toISOString() };
      api.revision
        .saveStep(revisionPath, "cuestionario", data)
        .catch((err) => console.error("[REVISION ERROR] saveStep:", err));
    }, 1000);
  },

  getAnswers: () => get().answers,

  getProgress: (totalQuestions) => {
    const vals = Object.values(get().answers);
    return {
      answered: vals.filter((a) => a.value !== null).length,
      yes:      vals.filter((a) => a.value === "yes").length,
      no:       vals.filter((a) => a.value === "no").length,
    };
  },

  updateStepStatus: async (stepId, status) => {
    const { meta, revisionPath } = get();
    const api = getApi();
    if (!meta || !revisionPath || !api || !api.revision) return;

    const updatedMeta: RevisionMeta = {
      ...meta,
      steps: meta.steps.map((s) =>
        s.id === stepId ? { ...s, status, updatedAt: new Date().toISOString() } : s,
      ),
    };
    set({ meta: updatedMeta });
    await api.revision.saveMeta(revisionPath, updatedMeta);
  },
}));
