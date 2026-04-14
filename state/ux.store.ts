"use client";

import { create } from "zustand";

const UX_SETTINGS_KEY = "revisor:ux-settings";

interface UXSettings {
  privacyBlur: boolean;
  fovealFocus: boolean;
  autoReadingMode: boolean;
  readingModeStartHour: number;
  progressiveDisclosure: boolean;
  contextTinting: boolean;
  microAudio: boolean;
  healthReminders: boolean;
}

const DEFAULT_SETTINGS: UXSettings = {
  privacyBlur: true,
  fovealFocus: true,
  autoReadingMode: false,
  readingModeStartHour: 20,
  progressiveDisclosure: false,
  contextTinting: false,
  microAudio: false,
  healthReminders: false,
};

function loadUXSettings(): UXSettings {
  try {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    const raw = localStorage.getItem(UX_SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persist(state: UXSettings) {
  try {
    localStorage.setItem(UX_SETTINGS_KEY, JSON.stringify(state));
  } catch {}
}

interface UXState extends UXSettings {
  setPrivacyBlur: (val: boolean) => void;
  setFovealFocus: (val: boolean) => void;
  setAutoReadingMode: (val: boolean) => void;
  setReadingModeStartHour: (hour: number) => void;
  setProgressiveDisclosure: (val: boolean) => void;
  setContextTinting: (val: boolean) => void;
  setMicroAudio: (val: boolean) => void;
  setHealthReminders: (val: boolean) => void;
}

export const useUXStore = create<UXState>((set, get) => ({
  ...loadUXSettings(),

  setPrivacyBlur: (val) => {
    set({ privacyBlur: val });
    persist({ ...get(), privacyBlur: val });
  },
  setFovealFocus: (val) => {
    set({ fovealFocus: val });
    persist({ ...get(), fovealFocus: val });
  },
  setAutoReadingMode: (val) => {
    set({ autoReadingMode: val });
    persist({ ...get(), autoReadingMode: val });
  },
  setReadingModeStartHour: (hour) => {
    set({ readingModeStartHour: hour });
    persist({ ...get(), readingModeStartHour: hour });
  },
  setProgressiveDisclosure: (val) => {
    set({ progressiveDisclosure: val });
    persist({ ...get(), progressiveDisclosure: val });
  },
  setContextTinting: (val) => {
    set({ contextTinting: val });
    persist({ ...get(), contextTinting: val });
  },
  setMicroAudio: (val) => {
    set({ microAudio: val });
    persist({ ...get(), microAudio: val });
  },
  setHealthReminders: (val) => {
    set({ healthReminders: val });
    persist({ ...get(), healthReminders: val });
  },
}));
