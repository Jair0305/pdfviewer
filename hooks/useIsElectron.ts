"use client";

import { useState, useEffect } from "react";
import { isElectron } from "@/lib/electron";

/**
 * Returns true only after mount, when we know we're inside Electron.
 * Safe to use in RSC/SSR contexts — always returns false on server,
 * preventing React hydration mismatches.
 */
export function useIsElectron(): boolean {
  const [electron, setElectron] = useState(false);
  useEffect(() => {
    setElectron(isElectron());
  }, []);
  return electron;
}
