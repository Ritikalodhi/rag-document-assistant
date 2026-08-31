const KEY = 'lastViewedDocId';

/** Remember the most recently viewed document so general chat can
 *  default to scoping questions to it instead of searching every
 *  document the user has uploaded. */
export function setLastViewedDocId(docId: string): void {
  try {
    localStorage.setItem(KEY, docId);
  } catch {
    // localStorage unavailable (private mode, etc.) - fail silently
  }
}

export function getLastViewedDocId(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function clearLastViewedDocId(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}