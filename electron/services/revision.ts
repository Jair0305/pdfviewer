/**
 * RevisionService — reads and writes JSON revision files.
 *
 * Folder structure
 * ────────────────
 * The revision folder mirrors the client folder hierarchy exactly:
 *
 *   clientesFolder/Empresa1/Enero/Exp001/  →  revisionesFolder/Empresa1/Enero/Exp001/
 *                                               ├── meta.json
 *                                               ├── cuestionario.json
 *                                               └── exports/
 *
 * This mirroring means:
 *  - No folder name collisions (full relative path is unique)
 *  - Stats at any level (company / month / expediente) by traversing revisiones
 *  - Human-readable layout in Dropbox
 *  - Cross-machine compatible (relative path is stable; absolute paths are updated)
 *
 * Identity model
 * ──────────────
 * The canonical identity is `relativePath` (e.g. "Empresa1/Enero/Exp001").
 * It is computed as `expedientePath - clientesFolder`.
 * If clientesFolder is not configured, falls back to the folder basename.
 *
 * A UUID is also stored in meta.json for programmatic tracing.
 */

import fsPromises from "fs/promises";
import path from "path";
import crypto from "crypto";

/** Normalize any path to forward slashes. */
function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * Compute the stable relative path.
 * If expedientePath is inside clientesFolder, returns the relative portion.
 * Otherwise falls back to the folder basename.
 */
function computeRelativePath(
  expedientePath: string,
  clientesFolder: string | null,
): string {
  const normExp = norm(expedientePath);
  if (clientesFolder) {
    const normBase = norm(clientesFolder).replace(/\/$/, "");
    if (normExp.startsWith(normBase + "/")) {
      return normExp.slice(normBase.length + 1);
    }
  }
  return path.basename(expedientePath);
}

// ─── Types (inlined to avoid cross-context import issues) ─────────────────────

interface RevisionStepState {
  id: string;
  status: "pendiente" | "en_proceso" | "completado";
  updatedAt: string | null;
}

interface RevisionMeta {
  uuid: string;
  expedienteId: string;
  relativePath: string;
  expedientePath: string;
  revisionPath: string;
  createdAt: string;
  updatedAt: string;
  steps: RevisionStepState[];
}

export type InitResult =
  | { status: "ok";             meta: RevisionMeta }
  | { status: "path_updated";   meta: RevisionMeta; previousPath: string }
  | { status: "name_collision"; meta: RevisionMeta; conflictPath: string };

// ─── Service ──────────────────────────────────────────────────────────────────

/**
 * Ensures the mirrored revision subfolder exists and meta.json is initialized.
 *
 * Returns a tagged InitResult:
 *   "ok"             — everything matches, revision loaded normally
 *   "path_updated"   — same relative path, different absolute root (other machine);
 *                      meta.json was updated silently
 *   "name_collision" — a revision at this relative path exists but has a
 *                      different relativePath in its meta (data integrity issue)
 */
export async function init(
  expedientePath: string,
  clientesFolder: string | null,
  revisionesFolder: string,
): Promise<InitResult> {
  const relativePath  = computeRelativePath(expedientePath, clientesFolder);
  const expedienteId  = path.basename(expedientePath);
  // Build the mirrored revision path: revisionesFolder/<relativePath>
  const revisionPath  = path.join(revisionesFolder, ...relativePath.split("/"));

  await fsPromises.mkdir(revisionPath, { recursive: true });

  const metaPath    = path.join(revisionPath, "meta.json");
  const currentNorm = norm(expedientePath);

  let existingMeta: RevisionMeta | null = null;
  try {
    const raw = await fsPromises.readFile(metaPath, "utf8");
    existingMeta = JSON.parse(raw) as RevisionMeta;
  } catch {
    /* meta.json doesn't exist yet */
  }

  if (existingMeta) {
    // Canonical check: relative path must match
    if (existingMeta.relativePath === relativePath) {
      if (norm(existingMeta.expedientePath) === currentNorm) {
        // Perfect match
        return { status: "ok", meta: existingMeta };
      }
      // Same relative path, different absolute root → cross-machine update
      const updated: RevisionMeta = {
        ...existingMeta,
        expedientePath: currentNorm,
        revisionPath:   norm(revisionPath),
        updatedAt:      new Date().toISOString(),
      };
      await fsPromises.writeFile(metaPath, JSON.stringify(updated, null, 2), "utf8");
      return {
        status: "path_updated",
        meta: updated,
        previousPath: norm(existingMeta.expedientePath),
      };
    }

    // relativePath mismatch — data integrity issue
    return {
      status: "name_collision",
      meta: existingMeta,
      conflictPath: existingMeta.expedientePath,
    };
  }

  // First time — create meta.json
  const meta: RevisionMeta = {
    uuid:           crypto.randomUUID(),
    expedienteId,
    relativePath,
    expedientePath: currentNorm,
    revisionPath:   norm(revisionPath),
    createdAt:      new Date().toISOString(),
    updatedAt:      new Date().toISOString(),
    steps: [
      { id: "cuestionario", status: "pendiente", updatedAt: null },
      { id: "anotaciones",  status: "pendiente", updatedAt: null },
      { id: "citas",        status: "pendiente", updatedAt: null },
      { id: "docStatus",    status: "pendiente", updatedAt: null },
      { id: "sintesis",     status: "pendiente", updatedAt: null },
      { id: "bookmarks",    status: "pendiente", updatedAt: null },
    ],
  };
  await fsPromises.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8");
  return { status: "ok", meta };
}

/**
 * Overwrites meta.json, updating `updatedAt` to now.
 */
export async function saveMeta(
  revisionPath: string,
  meta: RevisionMeta,
): Promise<void> {
  const updated = { ...meta, updatedAt: new Date().toISOString() };
  await fsPromises.writeFile(
    path.join(revisionPath, "meta.json"),
    JSON.stringify(updated, null, 2),
    "utf8",
  );
}

/**
 * Reads <stepId>.json and returns its parsed content, or null if not found.
 */
export async function loadStepData(
  revisionPath: string,
  stepId: string,
): Promise<unknown> {
  try {
    const raw = await fsPromises.readFile(
      path.join(revisionPath, `${stepId}.json`),
      "utf8",
    );
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Writes data as <stepId>.json (pretty-printed).
 */
export async function saveStepData(
  revisionPath: string,
  stepId: string,
  data: unknown,
): Promise<void> {
  await fsPromises.writeFile(
    path.join(revisionPath, `${stepId}.json`),
    JSON.stringify(data, null, 2),
    "utf8",
  );
}
