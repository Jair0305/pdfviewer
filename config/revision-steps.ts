/**
 * Ordered list of revision steps.
 *
 * Steps are intentionally generic: they do not know their own UI component
 * or data schema. Each step owns a separate JSON file (<stepId>.json) inside
 * the revision folder. Add steps here only when their requirements are clear.
 *
 * The questionnaire template (config/questionnaire.ts) is independent and
 * may change without requiring any migration — answers are stored as
 * arbitrary key/value pairs keyed by question ID.
 */
export const REVISION_STEPS = [
  { id: "cuestionario" as const, title: "Cuestionario" },
  { id: "anotaciones"  as const, title: "Anotaciones"  },
  { id: "citas"        as const, title: "Citas"         },
  { id: "docStatus"    as const, title: "Estado Docs"   },
  { id: "sintesis"     as const, title: "Síntesis"      },
  // Future steps — uncomment when requirements are defined:
  // { id: "dictamen" as const, title: "Dictamen" },
] as const;

export type RevisionStepId = (typeof REVISION_STEPS)[number]["id"];
