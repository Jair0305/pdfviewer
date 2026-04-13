"use client";

import { create } from "zustand";

const SETTINGS_KEY = "revisor:settings";

interface PersistedSettings {
  /**
   * Root of the Clientes Dropbox folder.
   * Used to compute the stable relative path for revision mirroring.
   * Example: "/Users/jair/Dropbox/Clientes"
   */
  clientesFolder: string | null;
  /**
   * Root of the team's Revisiones Dropbox folder.
   * Revision JSON files are written here, mirroring the Clientes structure.
   * Example: "/Users/jair/Dropbox/Revisiones"
   */
  revisionesFolder: string | null;
}

function loadSettings(): PersistedSettings {
  try {
    if (typeof window === "undefined") return { clientesFolder: null, revisionesFolder: null };
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw
      ? (JSON.parse(raw) as PersistedSettings)
      : { clientesFolder: null, revisionesFolder: null };
  } catch {
    return { clientesFolder: null, revisionesFolder: null };
  }
}

function persist(state: PersistedSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

interface SettingsState extends PersistedSettings {
  setClientesFolder: (path: string | null) => void;
  setRevisionesFolder: (path: string | null) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadSettings(),

  setClientesFolder: (path) => {
    set({ clientesFolder: path });
    persist({ clientesFolder: path, revisionesFolder: get().revisionesFolder });
  },

  setRevisionesFolder: (path) => {
    set({ revisionesFolder: path });
    persist({ clientesFolder: get().clientesFolder, revisionesFolder: path });
  },
}));
