"use client";

import { create } from "zustand";
import type { SearchResult, FileNode } from "@/types/expediente";
import { getApi } from "@/lib/electron";

// ─── In-memory fallback search ────────────────────────────────────────────────

function searchInMemory(root: FileNode | null, query: string): SearchResult[] {
  if (!root || !query.trim()) return [];
  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  const scan = (node: FileNode) => {
    if (node.type !== "folder" && node.name.toLowerCase().includes(q)) {
      results.push({
        name: node.name,
        path: node.path,
        extension: node.type,
      });
    }
    node.children?.forEach(scan);
  };

  root.children?.forEach(scan);
  return results.slice(0, 100);
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface SearchState {
  query: string;
  results: SearchResult[];
  isSearching: boolean;
  /** Whether the SQLite index is ready */
  indexed: boolean;

  setQuery: (q: string) => void;
  search: (q: string, memoryRoot?: FileNode | null) => Promise<void>;
  setIndexed: (v: boolean) => void;
  clearResults: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  results: [],
  isSearching: false,
  indexed: false,

  setQuery: (q) => set({ query: q }),

  search: async (q: string, memoryRoot?: FileNode | null) => {
    if (!q.trim()) {
      set({ results: [], isSearching: false });
      return;
    }

    set({ isSearching: true });

    const api = getApi();
    const { indexed } = get();

    try {
      if (api && indexed) {
        // SQLite index search
        const results = await api.searchIndex(q);
        set({ results, isSearching: false });
      } else {
        // Fallback: in-memory scan
        const results = searchInMemory(memoryRoot ?? null, q);
        set({ results, isSearching: false });
      }
    } catch {
      set({ results: searchInMemory(memoryRoot ?? null, q), isSearching: false });
    }
  },

  setIndexed: (v) => set({ indexed: v }),
  clearResults: () => set({ results: [], query: "" }),
}));
