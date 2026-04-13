"use client";

import { create } from "zustand";
import type { Tab, FileNode } from "@/types/expediente";

interface EditorState {
  tabs: Tab[];
  activeTabId: string | null;
  /** Per-file rotation for display only (0 | 90 | 180 | 270). Resets on app close. */
  pageRotations: Record<string, number>;

  openFile: (file: FileNode) => void;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  togglePin: (tabId: string) => void;
  /** Move tab from one index position to another (for drag reorder). */
  moveTab: (fromIndex: number, toIndex: number) => void;

  updateTab: (oldPath: string, newPath: string, newName: string) => void;
  /** Restore tabs from a previous session. */
  restoreTabs: (tabs: Tab[], activeTabId: string | null) => void;

  setPageRotation: (filePath: string, rotation: number) => void;

  // Derived
  activeTab: () => Tab | null;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  pageRotations: {},

  openFile: (file: FileNode) => {
    const { tabs } = get();
    const existingTab = tabs.find((t) => t.id === file.path);

    if (existingTab) {
      set({ activeTabId: existingTab.id });
      return;
    }

    const newTab: Tab = {
      id: file.path,
      name: file.name,
      path: file.path,
      type: file.type,
      isPreview: false,
      isPinned: false,
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
    const tab = tabs.find((t) => t.id === tabId);
    // Pinned tabs cannot be closed via normal close button
    if (tab?.isPinned) return;

    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;

    const next = tabs.filter((t) => t.id !== tabId);

    let nextActiveId = activeTabId;
    if (activeTabId === tabId) {
      nextActiveId = next[Math.max(0, idx - 1)]?.id ?? null;
    }

    set({ tabs: next, activeTabId: nextActiveId });
  },

  closeOtherTabs: (tabId: string) => {
    const { tabs, activeTabId } = get();
    // Keep pinned tabs + the target tab
    const next = tabs.filter((t) => t.isPinned || t.id === tabId);
    const newActive = next.find((t) => t.id === tabId)?.id ?? next[next.length - 1]?.id ?? null;
    set({ tabs: next, activeTabId: newActive });
  },

  closeTabsToRight: (tabId: string) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    // Keep everything up to and including this tab; never close pinned tabs to the right
    const next = tabs.filter((t, i) => i <= idx || t.isPinned);
    const newActive = next.find((t) => t.id === activeTabId)
      ? activeTabId
      : next[next.length - 1]?.id ?? null;
    set({ tabs: next, activeTabId: newActive });
  },

  closeAllTabs: () => {
    // Keep pinned tabs
    const { tabs } = get();
    const pinned = tabs.filter((t) => t.isPinned);
    set({ tabs: pinned, activeTabId: pinned[pinned.length - 1]?.id ?? null });
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId });
  },

  togglePin: (tabId: string) => {
    set((s) => {
      const tabs = s.tabs.map((t) =>
        t.id === tabId ? { ...t, isPinned: !t.isPinned } : t,
      );
      // Sort: pinned tabs first (preserve relative order within groups)
      const pinned   = tabs.filter((t) => t.isPinned);
      const unpinned = tabs.filter((t) => !t.isPinned);
      return { tabs: [...pinned, ...unpinned] };
    });
  },

  moveTab: (fromIndex: number, toIndex: number) => {
    set((s) => {
      if (fromIndex === toIndex) return s;
      const tabs = [...s.tabs];
      const [moved] = tabs.splice(fromIndex, 1);
      tabs.splice(toIndex, 0, moved);
      return { tabs };
    });
  },

  restoreTabs: (tabs: Tab[], activeTabId: string | null) => {
    set({ tabs, activeTabId });
  },

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

  setPageRotation: (filePath: string, rotation: number) => {
    set((s) => ({
      pageRotations: { ...s.pageRotations, [filePath]: ((rotation % 360) + 360) % 360 },
    }));
  },

  activeTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId) ?? null;
  },
}));
