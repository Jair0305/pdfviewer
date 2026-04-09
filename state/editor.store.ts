"use client";

import { create } from "zustand";
import type { Tab, FileNode } from "@/types/expediente";

interface EditorState {
  tabs: Tab[];
  activeTabId: string | null;

  openFile: (file: FileNode) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  closeAllTabs: () => void;

  updateTab: (oldPath: string, newPath: string, newName: string) => void;

  // Derived
  activeTab: () => Tab | null;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openFile: (file: FileNode) => {
    const { tabs } = get();
    const existingTab = tabs.find((t) => t.id === file.path);

    if (existingTab) {
      // Already open — just focus
      set({ activeTabId: existingTab.id });
      return;
    }

    const newTab: Tab = {
      id: file.path,
      name: file.name,
      path: file.path,
      type: file.type,
      isPreview: false,
      loaded: true,
    };

    // Replace a preview tab if it exists, else append
    const previewIndex = tabs.findIndex((t) => t.isPreview);
    if (previewIndex !== -1) {
      const next = [...tabs];
      next[previewIndex] = newTab;
      set({ tabs: next, activeTabId: newTab.id });
    } else {
      set({ tabs: [...tabs, newTab], activeTabId: newTab.id });
    }
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;

    const next = tabs.filter((t) => t.id !== tabId);

    let nextActiveId = activeTabId;
    if (activeTabId === tabId) {
      // Focus the tab to the left, or right if at start
      nextActiveId = next[Math.max(0, idx - 1)]?.id ?? null;
    }

    set({ tabs: next, activeTabId: nextActiveId });
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId });
  },

  closeAllTabs: () => set({ tabs: [], activeTabId: null }),

  updateTab: (oldPath: string, newPath: string, newName: string) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === oldPath
          ? { ...t, id: newPath, path: newPath, name: newName }
          : t,
      ),
      activeTabId: s.activeTabId === oldPath ? newPath : s.activeTabId,
    }));
  },

  activeTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId) ?? null;
  },
}));
