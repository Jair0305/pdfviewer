export type DocStatus =
  | "sin_revisar"
  | "en_revision"
  | "revisado"
  | "con_observaciones";

/** Shape written to docStatus.json (via api.revision.saveStep). */
export interface DocStatusData {
  /** Keys are relativeFilePath values (e.g. "/contrato.pdf") */
  statuses: Record<string, DocStatus>;
  updatedAt: string;
}
