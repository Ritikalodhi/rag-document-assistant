const READING_PROGRESS_KEY = 'rag-reading-progress';

export interface ReadingData {
  title: string;
  progress: number;
  lastOpened: number;
  currentPage?: number;
  totalPages?: number;
  section?: string;
}

export function getReadingProgress(): Record<string, ReadingData> {
  try {
    return JSON.parse(localStorage.getItem(READING_PROGRESS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function saveReadingProgress(
  docId: string,
  data: {
    title: string;
    progress: number;
    currentPage?: number;
    totalPages?: number;
    section?: string;
  }
) {
  const existing = getReadingProgress();
  existing[docId] = { ...data, lastOpened: Date.now() };
  localStorage.setItem(READING_PROGRESS_KEY, JSON.stringify(existing));
}
