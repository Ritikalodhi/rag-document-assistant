/**
 * Tracks which documents have had study notes generated, per device.
 * Used by the dashboard Workspace Overview "Study Notes" stat.
 * Mirrors the localStorage pattern used by readingProgress.ts.
 */
const KEY = 'aperture_notes_generated';

export function recordNotesGenerated(docId: string): void {
  if (!docId) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    const set = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    set.add(docId);
    window.localStorage.setItem(KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* localStorage unavailable — ignore */
  }
}

export function getNotesGeneratedCount(): number {
  try {
    const raw = window.localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(list) ? list.length : 0;
  } catch {
    return 0;
  }
}
