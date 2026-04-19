"use client";

import { create } from "zustand";
import type { FileNode, IndexStatus } from "@/types/expediente";
import { getApi } from "@/lib/electron";

// ─── Path helpers ─────────────────────────────────────────────────────────────

function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

function parentDir(p: string): string {
  const n = norm(p);
  return n.substring(0, n.lastIndexOf("/"));
}

function pathJoin(dir: string, name: string): string {
  return norm(dir) + "/" + name;
}

function extToFileType(ext: string | undefined): FileNode["type"] {
  if (ext === ".pdf") return "pdf";
  if (ext === ".xml") return "xml";
  return "unknown";
}

function extFromName(name: string): string | undefined {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(idx).toLowerCase() : undefined;
}

// ─── Immutable tree helpers ────────────────────────────────────────────────────

function sortChildren(a: FileNode, b: FileNode): number {
  if (a.type === "folder" && b.type !== "folder") return -1;
  if (a.type !== "folder" && b.type === "folder") return 1;
  return a.name.localeCompare(b.name, "es", { numeric: true });
}

/** Find a node anywhere in the tree by (normalized) path. */
function findNode(root: FileNode, targetPath: string): FileNode | null {
  if (norm(root.path) === norm(targetPath)) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    const found = findNode(child, targetPath);
    if (found) return found;
  }
  return null;
}

/** Remove the node at targetPath from the tree (immutable, idempotent). */
function removeNode(root: FileNode, targetPath: string): FileNode {
  if (!root.children) return root;
  const filtered = root.children.filter((c) => norm(c.path) !== norm(targetPath));
  const mapped = filtered.map((c) => removeNode(c, targetPath));
  // Return same reference if nothing changed (avoids unnecessary re-renders)
  const changed =
    filtered.length !== root.children.length ||
    mapped.some((c, i) => c !== filtered[i]);
  return changed ? { ...root, children: mapped } : root;
}

/**
 * Add newNode as a child of the node at parentPath.
 * Idempotent: if a child with the same path already exists it is replaced.
 */
function addNodeToParent(
  root: FileNode,
  parentPath: string,
  newNode: FileNode,
): FileNode {
  if (norm(root.path) === norm(parentPath)) {
    if (!root.loaded) return root; // parent not loaded yet — watcher will handle
    const existing = root.children ?? [];
    const without = existing.filter((c) => norm(c.path) !== norm(newNode.path));
    const children = [...without, newNode].sort(sortChildren);
    return { ...root, children };
  }
  if (!root.children) return root;
  const newChildren = root.children.map((c) => addNodeToParent(c, parentPath, newNode));
  const changed = newChildren.some((c, i) => c !== root.children![i]);
  return changed ? { ...root, children: newChildren } : root;
}

