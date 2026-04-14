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
  sessionTimer: boolean;
  dailyLimitEnabled: boolean;
  dailyLimitHours: number;
  totalDailyTime: number; // in seconds
  lastSessionReset: string;
  zenMode: boolean;
  bionicReading: boolean;
  lighthouseMode: boolean;
  ambientSound: 'none' | 'rain' | 'white' | 'cafe';
  eyePulse: boolean;
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
  dailyLimitHours: 4,
  totalDailyTime: 0,
  lastSessionReset: new Date().toISOString(),
  zenMode: false,
  bionicReading: false,
  lighthouseMode: false,
  ambientSound: 'none',
  eyePulse: true,
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
  setSessionTimer: (val: boolean) => void;
  setZenMode: (val: boolean) => void;
  setBionicReading: (val: boolean) => void;
  setLighthouseMode: (val: boolean) => void;
  setAmbientSound: (val: 'none' | 'rain' | 'white' | 'cafe') => void;
  setEyePulse: (val: boolean) => void;
  setDailyLimitEnabled: (val: boolean) => void;
  setDailyLimitHours: (val: number) => void;
  addTime: (seconds: number) => void;
  resetTotalTime: () => void;
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
  setDailyLimitEnabled: (val) => {
    set({ dailyLimitEnabled: val });
    persist({ ...get(), dailyLimitEnabled: val });
  },
  setDailyLimitHours: (val) => {
    set({ dailyLimitHours: val });
    persist({ ...get(), dailyLimitHours: val });
  },
  addTime: (seconds) => {
    const next = get().totalDailyTime + seconds;
    set({ totalDailyTime: next });
    persist({ ...get(), totalDailyTime: next });
  },
  resetTotalTime: () => {
    const reset = new Date().toISOString();
    set({ totalDailyTime: 0, lastSessionReset: reset });
    persist({ ...get(), totalDailyTime: 0, lastSessionReset: reset });
  },
}));
