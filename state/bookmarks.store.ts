"use client";

import { create } from "zustand";
import type { Bookmark, BookmarksData } from "@/types/bookmarks";

function getApi() {
  if (typeof window !== "undefined" && "api" in window) return window.api;
  return null;
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function cancelPendingSave() {
  if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null; }
}

const EMPTY_STATE = {
  bookmarks:     [] as Bookmark[],
  isLoaded:      false,
  _revisionPath: null as string | null,
};

interface BookmarksState {
  bookmarks:     Bookmark[];
  isLoaded:      boolean;
  _revisionPath: string | null;

  loadBookmarks:   (revisionPath: string) => Promise<void>;
  unloadBookmarks: () => void;

  toggleBookmark:      (relativeFilePath: string, pageNumber: number) => void;
  updateBookmarkLabel: (id: string, label: string) => void;
  deleteBookmark:      (id: string) => void;
}

export const useBookmarksStore = create<BookmarksState>((set, get) => ({
  ...EMPTY_STATE,

  loadBookmarks: async (revisionPath) => {
    cancelPendingSave();
    set({ ...EMPTY_STATE });

    const api = getApi();
    if (!api || !api.revision) {
      set({ _revisionPath: revisionPath, isLoaded: true });
      return;
    }

    try {
      const raw  = await api.revision.loadStep(revisionPath, "bookmarks");
      const data = raw as BookmarksData | null;
      set({ _revisionPath: revisionPath, bookmarks: data?.bookmarks ?? [], isLoaded: true });
    } catch {
      set({ _revisionPath: revisionPath, isLoaded: true });
    }
  },

  unloadBookmarks: () => { cancelPendingSave(); set({ ...EMPTY_STATE }); },

  toggleBookmark: (relativeFilePath, pageNumber) => {
    const { bookmarks } = get();
    const existing = bookmarks.find(
      (b) => b.relativeFilePath === relativeFilePath && b.pageNumber === pageNumber,
    );
    if (existing) {
      set({ bookmarks: bookmarks.filter((b) => b.id !== existing.id) });
    } else {
      const newBookmark: Bookmark = {
        id: crypto.randomUUID(),
        relativeFilePath,
        pageNumber,
        label: "",
        createdAt: new Date().toISOString(),
      };
      set({ bookmarks: [...bookmarks, newBookmark] });
    }
    scheduleSave(get);
  },

  updateBookmarkLabel: (id, label) => {
    set((s) => ({ bookmarks: s.bookmarks.map((b) => b.id === id ? { ...b, label } : b) }));
    scheduleSave(get);
  },

  deleteBookmark: (id) => {
    set((s) => ({ bookmarks: s.bookmarks.filter((b) => b.id !== id) }));
    scheduleSave(get);
  },
}));

function scheduleSave(get: () => BookmarksState) {
  cancelPendingSave();
  saveTimeout = setTimeout(() => {
    const { _revisionPath, bookmarks } = get();
    const api = getApi();
    if (!_revisionPath || !api || !api.revision) return;
    const data: BookmarksData = { bookmarks, updatedAt: new Date().toISOString() };
    api.revision
      .saveStep(_revisionPath, "bookmarks", data)
      .catch((err: unknown) => console.error("[BOOKMARKS] saveStep:", err));
  }, 1000);
}
