/**
 * Detect whether the renderer is running inside Electron.
 * Must only be called client-side (e.g. inside useEffect or event handlers).
 */
export const isElectron = (): boolean =>
  typeof window !== "undefined" && "api" in window;

/**
 * Returns the Electron API or null when running in a plain browser.
 */
export const getApi = (): Window["api"] | null =>
  isElectron() ? window.api : null;
