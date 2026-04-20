"use client";

import { create } from "zustand";
import type { FileNode } from "@/types/expediente";

export type SidebarView = "explorer" | "search" | "settings";
export type RightPanelTab = "cuestionario" | "anotaciones" | "citas" | "sintesis" | "bookmarks";

// ─── Pane toolbar state (reactive — PdfViewer syncs here) ─────────────────────

export interface PaneDisplayState {
  file: FileNode | null;
  currentPage: number;
  numPages: number;
  scale: number;
  rotation: number;
  galleryMode: boolean;
  showSearch: boolean;
  showThumbs: boolean;
}

const DEFAULT_PANE: PaneDisplayState = {
  file: null,
  currentPage: 1,
  numPages: 0,
  scale: 1.0,
  rotation: 0,
  galleryMode: false,
  showSearch: false,
  showThumbs: true,
};

// ─── Pane actions (non-reactive — registered by PdfViewer) ────────────────────

export interface PaneActions {
  goToPage:           (page: number) => void;
  zoomIn:             () => void;
  zoomOut:            () => void;
  fitPage:            () => void;
  rotateLeft:         () => void;
  rotateRight:        () => void;
  resetRotation:      () => void;
  toggleGallery:      () => void;
  toggleSearch:       () => void;
  toggleThumbs:       () => void;
  toggleReadingMode:  () => void;
  openInSplit:        () => void;
}

// ─── Store interface ──────────────────────────────────────────────────────────

interface WorkbenchState {
  activeSidebarView: SidebarView | null;
  setSidebarView: (view: SidebarView | null) => void;
  toggleSidebarView: (view: SidebarView) => void;

  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  rightPanelTab:  RightPanelTab;
  rightPanelOpen: boolean;
  setRightPanelTab:  (tab: RightPanelTab) => void;
  openRightPanelTab: (tab: RightPanelTab) => void; // sets tab AND opens panel
  setRightPanelOpen: (open: boolean) => void;

  splitFile: FileNode | null;
  setSplitFile: (file: FileNode | null) => void;

  focusedPane: "left" | "right";
  setFocusedPane: (pane: "left" | "right") => void;

  /** Synchronized scroll — direct DOM manipulation for zero latency. */
  syncScroll: boolean;
  setSyncScroll: (val: boolean) => void;
  /** Raw DOM scroll containers — mutated in place, never trigger re-renders. */
  _scrollEls: { left: HTMLDivElement | null; right: HTMLDivElement | null };
  registerScrollEl: (pane: "left" | "right", el: HTMLDivElement | null) => void;

  /** Reactive display state per pane — PdfViewer writes, PdfToolbar reads. */
  paneState: { left: PaneDisplayState; right: PaneDisplayState };
  setPaneState: (pane: "left" | "right", updates: Partial<PaneDisplayState>) => void;

  /** Non-reactive action callbacks — mutated in place by PdfViewer. */
  _paneActions: { left: PaneActions | null; right: PaneActions | null };
  registerPaneActions: (pane: "left" | "right", actions: PaneActions | null) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  activeSidebarView: "explorer",
  setSidebarView:    (view) => set({ activeSidebarView: view }),
  toggleSidebarView: (view) => {
    const { activeSidebarView } = get();
    set({ activeSidebarView: activeSidebarView === view ? null : view });
  },

  settingsOpen: false,
  setSettingsOpen: (open) => set({ settingsOpen: open }),

  shortcutsOpen: false,
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),

  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  rightPanelTab:     "cuestionario",
  rightPanelOpen:    true,
  setRightPanelTab:  (tab) => set({ rightPanelTab: tab }),
  openRightPanelTab: (tab) => set({ rightPanelTab: tab, rightPanelOpen: true }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

  splitFile:    null,
  setSplitFile: (file) => set({ splitFile: file }),

  focusedPane:    "left",
  setFocusedPane: (pane) => set({ focusedPane: pane }),

  syncScroll:    false,
  setSyncScroll: (val) => set({ syncScroll: val }),

  _scrollEls: { left: null, right: null },
  registerScrollEl: (pane, el) => {
    get()._scrollEls[pane] = el; // mutate in place — intentionally non-reactive
  },

  paneState: { left: { ...DEFAULT_PANE }, right: { ...DEFAULT_PANE } },
  setPaneState: (pane, updates) =>
    set((s) => ({
      paneState: {
        ...s.paneState,
        [pane]: { ...s.paneState[pane], ...updates },
      },
    })),

  _paneActions: { left: null, right: null },
  registerPaneActions: (pane, actions) => {
    get()._paneActions[pane] = actions; // mutate in place — intentionally non-reactive
  },
}));
