"use client";

import { create } from "zustand";

export type SidebarView = "explorer" | "search";

interface WorkbenchState {
  activeSidebarView: SidebarView | null;
  setSidebarView: (view: SidebarView | null) => void;
  toggleSidebarView: (view: SidebarView) => void;
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  activeSidebarView: "explorer",

  setSidebarView: (view) => set({ activeSidebarView: view }),

  toggleSidebarView: (view) => {
    const { activeSidebarView } = get();
    set({
      activeSidebarView: activeSidebarView === view ? null : view,
    });
  },
}));
