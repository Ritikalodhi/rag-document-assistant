import api from './api';
import type {
  DocumentListResponse,
  UploadResponse,
  AsyncJobResponse,
  AsyncJobStatus,
  DocumentSummary,
  SuggestedQuestions,
  StudyNotes,
  DocumentMetadata,
  DocumentVersion,
  TableData,
} from '@/types';

const DOC_PATH = '/api/documents';
const UPLOAD_PATH = '/api/upload';

export interface ComparisonResult {
  success: boolean;
  document_a: string;
  document_b: string;
  comparison: {
    matching_points: string[];
    missing_in_a: string[];
    missing_in_b: string[];
    recommendations: string[];
    overall_match_percent: number;
  } | null;
  error: string | null;
}

export interface SharedConcept {
  concept: string;
  found_in: string[];
  relevance: string;
}

export interface CrossAnalysisSuccess {
  shared_concepts: SharedConcept[];
  document_count: number;
}

export interface CrossAnalysisError {
  success: false;
  error: string;
}

export type CrossAnalysisResult = CrossAnalysisSuccess | CrossAnalysisError;

export const documentsService = {
  async list(): Promise<DocumentListResponse> {
    const response = await api.get<DocumentListResponse>(DOC_PATH);
    return response.data;
  },

  async getMetadata(docId: string): Promise<DocumentMetadata> {
    const response = await api.get<DocumentMetadata>(`${DOC_PATH}/${docId}`);
    return response.data;
  },

  async delete(docId: string): Promise<{ success: boolean }> {
    const response = await api.delete<{ success: boolean }>(`${DOC_PATH}/${docId}`);
    return response.data;
  },

  async upload(file: File, collectionId?: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (collectionId) {
      formData.append('collection_id', collectionId);
    }
    const response = await api.post<UploadResponse>(UPLOAD_PATH, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async uploadAsync(file: File, collectionId?: string): Promise<AsyncJobResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (collectionId) {
      formData.append('collection_id', collectionId);
    }
    const response = await api.post<AsyncJobResponse>(`${UPLOAD_PATH}/async`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async getAsyncJobStatus(jobId: string): Promise<AsyncJobStatus> {
    const response = await api.get<AsyncJobStatus>(`${UPLOAD_PATH}/async/${jobId}`);
    return response.data;
  },

  async summarize(docId: string): Promise<DocumentSummary> {
    const response = await api.post<DocumentSummary>(`${DOC_PATH}/${docId}/summarize`);
    return response.data;
  },

  async getSuggestedQuestions(docId: string): Promise<SuggestedQuestions> {
    const response = await api.get<SuggestedQuestions>(`${DOC_PATH}/${docId}/suggested-questions`);
    return response.data;
  },

  async getStudyNotes(docId: string): Promise<StudyNotes> {
    const response = await api.get<StudyNotes>(`${DOC_PATH}/${docId}/study-notes`);
    return response.data;
  },

  async getTables(docId: string): Promise<{ tables: TableData[] }> {
    const response = await api.get<{ tables: TableData[] }>(`${DOC_PATH}/${docId}/tables`);
    return response.data;
  },

  async getVersions(docId: string): Promise<{ versions: DocumentVersion[] }> {
    const response = await api.get<{ versions: DocumentVersion[] }>(`${DOC_PATH}/${docId}/versions`);
    return response.data;
  },

  async compare(docA: string, docB: string): Promise<ComparisonResult> {
    const response = await api.post<ComparisonResult>(`${DOC_PATH}/compare`, {
      document_a: docA,
      document_b: docB,
    });
    return response.data;
  },

  async crossAnalysis(docIds: string[]): Promise<CrossAnalysisResult> {
    const response = await api.post<CrossAnalysisResult>(`${DOC_PATH}/cross-analysis`, {
      doc_ids: docIds,
    });
    return response.data;
  },
};
