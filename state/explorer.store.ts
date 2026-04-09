"use client";

import { create } from "zustand";
import type { FileNode, IndexStatus } from "@/types/expediente";
import { getApi } from "@/lib/electron";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parentDir(p: string): string {
  const norm = p.replace(/\\/g, "/");
  return norm.substring(0, norm.lastIndexOf("/"));
}

function pathJoin(dir: string, name: string): string {
  return dir.replace(/\\/g, "/") + "/" + name;
}

function extToFileType(ext: string | undefined): FileNode["type"] {
  if (ext === ".pdf") return "pdf";
  if (ext === ".xml") return "xml";
  return "unknown";
}

function updateNodeInTree(
  root: FileNode,
  targetPath: string,
  updater: (n: FileNode) => FileNode,
): FileNode {
  if (root.path === targetPath) return updater(root);
  if (!root.children) return root;
  return {
    ...root,
    children: root.children.map((c) => updateNodeInTree(c, targetPath, updater)),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface ExplorerState {
  root: FileNode | null;
  expandedPaths: Set<string>;
  loadingPaths: Set<string>;
  indexStatus: IndexStatus;

  openDirectory: () => Promise<void>;
  loadChildren: (node: FileNode) => Promise<void>;
  toggleExpanded: (node: FileNode) => void;
  refreshNode: (path: string) => Promise<void>;
  setIndexStatus: (s: Partial<IndexStatus>) => void;

  // FS operations
  moveNode: (fromPath: string, toParentPath: string) => Promise<void>;
  deleteNode: (nodePath: string) => Promise<void>;
  renameNode: (nodePath: string, newName: string) => Promise<void>;
  createFileNode: (parentPath: string, name: string) => Promise<void>;
  createFolderNode: (parentPath: string, name: string) => Promise<void>;
}

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  root: null,
  expandedPaths: new Set(),
  loadingPaths: new Set(),
  indexStatus: { state: "idle", total: 0, rootPath: null },

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

    const root: FileNode = {
      id: dirPath,
      name: dirPath.split(/[\\/]/).pop() ?? dirPath,
      path: dirPath,
      type: "folder",
      children,
      loaded: true,
    };

    set({
      root,
      expandedPaths: new Set([dirPath]),
      loadingPaths: new Set(),
      indexStatus: { state: "indexing", total: 0, rootPath: dirPath },
    });

    // Start watcher and indexer
    api.watchDirectory(dirPath);
    api.startIndex(dirPath);
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
          root: updateNodeInTree(s.root, node.path, (n) => ({
            ...n,
            children,
            loaded: true,
          })),
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
    const isExpanded = expandedPaths.has(node.path);

    if (!isExpanded && !node.loaded) {
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
        root: updateNodeInTree(s.root, nodePath, (n) => ({ ...n, children, loaded: true })),
      };
    });
  },

  setIndexStatus: (update) =>
    set((s) => ({ indexStatus: { ...s.indexStatus, ...update } })),

  // ── FS Operations ──────────────────────────────────────────────────────────

  moveNode: async (fromPath: string, toParentPath: string) => {
    const api = getApi();
    if (!api) return;
    const name = fromPath.replace(/\\/g, "/").split("/").pop()!;
    const toPath = pathJoin(toParentPath, name);
    if (fromPath === toPath) return;
    await api.moveFile(fromPath, toPath);
    // Update editor tab if this file was open
    const { updateTab } = (await import("./editor.store")).useEditorStore.getState();
    updateTab(fromPath, toPath, name);
    // Refresh both parents
    const fromParent = parentDir(fromPath);
    await get().refreshNode(fromParent);
    if (toParentPath !== fromParent) await get().refreshNode(toParentPath);
  },

  deleteNode: async (nodePath: string) => {
    const api = getApi();
    if (!api) return;
    await api.deleteFile(nodePath);
    // Close tab if open
    const { closeTab } = (await import("./editor.store")).useEditorStore.getState();
    closeTab(nodePath); // tabId === path
    // Refresh parent
    await get().refreshNode(parentDir(nodePath));
  },

  renameNode: async (nodePath: string, newName: string) => {
    const api = getApi();
    if (!api) return;
    const parent = parentDir(nodePath);
    const newPath = pathJoin(parent, newName);
    await api.moveFile(nodePath, newPath);
    // Update editor tab
    const { updateTab } = (await import("./editor.store")).useEditorStore.getState();
    updateTab(nodePath, newPath, newName);
    await get().refreshNode(parent);
  },

  createFileNode: async (parentPath: string, name: string) => {
    const api = getApi();
    if (!api) return;
    await api.createFile(pathJoin(parentPath, name));
    await get().refreshNode(parentPath);
  },

  createFolderNode: async (parentPath: string, name: string) => {
    const api = getApi();
    if (!api) return;
    await api.createFolder(pathJoin(parentPath, name));
    await get().refreshNode(parentPath);
  },
}));
