import type { Answer } from "./expediente";

export type StepStatus = "pendiente" | "en_proceso" | "completado";

// Extend this union as new steps are defined
export type StepId =
  | "cuestionario"
  | "anotaciones"
  | "citas"
  | "docStatus"
  | "sintesis"
  | "dictamen";

export interface RevisionStepState {
  id: StepId;
  status: StepStatus;
  /** ISO string, null if never touched */
  updatedAt: string | null;
}

export interface RevisionMeta {
  /**
   * Stable UUID generated once when the revision is first created.
   * Canonical identity — independent of folder names and machine paths.
   */
  uuid: string;
  /** basename of the opened folder (e.g. "Exp001") */
  expedienteId: string;
  /**
   * Path relative to clientesFolder (forward slashes, no leading slash).
   * This is the STABLE cross-machine identity:
   *   "Empresa1/Enero2024/Exp001"
   * Remains the same regardless of where Dropbox is mounted.
   */
  relativePath: string;
  /**
   * Absolute path to the expediente on THIS machine (forward slashes).
   * Updated automatically when opened from a different machine.
   */
  expedientePath: string;
  /**
   * Absolute path to the revision subfolder on THIS machine.
   * Updated automatically when opened from a different machine.
   */
  revisionPath: string;
  createdAt: string;
  updatedAt: string;
  steps: RevisionStepState[];
}

/**
 * Stored as cuestionario.json.
 * The questionnaire is answered ONCE for the whole expediente —
 * not per-PDF. Keys are questionId only.
 */
export interface QuestionnaireData {
  answers: Record<string, Answer>;
  updatedAt: string;
}
