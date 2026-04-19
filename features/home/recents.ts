export interface RecentExpediente {
  path:         string;
  name:         string;
  lastOpenedAt: string; // ISO
}

const KEY      = "revisor:recents";
const MAX      = 8;

export function loadRecents(): RecentExpediente[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RecentExpediente[]) : [];
  } catch { return []; }
}

export function pushRecent(path: string, name: string): void {
  try {
    const existing = loadRecents().filter((r) => r.path !== path);
    const updated: RecentExpediente[] = [
      { path, name, lastOpenedAt: new Date().toISOString() },
      ...existing,
    ].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {}
}
