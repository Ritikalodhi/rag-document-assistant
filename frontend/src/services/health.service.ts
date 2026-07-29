import api from './api';

export interface HealthStatus {
  status: string;
  rag_initialized?: boolean;
}

export const healthService = {
  async check(): Promise<HealthStatus> {
    const response = await api.get<HealthStatus>('/api/health');
    return response.data;
  },
};
