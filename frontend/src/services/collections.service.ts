import api from './api';

export interface Collection {
  collection_id: string;
  user_id: string;
  name: string;
  doc_ids: string[];
  created_at: string;
}

export interface CollectionDetail extends Collection {
  documents: Array<{
    doc_id: string;
    filename: string;
    uploaded_at: string;
    chunk_count: number;
  }>;
}

export interface CreateCollectionResponse {
  success: boolean;
  collection_id: string;
  name: string;
}

export interface CollectionListResponse {
  collections: Collection[];
}

export const collectionsService = {
  async list(): Promise<CollectionListResponse> {
    const response = await api.get<CollectionListResponse>('/api/collections');
    return response.data;
  },

  async get(collectionId: string): Promise<CollectionDetail> {
    const response = await api.get<CollectionDetail>(`/api/collections/${collectionId}`);
    return response.data;
  },

  async create(name: string): Promise<CreateCollectionResponse> {
    const response = await api.post<CreateCollectionResponse>('/api/collections', { name });
    return response.data;
  },

  async rename(collectionId: string, name: string): Promise<{ success: boolean }> {
    const response = await api.patch<{ success: boolean }>(`/api/collections/${collectionId}`, { name });
    return response.data;
  },

  async delete(collectionId: string): Promise<{ success: boolean; error?: string }> {
    const response = await api.delete<{ success: boolean; error?: string }>(`/api/collections/${collectionId}`);
    return response.data;
  },
};

