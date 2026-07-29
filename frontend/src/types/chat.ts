export interface QueryRequest {
  question: string;
  k?: number;
  filter?: Record<string, unknown>;
}

export interface QueryContext {
  content: string;
  source: string;
  confidence_percent?: number;
  page?: number | null;
}

export interface ConfidenceScore {
  retrieval_confidence: number;
  answer_completeness: number;
  source_coverage: number;
  composite_score: number;
  completeness_reason: string;
  grade: string;
}

export interface QueryResponse {
  question: string;
  answer: string;
  context: QueryContext[];
  retrieval_trace: Record<string, unknown> | null;
  confidence_score: ConfidenceScore | null;
  grounded: boolean;
  success: boolean;
}

export interface SSEContextEvent {
  type: 'context';
  context: QueryContext[];
}

export interface SSETokenEvent {
  type: 'token';
  content: string;
}

export interface SSEErrorEvent {
  type: 'error';
  content: string;
  confidence_score?: ConfidenceScore;
  retrieval_mode?: string;
  rewritten_query?: string;
}

export interface SSEDoneEvent {
  type: 'done';
}

export type SSEEvent = SSEContextEvent | SSETokenEvent | SSEErrorEvent | SSEDoneEvent;

export interface ConversationEntry {
  id: string;
  question: string;
  answer: string;
  context?: QueryContext[];
  confidence_score?: ConfidenceScore;
  grounded?: boolean;
  created_at: string;
}

export interface ConversationListResponse {
  conversations: ConversationEntry[];
  count: number;
}

export interface MessageConfidence {
  score: number;
  grade: string;
  composite_score: number;
  grounded?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  context?: QueryContext[];
  confidence_score?: ConfidenceScore;
  grounded?: boolean;
  retrieval_trace?: Record<string, unknown> | null;
  timestamp: number;
  isStreaming?: boolean;
  error?: string;
}