/** Update every node whose path matches targetPath via updater. */
function updateNode(
  root: FileNode,
  targetPath: string,
  updater: (n: FileNode) => FileNode,
): FileNode {
  if (norm(root.path) === norm(targetPath)) return updater(root);
  if (!root.children) return root;
  const newChildren = root.children.map((c) => updateNode(c, targetPath, updater));
  const changed = newChildren.some((c, i) => c !== root.children![i]);
  return changed ? { ...root, children: newChildren } : root;
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface ExplorerState {
  root: FileNode | null;
  expandedPaths: Set<string>;
  loadingPaths: Set<string>;
  indexStatus: IndexStatus;

  // Directory actions
  openDirectory: () => Promise<void>;
  /** Open a directory by path without showing a dialog. Used to restore session. */
  openDirectoryByPath: (dirPath: string, savedExpandedPaths?: string[]) => Promise<void>;
  /** Close the current expediente — resets root and clears all tabs. */
  closeDirectory: () => void;
  loadChildren: (node: FileNode) => Promise<void>;
  toggleExpanded: (node: FileNode) => void;
  /** Full re-read from disk for a directory. Use as fallback/recovery only. */
  refreshNode: (path: string) => Promise<void>;
  setIndexStatus: (s: Partial<IndexStatus>) => void;

  // Incremental tree mutations (used by watcher events — idempotent)
  addFileToTree: (filePath: string, parentPath: string, name: string) => void;
  addFolderToTree: (folderPath: string, parentPath: string, name: string) => void;
  removeFromTree: (filePath: string) => void;
  moveInTree: (fromPath: string, toPath: string, toParentPath: string) => void;

  // FS operations (optimistic update → IPC → watcher is idempotent)
  moveNode: (fromPath: string, toParentPath: string) => Promise<void>;
  deleteNode: (nodePath: string) => Promise<void>;
  renameNode: (nodePath: string, newName: string) => Promise<void>;
  createFileNode: (parentPath: string, name: string) => Promise<void>;
  createFolderNode: (parentPath: string, name: string) => Promise<void>;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  root: null,
  expandedPaths: new Set(),
  loadingPaths: new Set(),
  indexStatus: { state: "idle", total: 0, rootPath: null },

  // ── Directory loading ──────────────────────────────────────────────────────

  openDirectory: async () => {
    const api = getApi();
    if (!api) return;

    const dirPath = await api.openDirectory();
    if (!dirPath) return;

    const entries = await api.readDirectory(dirPath);
    const children: FileNode[] = entries.map((e) => ({
      id: e.path,
      name: e.name,
      path: e.path,
      type: e.type === "directory" ? "folder" : extToFileType(e.extension),
      loaded: e.type !== "directory",
    }));

    const rootPath = norm(dirPath);
    const root: FileNode = {
      id: rootPath,
      name: rootPath.split("/").pop() ?? rootPath,
      path: rootPath,
      type: "folder",
      children,
      loaded: true,
    };

    set({
      root,
      expandedPaths: new Set([rootPath]),
      loadingPaths: new Set(),
      indexStatus: { state: "indexing", total: 0, rootPath },
    });

    api.watchDirectory(dirPath);
    api.startIndex(dirPath);
  },

  openDirectoryByPath: async (dirPath: string, savedExpandedPaths: string[] = []) => {
    const api = getApi();
    if (!api) return;

    try {
      const entries = await api.readDirectory(dirPath);
      const children: FileNode[] = entries.map((e) => ({
        id: e.path,
        name: e.name,
        path: e.path,
        type: e.type === "directory" ? "folder" : extToFileType(e.extension),
        loaded: e.type !== "directory",
      }));

      const rootPath = norm(dirPath);
      const root: FileNode = {
        id: rootPath,
        name: rootPath.split("/").pop() ?? rootPath,
        path: rootPath,
        type: "folder",
        children,
        loaded: true,
      };

      set({
        root,
        expandedPaths: new Set([rootPath, ...savedExpandedPaths]),
        loadingPaths: new Set(),
        indexStatus: { state: "indexing", total: 0, rootPath },
      });

      api.watchDirectory(dirPath);
      api.startIndex(dirPath);
    } catch (err) {
      console.error("[FS ERROR] openDirectoryByPath:", err);
    }
  },

  closeDirectory: () => {
    set({ root: null, expandedPaths: new Set(), loadingPaths: new Set(), indexStatus: { state: "idle", total: 0, rootPath: null } });
    // Close all editor tabs via dynamic import to avoid circular deps
    import("./editor.store").then(({ useEditorStore }) => {
      useEditorStore.getState().closeAllTabs();
    });
  },

  loadChildren: async (node: FileNode) => {
    if (node.loaded || node.type !== "folder") return;
    const api = getApi();
    if (!api) return;

    set((s) => ({ loadingPaths: new Set([...s.loadingPaths, node.path]) }));

    try {
      const entries = await api.readDirectory(node.path);
      const children: FileNode[] = entries.map((e) => ({
        id: e.path,
        name: e.name,
        path: e.path,
        type: e.type === "directory" ? "folder" : extToFileType(e.extension),
        loaded: e.type !== "directory",
      }));

      set((s) => {
        if (!s.root) return s;
        const next = new Set(s.loadingPaths);
        next.delete(node.path);
        return {
          loadingPaths: next,
          root: updateNode(s.root, node.path, (n) => ({ ...n, children, loaded: true })),
        };
      });
    } catch {
      set((s) => {
        const next = new Set(s.loadingPaths);
        next.delete(node.path);
        return { loadingPaths: next };
      });
    }
  },

  toggleExpanded: (node: FileNode) => {
    const { expandedPaths, loadChildren } = get();
    if (!expandedPaths.has(node.path) && !node.loaded) {
      loadChildren(node);
    }
    set((s) => {
      const next = new Set(s.expandedPaths);
      next.has(node.path) ? next.delete(node.path) : next.add(node.path);
      return { expandedPaths: next };
    });
  },

  refreshNode: async (nodePath: string) => {
    const api = getApi();
    if (!api || !get().root) return;
    try {
      const entries = await api.readDirectory(nodePath);
      const children: FileNode[] = entries.map((e) => ({
        id: e.path,
        name: e.name,
        path: e.path,
        type: e.type === "directory" ? "folder" : extToFileType(e.extension),
        loaded: e.type !== "directory",
      }));
      set((s) => {
        if (!s.root) return s;
        return {
          root: updateNode(s.root, nodePath, (n) => ({ ...n, children, loaded: true })),
        };
      });
    } catch {
      // Node may no longer exist — ignore
    }
  },

  setIndexStatus: (update) =>
    set((s) => ({ indexStatus: { ...s.indexStatus, ...update } })),

  // ── Incremental mutations (idempotent) ────────────────────────────────────

  addFileToTree: (filePath: string, parentPath: string, name: string) => {
    set((s) => {
      if (!s.root) return s;
      const newNode: FileNode = {
        id: norm(filePath),
        name,
        path: norm(filePath),
        type: extToFileType(extFromName(name)),
        loaded: true,
      };
      const next = addNodeToParent(s.root, parentPath, newNode);
      return next === s.root ? s : { root: next };
    });
  },

  addFolderToTree: (folderPath: string, parentPath: string, name: string) => {
    set((s) => {
      if (!s.root) return s;
      const newNode: FileNode = {
        id: norm(folderPath),
        name,
        path: norm(folderPath),
        type: "folder",
        children: undefined,
        loaded: false,
      };
      const next = addNodeToParent(s.root, parentPath, newNode);
      return next === s.root ? s : { root: next };
    });
  },

  removeFromTree: (filePath: string) => {
    set((s) => {
      if (!s.root) return s;
      const next = removeNode(s.root, filePath);
      return next === s.root ? s : { root: next };
    });
  },

  moveInTree: (fromPath: string, toPath: string, toParentPath: string) => {
    set((s) => {
      if (!s.root) return s;
      const node = findNode(s.root, fromPath);
      if (!node) return s;
      const name = norm(toPath).split("/").pop()!;
      const movedNode: FileNode = { ...node, id: norm(toPath), path: norm(toPath), name };
      let next = removeNode(s.root, fromPath);
      next = addNodeToParent(next, toParentPath, movedNode);
      return { root: next };
    });
  },

  // ── FS Operations ──────────────────────────────────────────────────────────

  moveNode: async (fromPath: string, toParentPath: string) => {
    const api = getApi();
    if (!api) return;
    const name = norm(fromPath).split("/").pop()!;
    const toPath = pathJoin(toParentPath, name);
    if (norm(fromPath) === norm(toPath)) return;

    // 1. Optimistic UI update
    get().moveInTree(fromPath, toPath, toParentPath);

    // 2. Sync open editor tab
    const { updateTab } = (await import("./editor.store")).useEditorStore.getState();
    updateTab(fromPath, toPath, name);

    // 3. FS operation (watcher events will be idempotent)
    try {
      await api.moveFile(fromPath, toPath);
    } catch (err) {
      console.error("[FS ERROR] moveNode:", err);
      // Rollback via full refresh of both parents
      await get().refreshNode(parentDir(fromPath));
      if (norm(toParentPath) !== norm(parentDir(fromPath))) {
        await get().refreshNode(toParentPath);
      }
    }
  },

  deleteNode: async (nodePath: string) => {
    const api = getApi();
    if (!api) return;

    // 1. Optimistic UI update
    get().removeFromTree(nodePath);

    // 2. Close open tab
    const { closeTab } = (await import("./editor.store")).useEditorStore.getState();
    closeTab(nodePath);

    // 3. FS operation
    try {
      await api.deleteFile(nodePath);
    } catch (err) {
      console.error("[FS ERROR] deleteNode:", err);
      // Rollback via refresh
      await get().refreshNode(parentDir(nodePath));
    }
  },

  renameNode: async (nodePath: string, newName: string) => {
    const api = getApi();
    if (!api) return;
    const parent = parentDir(nodePath);
    const newPath = pathJoin(parent, newName);

    // 1. Optimistic UI update
    get().moveInTree(nodePath, newPath, parent);

    // 2. Sync editor tab
    const { updateTab } = (await import("./editor.store")).useEditorStore.getState();
    updateTab(nodePath, newPath, newName);

    // 3. FS operation
    try {
      await api.moveFile(nodePath, newPath);
    } catch (err) {
      console.error("[FS ERROR] renameNode:", err);
      await get().refreshNode(parent);
    }
  },

  createFileNode: async (parentPath: string, name: string) => {
    const api = getApi();
    if (!api) return;
    const filePath = pathJoin(parentPath, name);
    try {
      await api.createFile(filePath);
      // Add immediately; watcher add event will be idempotent
      get().addFileToTree(filePath, parentPath, name);
    } catch (err) {
      console.error("[FS ERROR] createFileNode:", err);
    }
  },

  createFolderNode: async (parentPath: string, name: string) => {
    const api = getApi();
    if (!api) return;
    const folderPath = pathJoin(parentPath, name);
    try {
      await api.createFolder(folderPath);
      get().addFolderToTree(folderPath, parentPath, name);
    } catch (err) {
      console.error("[FS ERROR] createFolderNode:", err);
    }
  },
}));
