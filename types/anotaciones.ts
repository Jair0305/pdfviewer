/**
 * Types for the annotation & notes system.
 *
 * Storage: revisionPath/anotaciones.json (generic step JSON via api.revision.saveStep)
 *
 * Coordinate model
 * ────────────────
 * Annotation paths are stored in NORMALIZED space:
 *   x ∈ [0,1] = fraction of intrinsic page width  (at scale=1, rotation=0)
 *   y ∈ [0,1] = fraction of intrinsic page height (at scale=1, rotation=0)
 *
 * This means coordinates survive any scale or rotation change.
 * To render: denormalize → rotate → render at current scale.
 * To record: capture in rotated overlay pixels → un-rotate → normalize.
 */

export interface NormalizedPoint {
  x: number; // [0, 1]
  y: number; // [0, 1]
}

/**
 * A rectangle stored in normalized page space ([0,1]).
 * Used for text highlight annotations.
 */
export interface NormalizedRect {
  x: number; // [0, 1]
  y: number; // [0, 1]
  w: number; // [0, 1]
  h: number; // [0, 1]
}

export type AnnotationColor = "yellow" | "green" | "red" | "blue";

export interface Annotation {
  /** UUID generated client-side with crypto.randomUUID(). */
  id: string;

  /**
   * "stroke"    = free-hand pen drawing (path is set)
   * "highlight" = text-selection highlight (rects is set)
   * Omitted on legacy annotations → treated as "stroke".
   */
  type?: "stroke" | "highlight";

  /**
   * Relative file path within the expediente (forward slashes, leading /).
   * Example: "/contrato_compraventa.pdf"
   * null  = expediente-level note (not tied to any PDF).
   */
  relativeFilePath: string | null;

  /**
   * 1-based page number. null = document-level note (no page anchor).
   */
  pageNumber: number | null;

  /**
   * Free-hand stroke as an array of normalized points.
   * null for highlights and sticky notes.
   */
  path: NormalizedPoint[] | null;

  /**
   * Text-highlight rectangles in normalized page space.
   * Only present when type === "highlight".
   */
  rects?: NormalizedRect[] | null;

  /** The original selected text (for highlights). */
  selectedText?: string;

  color: AnnotationColor;

  /** The reviewer's written note text. */
  text: string;

  /** ISO 8601. Set once on creation, never changed. */
  createdAt: string;

  /** ISO 8601. Updated on every text or color edit. */
  updatedAt: string;
}

/** Shape written to anotaciones.json (via api.revision.saveStep). */
export interface AnotacionesData {
  annotations: Annotation[];
  updatedAt: string;
}
