import type { AnnotationColor } from "./anotaciones";

export interface Cita {
  id: string;
  /** The quoted text extracted from the PDF. */
  text: string;
  relativeFilePath: string | null;
  pageNumber: number | null;
  color: AnnotationColor;
  /** Optional reviewer comment about this quote. */
  note: string;
  createdAt: string;
}

/** Shape written to citas.json (via api.revision.saveStep). */
export interface CitasData {
  citas: Cita[];
  updatedAt: string;
}
