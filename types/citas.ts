import type { AnnotationColor, NormalizedRect } from "./anotaciones";

export interface Cita {
  id: string;
  /** The quoted text extracted from the PDF (the drag source). */
  text: string;
  /** Source: file where the text was selected. */
  relativeFilePath: string | null;
  /** Source: page where the text was selected. */
  pageNumber: number | null;
  color: AnnotationColor;
  /** Optional reviewer comment about this quote. */
  note: string;
  createdAt: string;
  /**
   * Normalized [0,1] rects of the selected text on the source page.
   * Used to render a colored highlight overlay on the PDF.
   * Absent on citas created before this field was added (no highlight shown).
   */
  rects?: NormalizedRect[];
  /**
   * When set, this cita is embedded inside a specific annotation/note.
   * The note row will render it inline; the global Citas list will also show it.
   */
  annotationId?: string;
  /**
   * Bidirectional link — target side (set when the drag was dropped onto a
   * specific PDF page). Together with `relativeFilePath`/`pageNumber` (source),
   * this forms a true inter-document link navigable from both ends.
   */
  targetRelativeFilePath?: string;
  targetPageNumber?: number;
}

/** Shape written to citas.json (via api.revision.saveStep). */
export interface CitasData {
  citas: Cita[];
  updatedAt: string;
}

/** MIME type used in HTML5 drag-and-drop dataTransfer. */
export const CITA_DRAG_TYPE = "application/x-revisor-cita";

/** Serialized payload carried during a drag from the selection bubble or from CitasPanel. */
export interface CitaDragPayload {
  text:             string;
  relativeFilePath: string | null;
  pageNumber:       number | null;
  color:            AnnotationColor;
  /** Normalized rects of the selected text — used to create a source highlight on drop. */
  normalizedRects:  NormalizedRect[];
  /**
   * Set when dragging an EXISTING cita from the CitasPanel.
   * Drop on a NoteRow will update this cita's annotationId instead of creating a duplicate.
   */
  existingCitaId?: string;
}
