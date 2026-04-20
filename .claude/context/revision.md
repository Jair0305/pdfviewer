# Revision System

## Purpose

Each expediente gets a parallel "revision" folder that stores all review work (annotations, citas, questionnaire answers, doc status, etc.) as JSON files. The original expediente is never modified.

## Folder structure

The revision folder mirrors the client folder hierarchy exactly:

```
clientesFolder/Empresa1/Enero/Exp001/      ← source expediente (read-only for us)
revisionesFolder/Empresa1/Enero/Exp001/    ← mirrored revision folder
  ├── meta.json
  ├── cuestionario.json
  ├── anotaciones.json
  ├── citas.json
  ├── docStatus.json
  ├── sintesis.json
  ├── bookmarks.json
  └── exports/
```

This mirroring means:
- No folder name collisions (full relative path is unique)
- Stats at any level (company / month / expediente) by traversing revisiones
- Human-readable layout in Dropbox
- Cross-machine compatible (relative path is stable; absolute paths are updated on open)

## Identity model

Canonical identity is `relativePath` (e.g. `"Empresa1/Enero/Exp001"`). Computed as `expedientePath - clientesFolder`.

If `clientesFolder` is not configured, falls back to the folder basename.

A UUID is also stored in `meta.json` for programmatic tracing.

## meta.json

```ts
interface RevisionMeta {
  uuid: string;                  // generated once on first init
  expedienteId: string;          // basename, e.g. "Exp001"
  relativePath: string;          // stable cross-machine identity
  expedientePath: string;        // absolute path on THIS machine (updated on cross-machine open)
  revisionPath: string;          // absolute path to revision folder on THIS machine
  createdAt: string;             // ISO
  updatedAt: string;             // ISO
  steps: RevisionStepState[];    // status of each step (pendiente/en_proceso/completado)
}
```

## Init result (from `init()` in `electron/services/revision.ts`)

Three possible outcomes:

- `ok` — everything matches, revision loaded normally
- `path_updated` — same relative path, different absolute root (cross-machine) → meta.json silently updated
- `name_collision` — revision at this relative path exists but has a different `relativePath` in its meta (data integrity issue, surface to user)

## Steps

Registered in `config/revision-steps.ts` (`REVISION_STEPS` array) and `types/revision.ts` (`StepId` union). Both must be updated when adding a step.

Current steps:
- `cuestionario`
- `anotaciones`
- `citas`
- `docStatus`
- `sintesis`
- `bookmarks`

When adding a new step, ALSO add it to `electron/services/revision.ts` `init()` so new expedientes get the entry.

`updateStepStatus` in the service uses `find()` — if a step isn't in the meta (old expediente), it's a graceful no-op. This lets us add steps without migrations.

## Generic step I/O

Instead of dedicated IPC channels per step, all steps use:

- `window.api.revision.loadStep(revisionPath, stepId)` → `<stepId>.json` content or null
- `window.api.revision.saveStep(revisionPath, stepId, data)` → writes to `<stepId>.json`

Store pattern (used by all step stores):

```ts
// On load
const raw = await api.revision.loadStep(revisionPath, "stepName");
const data = raw as StepData | null;

// On change
scheduleSave(get) → debounce 1s → api.revision.saveStep(...)
```

## WorkbenchLayout wiring

`useEffect` hooks watch `root?.path` and `revisionPath`:

1. When `root` changes → `loadRevision(root.path)` → init or load meta.json
2. When `revisionPath` becomes available → load all step stores: `loadAnotaciones`, `loadCitas`, `loadDocStatus`, `loadSintesis`, `loadBookmarks`
3. On root unload → `unload*` resets all step stores to empty

## Rules

- Never write to the expediente folder itself — only to `revisionesFolder`
- All step data is debounced-saved (1s) to survive rapid edits without hammering the disk
- Step data includes `updatedAt` ISO timestamp
- Never crash on missing step files — absent = empty initial state
- Never crash on old expedientes without newer step entries — graceful no-op
