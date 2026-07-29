import api from './api';
import type {
  QueryRequest,
  QueryResponse,
  ConversationEntry,
  ConversationListResponse,
  SSEEvent,
} from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const QUERY_PATH = '/api/query';
const CONVERSATIONS_PATH = '/api/conversations';

export const chatService = {
  async query(data: QueryRequest): Promise<QueryResponse> {
    const response = await api.post<QueryResponse>(QUERY_PATH, data);
    return response.data;
  },

  streamQuery(
    question: string,
    k = 4,
    _filter: Record<string, unknown> | undefined,
    onEvent: (event: SSEEvent) => void,
    onDone: () => void,
    onError: (error: string) => void,
    signal?: AbortSignal,
  ): () => void {
    const params = new URLSearchParams({ question, k: String(k) });
    const url = `${API_BASE_URL}${QUERY_PATH}/stream?${params}`;

    const controller = new AbortController();
    const combinedSignal = signal
      ? (AbortSignal.any ? AbortSignal.any([signal, controller.signal]) : signal)
      : controller.signal;

    let cancelled = false;

    const cleanup = () => {
      cancelled = true;
      controller.abort();
    };

    const run = async () => {
      try {
        const token = localStorage.getItem('access_token') ?? '';
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          Accept: 'text/event-stream',
        };

        const res = await fetch(url, {
          headers,
          signal: combinedSignal,
        });

        if (!res.ok) {
          if (!cancelled) onError(`Request failed with status ${res.status}`);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          if (!cancelled) onError('No response body');
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6).trim();
            if (jsonStr === '[DONE]') {
              if (!cancelled) onDone();
              return;
            }
            try {
              const event = JSON.parse(jsonStr) as SSEEvent;
              if (event.type === 'done') {
                if (!cancelled) onDone();
                return;
              }
              if (!cancelled) onEvent(event);
            } catch {
              // skip malformed frames
            }
          }
        }

        if (!cancelled) onDone();
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Stream error';
          onError(msg);
        }
      }
    };

    run();
    return cleanup;
  },

  async listConversations(limit = 100): Promise<ConversationEntry[]> {
    const response = await api.get<ConversationListResponse>(
      `${CONVERSATIONS_PATH}?limit=${limit}`,
    );
    return response.data.conversations;
  },

  async deleteConversation(entryId: string): Promise<{ success: boolean }> {
    const response = await api.delete<{ success: boolean }>(
      `${CONVERSATIONS_PATH}/${entryId}`,
    );
    return response.data;
  },

  async clearConversations(): Promise<{ success: boolean }> {
    const response = await api.post<{ success: boolean }>(
      `${CONVERSATIONS_PATH}/clear`,
    );
    return response.data;
  },
};
