export interface Document {
  doc_id: string;
  user_id: string;
  filename: string;
  file_path: string;
  chunk_count: number;
  summary: object | null;
  uploaded_at: string;
}

export interface DocumentListResponse {
  documents: Document[];
}

export interface UploadResponse {
  filename: string;
  success: boolean;
  message: string;
  chunks: number;
  doc_id: string;
  collection_id?: string;
}

export interface AsyncJobResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface AsyncJobStatus {
  job_id: string;
  status: string;
  stage: string;
  progress: number;
  filename?: string;
  collection_id?: string;
  result?: {
    doc_id?: string;
    chunks?: number;
  };
  error?: string;
}

export interface DocumentSummary {
  success: boolean;
  filename: string;
  summary: {
    executive_summary: string;
    key_topics: string[];
    key_takeaways: string[];
    important_entities: string[];
  } | null;
  cached: boolean;
  error?: string;
}

export interface SuggestedQuestions {
  success: boolean;
  filename: string;
  questions: string[];
}

export interface StudyNotes {
  success: boolean;
  filename: string;
  summary: string;
  key_concepts: KeyConcept[];
  flashcards: Flashcard[];
  viva_questions: VivaQuestion[];
  mcqs: MCQ[];
  counts: StudyNotesCounts;
}

export interface KeyConcept {
  concept: string;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface VivaQuestion {
  question: string;
  answer: string;
}

export interface MCQ {
  question: string;
  options: string[];
  correct: string;
}

export interface StudyNotesCounts {
  key_concepts: number;
  flashcards: number;
  viva_questions: number;
  mcqs: number;
}

export interface TableData {
  id: string;
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface DocumentVersion {
  version: number;
  doc_id: string;
  content_hash: string;
  char_count: number;
  uploaded_at: string;
}

export interface DocumentMetadata {
  doc_id: string;
  user_id?: string;
  filename: string;
  file_path: string;
  chunk_count: number;
  uploaded_at: string;
  full_text?: string;
  summary?: object | null;
}
