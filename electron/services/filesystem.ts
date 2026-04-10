import fs from "fs";
import fsp from "fs/promises";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

class FsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly filePath: string,
  ) {
    super(message);
    this.name = "FsError";
  }
}

// ─── Operation locking ────────────────────────────────────────────────────────
// Prevents concurrent operations on the same path (e.g. Dropbox + user action).

const inFlight = new Set<string>();

function lockPath(p: string): boolean {
  const key = path.normalize(p).toLowerCase();
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
}

function unlockPath(p: string): void {
  inFlight.delete(path.normalize(p).toLowerCase());
}

async function withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  if (!lockPath(filePath)) {
    throw new FsError(
      `[FS ERROR] Operation already in progress: ${filePath}`,
      "EBUSY",
      filePath,
    );
  }
  try {
    return await fn();
  } finally {
    unlockPath(filePath);
  }
}

// ─── Path validation ─────────────────────────────────────────────────────────

function validatePath(filePath: string): void {
  if (!filePath || typeof filePath !== "string") {
    throw new FsError(`[FS ERROR] Invalid path: ${String(filePath)}`, "EINVAL", String(filePath));
  }
  if (filePath.includes("\0")) {
    throw new FsError(`[FS ERROR] Path contains null byte`, "EINVAL", filePath);
  }
}

// ─── Filesystem Service ───────────────────────────────────────────────────────

export async function moveFile(from: string, to: string): Promise<void> {
  validatePath(from);
  validatePath(to);

  return withLock(from, async () => {
    console.log(`[FS ACTION] move: ${from} → ${to}`);

    if (!fs.existsSync(from)) {
      throw new FsError(`[FS ERROR] Source not found: ${from}`, "ENOENT", from);
    }

    try {
      await fsp.rename(from, to);
    } catch (err: any) {
      // EXDEV = cross-device, EPERM = locked file (Dropbox, antivirus)
      if (err.code === "EXDEV" || err.code === "EPERM") {
        console.log(`[FS ACTION] rename failed (${err.code}), falling back to copy+unlink`);
        await fsp.copyFile(from, to);
        await fsp.unlink(from);
      } else {
        console.error(`[FS ERROR] move: ${err.message}`);
        throw err;
      }
    }

    console.log(`[FS ACTION] move complete: ${from} → ${to}`);
  });
}

export async function deleteFile(filePath: string): Promise<void> {
  validatePath(filePath);

  return withLock(filePath, async () => {
    console.log(`[FS ACTION] delete: ${filePath}`);

    let stat: fs.Stats;
    try {
      stat = fs.statSync(filePath);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        // Already gone — treat as success (idempotent delete)
        console.log(`[FS ACTION] delete: already gone: ${filePath}`);
        return;
      }
      throw err;
    }

    if (stat.isDirectory()) {
      await fsp.rm(filePath, { recursive: true, force: true });
    } else {
      await fsp.unlink(filePath);
    }

    console.log(`[FS ACTION] delete complete: ${filePath}`);
  });
}

export async function createFile(filePath: string): Promise<void> {
  validatePath(filePath);
  console.log(`[FS ACTION] create file: ${filePath}`);
  await fsp.writeFile(filePath, "");
}

export async function createDirectory(dirPath: string): Promise<void> {
  validatePath(dirPath);
  console.log(`[FS ACTION] create dir: ${dirPath}`);
  await fsp.mkdir(dirPath, { recursive: true });
}
