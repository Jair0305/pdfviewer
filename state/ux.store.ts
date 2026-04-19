"use client";

import { create } from "zustand";

const UX_SETTINGS_KEY = "revisor:ux-settings";
const USAGE_HISTORY_KEY = "revisor:usage-history";

interface UsageHistory {
  firstUse: string;
  daily: Record<string, number>;
}

interface UXSettings {
  privacyBlur: boolean;
  fovealFocus: boolean;
  autoReadingMode: boolean;
  readingModeStartHour: number;
  progressiveDisclosure: boolean;
  contextTinting: boolean;
  microAudio: boolean;
  healthReminders: boolean;
  sessionTimer: boolean;
  dailyLimitEnabled: boolean;
  dailyLimitMinutes: number; // total limit in minutes (e.g. 90 = 1h 30m)
  totalDailyTime: number; // in seconds
  lastSessionReset: string;
  zenMode: boolean;
  bionicReading: boolean;
  lighthouseMode: boolean;
  ambientSound: 'none' | 'rain' | 'white' | 'cafe';
  eyePulse: boolean;
  readingMode: boolean;
  usageHistory: UsageHistory;
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
  sessionTimer: true,
  dailyLimitEnabled: false,
  dailyLimitMinutes: 240,
  totalDailyTime: 0,
  lastSessionReset: new Date().toISOString(),
  zenMode: false,
  bionicReading: false,
  lighthouseMode: false,
  ambientSound: 'none',
  eyePulse: true,
  readingMode: false,
  usageHistory: { firstUse: new Date().toISOString(), daily: {} },
};

function loadUsageHistory(): UsageHistory {
  try {
    if (typeof window === "undefined") return { firstUse: new Date().toISOString(), daily: {} };
    const raw = localStorage.getItem(USAGE_HISTORY_KEY);
    return raw ? JSON.parse(raw) : { firstUse: new Date().toISOString(), daily: {} };
  } catch {
    return { firstUse: new Date().toISOString(), daily: {} };
  }
}

function persistUsageHistory(history: UsageHistory) {
  try { localStorage.setItem(USAGE_HISTORY_KEY, JSON.stringify(history)); } catch {}
}

function loadUXSettings(): UXSettings {
  try {
    if (typeof window === "undefined") return { ...DEFAULT_SETTINGS, usageHistory: loadUsageHistory() };
    const raw = localStorage.getItem(UX_SETTINGS_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return { ...DEFAULT_SETTINGS, ...saved, usageHistory: loadUsageHistory() };
  } catch {
    return { ...DEFAULT_SETTINGS, usageHistory: loadUsageHistory() };
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
  setSessionTimer: (val: boolean) => void;
  setZenMode: (val: boolean) => void;
  setBionicReading: (val: boolean) => void;
  setLighthouseMode: (val: boolean) => void;
  setAmbientSound: (val: 'none' | 'rain' | 'white' | 'cafe') => void;
  setEyePulse: (val: boolean) => void;
  setReadingMode: (val: boolean) => void;
  setDailyLimitEnabled: (val: boolean) => void;
  setDailyLimitMinutes: (val: number) => void;
  addTime: (seconds: number) => void;
  resetTotalTime: () => void;
  /** Unlock for today: resets the accumulated daily time to 0 */
  unlockSession: () => void;
  setUsageHistory: (h: UsageHistory) => void;
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
  setSessionTimer: (val) => {
    set({ sessionTimer: val });
    persist({ ...get(), sessionTimer: val });
  },
  setZenMode: (val) => {
    set({ zenMode: val });
    persist({ ...get(), zenMode: val });
  },
  setBionicReading: (val) => {
    set({ bionicReading: val });
    persist({ ...get(), bionicReading: val });
  },
  setLighthouseMode: (val) => {
    set({ lighthouseMode: val });
    persist({ ...get(), lighthouseMode: val });
  },
  setAmbientSound: (val) => {
    set({ ambientSound: val });
    persist({ ...get(), ambientSound: val });
  },
  setEyePulse: (val) => {
    set({ eyePulse: val });
    persist({ ...get(), eyePulse: val });
  },
  setReadingMode: (val) => {
    set({ readingMode: val });
    persist({ ...get(), readingMode: val });
  },
  setDailyLimitEnabled: (val) => {
    set({ dailyLimitEnabled: val });
    persist({ ...get(), dailyLimitEnabled: val });
  },
  setDailyLimitMinutes: (val) => {
    set({ dailyLimitMinutes: val });
    persist({ ...get(), dailyLimitMinutes: val });
  },
  addTime: (seconds) => {
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const prev = get();
    const next = prev.totalDailyTime + seconds;
    const dailyPrev = prev.usageHistory.daily[today] ?? 0;
    const newHistory: UsageHistory = {
      ...prev.usageHistory,
      daily: { ...prev.usageHistory.daily, [today]: dailyPrev + seconds },
    };
    set({ totalDailyTime: next, usageHistory: newHistory });
    persist({ ...get(), totalDailyTime: next, usageHistory: newHistory });
    persistUsageHistory(newHistory);
  },
  resetTotalTime: () => {
    const reset = new Date().toISOString();
    set({ totalDailyTime: 0, lastSessionReset: reset });
    persist({ ...get(), totalDailyTime: 0, lastSessionReset: reset });
  },
  unlockSession: () => {
    const reset = new Date().toISOString();
    set({ totalDailyTime: 0, lastSessionReset: reset });
    persist({ ...get(), totalDailyTime: 0, lastSessionReset: reset });
  },
  setUsageHistory: (h) => {
    set({ usageHistory: h });
    persistUsageHistory(h);
  },
}));
