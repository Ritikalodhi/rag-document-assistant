export interface QueryRequest {
  question: string;
  k?: number;
  filter?: Record<string, unknown>;
  conversation_id?: string;
}

export interface QueryContext {
  content: string;
  source: string;
  /** How relevant this chunk is to the query (0-100). NOT answer confidence. */
  retrieval_relevance?: number;
  /** Legacy alias of retrieval_relevance, kept for backward compatibility. */
  confidence_percent?: number;
  page?: number | null;
}

export interface ConfidenceScore {
  /** New, semantically-correct fields */
  retrieval_relevance?: number;
  answer_confidence?: number;
  answer_completeness?: number;
  grounding_score?: number;
  /** Legacy fields preserved for backward compatibility */
  retrieval_confidence: number;
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
  conversation_id?: string;
  confidence_score?: ConfidenceScore;
  retrieval_trace?: Record<string, unknown>;
}

export type SSEEvent = SSEContextEvent | SSETokenEvent | SSEErrorEvent | SSEDoneEvent;

export interface ConversationEntry {
  id: string;
  title: string;
  messages: Message[];
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
