import api from './api';

export interface AnalyticsData {
  total_documents: number;
  total_chunks: number;
  bm25_indexed_chunks: number;
  retrieval_mode: string;
  total_queries: number;
  queries_today: number;
  most_queried_document: string | null;
  documents_summarized: number;
  [key: string]: unknown;
}

export interface ServerInfo {
  status: string;
  message: string;
  version: string;
}

export interface StatsData {
  collection_name: string;
  document_count: number;
  persist_dir: string;
  bm25_docs: number;
}

export const analyticsService = {
  async get(): Promise<AnalyticsData> {
    const response = await api.get<AnalyticsData>('/api/analytics');
    return response.data;
  },

  async getServerInfo(): Promise<ServerInfo> {
    const response = await api.get<ServerInfo>('/');
    return response.data;
  },

  async getStats(): Promise<StatsData> {
    const response = await api.get<StatsData>('/api/stats');
    return response.data;
  },
};

