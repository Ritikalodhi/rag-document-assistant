import { useState, useRef, useCallback } from 'react';
import { chatService } from '@/services/chat.service';
import type { Message, QueryContext, SSEEvent, ConfidenceScore } from '@/types';

/** Generate a unique message id */
let msgCounter = 0;
function msgId(prefix: string): string {
  msgCounter += 1;
  return `msg-${Date.now()}-${prefix}-${msgCounter}`;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback(
    async (question: string, filter?: Record<string, unknown>) => {
      // Abort any in-flight request
      abortRef.current?.();

      const userMsg: Message = {
        id: msgId('user'),
        role: 'user',
        content: question,
        timestamp: Date.now(),
      };

      const assistantId = msgId('assistant');
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      let fullContent = '';
      let finalContext: QueryContext[] | undefined;
      let finalConfidence: ConfidenceScore | undefined;
      let finalGrounded: boolean | undefined;
      let finalTrace: Record<string, unknown> | null | undefined;
      let streamError = false;

      abortRef.current = chatService.streamQuery(
        question,
        4,
        filter,
        (event: SSEEvent) => {
          switch (event.type) {
            case 'context':
              finalContext = event.context;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, context: event.context } : m,
                ),
              );
              break;

            case 'token':
              fullContent += event.content;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: fullContent } : m,
                ),
              );
              break;

            case 'error':
              streamError = true;
              fullContent = event.content;
              finalConfidence = event.confidence_score;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: event.content,
                        isStreaming: false,
                        confidence_score: event.confidence_score,
                      }
                    : m,
                ),
              );
              break;
          }
        },
        () => {
          if (!streamError) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      isStreaming: false,
                      context: finalContext ?? m.context,
                      confidence_score: finalConfidence ?? m.confidence_score,
                      grounded: finalGrounded ?? m.grounded,
                      retrieval_trace: finalTrace ?? m.retrieval_trace,
                    }
                  : m,
              ),
            );
          }
          setIsLoading(false);

          if (!finalConfidence || !finalTrace) {
            chatService
              .query({ question, k: 4, filter })
              .then((resp) => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? {
                          ...m,
                          context: resp.context,
                          confidence_score:
                            resp.confidence_score ?? m.confidence_score,
                          grounded: resp.grounded,
                          retrieval_trace: resp.retrieval_trace,
                        }
                      : m,
                  ),
                );
              })
              .catch(() => {});
          }
        },
        (error: string) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    isStreaming: false,
                    error: error.includes('401')
                      ? 'Session expired. Please log in again.'
                      : error.includes('Failed to fetch') ||
                          error.includes('NetworkError')
                        ? 'Connection lost. ' +
                          (m.content
                            ? 'Your message was partially delivered.'
                            : '')
                        : error,
                    content: m.content || error,
                  }
                : m,
            ),
          );
          setIsLoading(false);
        },
      );
    },
    [],
  );

  const abort = useCallback(() => {
    abortRef.current?.();
    setIsLoading(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.isStreaming ? { ...m, isStreaming: false, error: 'Aborted' } : m,
      ),
    );
  }, []);

  const retry = useCallback(
    (question: string, filter?: Record<string, unknown>) => {
      setMessages((prev) => {
        const idx = prev.length - 1;
        if (idx >= 0 && prev[idx]?.role === 'assistant' && prev[idx]?.error) {
          return prev.slice(0, -1);
        }
        return prev;
      });
      sendMessage(question, filter);
    },
    [sendMessage],
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.();
    setMessages([]);
  }, []);

  return { messages, isLoading, sendMessage, abort, retry, clearMessages };
}
