const READING_PROGRESS_KEY = 'rag-reading-progress';

interface ReadingData {
  title: string;
  progress: number;
  lastOpened: number;
}

export function getReadingProgress(): Record<string, ReadingData> {
  try {
    return JSON.parse(localStorage.getItem(READING_PROGRESS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveReadingProgress(docId: string, data: { title: string; progress: number }) {
  const existing = getReadingProgress();
  existing[docId] = { ...data, lastOpened: Date.now() };
  localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(existing));
}
