import { useState, type ReactNode } from 'react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SourceCards } from './SourceCards';
import { Button } from '@/components/ui';
import type { Message, QueryContext } from '@/types';

interface MessageBubbleProps {
  message: Message;
  onOpenSources: (sources: QueryContext[], index: number) => void;
  onToggleTrace: (id: string | null) => void;
  showTrace: boolean;
  onRetry: () => void;
}

export function MessageBubble({
  message,
  onOpenSources,
  onToggleTrace,
  showTrace,
  onRetry,
}: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end my-2">
        <div className="max-w-[80%] sm:max-w-[70%] px-4 py-3 rounded-[14px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] shadow-sm">
          <p className="text-[14px] text-[rgb(var(--color-text))] leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  const [sourcesExpanded, setSourcesExpanded] = useState(false);

  return (
    <div className="flex flex-col gap-3.5 my-4">
      {/* Assistant header: AI Sparkle + Brand Name + Confidence */}
      <div className="flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-[6px] bg-[rgb(var(--color-accent))] flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <span className="text-[13px] font-medium text-[rgb(var(--color-text-secondary))]">Aperture</span>
        {(message.confidence_score || message.grounded !== undefined) && (
          <>
            <span className="text-[rgb(var(--color-border))] text-[12px]">·</span>
            <ConfidenceBadge
              grade={message.confidence_score?.grade}
              compositeScore={message.confidence_score?.composite_score}
              grounded={message.grounded}
            />
          </>
        )}
      </div>

      {/* Answer content (prose, not in a giant chat bubble) */}
      <div className="max-w-full text-[14px] leading-relaxed text-[rgb(var(--color-text))]">
        {message.isStreaming && !message.content ? (
          <div className="flex items-center gap-2 text-[rgb(var(--color-text-secondary))] py-1">
            <span className="w-2 h-2 rounded-full bg-[rgb(var(--color-accent))] animate-ping" />
            <span className="text-[13px]">Searching documents...</span>
          </div>
        ) : (
          <>
            <MarkdownRenderer content={message.content} />
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-1 bg-[rgb(var(--color-accent))] animate-pulse align-middle" />
            )}
          </>
        )}
      </div>

      {/* Error state */}
      {message.error && !message.isStreaming && (
        <div className="flex flex-col gap-2.5 p-3.5 rounded-[8px] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
          <p className="text-[13px] text-red-700 dark:text-red-400">{message.error}</p>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={onRetry}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Citation chips */}
      {message.context && message.context.length > 0 && !message.isStreaming && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1" role="list" aria-label="Sources">
          <span className="text-[11px] font-medium text-[rgb(var(--color-text-tertiary))] uppercase tracking-wider mr-1">Sources:</span>
          {message.context.map((source, i) => (
            <button
              key={i}
              onClick={() => onOpenSources(message.context ?? [], i)}
              className="inline-flex items-center justify-center h-6 min-w-[24px] px-1.5 rounded-[5px] text-[11px] font-code font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent))] hover:text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent-muted))] transition-colors"
              title={source.source}
              role="listitem"
              aria-label={`Source ${i + 1}: ${source.source}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* "How I found this" section */}
      {message.context && message.context.length > 0 && !message.isStreaming && (
        <div className="border-t border-[rgb(var(--color-border))] pt-2.5 mt-1">
          <button
            onClick={() => setSourcesExpanded(!sourcesExpanded)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[rgb(var(--color-surface))]/50 hover:bg-[rgb(var(--color-surface))] text-[12px] font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] transition-colors border border-[rgb(var(--color-border))] w-full sm:w-auto"
            aria-expanded={sourcesExpanded}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform duration-150 ${sourcesExpanded ? 'rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span>How I found this</span>
            <span className="text-[11px] text-[rgb(var(--color-text-tertiary))]">
              · {message.context.length} chunk{message.context.length !== 1 ? 's' : ''}
            </span>
          </button>

          {sourcesExpanded && (
            <div className="mt-3">
              <SourceCards
                context={message.context}
                onOpenSource={onOpenSources}
              />
            </div>
          )}
        </div>
      )}

      {/* Advanced retrieval trace */}
      {message.retrieval_trace && !message.isStreaming && (
        <div className="pt-1">
          <button
            onClick={() => onToggleTrace(showTrace ? null : message.id)}
            className="text-[11px] font-code text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-secondary))] transition-colors"
            aria-expanded={showTrace}
            aria-controls={`trace-${message.id}`}
          >
            {showTrace ? 'Hide' : 'Show'} Advanced Trace
          </button>
          {showTrace && (
            <div
              id={`trace-${message.id}`}
              className="mt-2 p-3 rounded-[8px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]"
            >
              <GenericObjectView data={message.retrieval_trace} depth={0} />
            </div>
          )}
        </div>
      )}

      {/* Action buttons (Copy, Regenerate, Disabled Bookmark & Export) */}
      {!message.isStreaming && !message.error && message.content && (
        <div className="flex items-center gap-1.5 pt-1">
          <button
            onClick={() => navigator.clipboard.writeText(message.content).catch(() => {})}
            className="btn-ghost"
            aria-label="Copy answer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Copy</span>
          </button>

          <button
            onClick={onRetry}
            className="btn-ghost"
            aria-label="Regenerate answer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Regenerate</span>
          </button>

          {/* Non-functional placeholder controls disabled per rules */}
          <button
            disabled
            className="btn-ghost opacity-40 cursor-not-allowed hidden sm:inline-flex"
            title="Coming soon"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span>Bookmark</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Generic recursive key/value inspector ─── */
function GenericObjectView({ data, depth }: { data: Record<string, unknown>; depth: number }) {
  if (depth > 4) return <span className="text-[11px] text-[rgb(var(--color-text-tertiary))]">[depth limit]</span>;

  return (
    <div className="flex flex-col gap-1 font-code text-[12px]">
      {Object.entries(data).map(([key, value]) => (
        <div key={key} className="flex items-start gap-2">
          <span className="text-[rgb(var(--color-accent))] flex-shrink-0">{key}:</span>
          <span className="text-[rgb(var(--color-text))] break-all">
            {renderValue(value, depth + 1)}
          </span>
        </div>
      ))}
    </div>
  );
}

function renderValue(value: unknown, depth: number): ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-[rgb(var(--color-text-tertiary))]">null</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[rgb(var(--color-text-tertiary))]">[]</span>;
    return (
      <div className="flex flex-col gap-1 pl-3 border-l border-[rgb(var(--color-border))]">
        {value.map((item, i) => (
          <div key={i} className="flex items-start gap-1">
            <span className="text-[rgb(var(--color-text-tertiary))]">{i}:</span>
            <span>{renderValue(item, depth)}</span>
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    return <GenericObjectView data={value as Record<string, unknown>} depth={depth} />;
  }

  const str = String(value);
  if (str.length > 200) {
    return <span title={str}>{str.slice(0, 200)}...</span>;
  }
  return <span>{str}</span>;
}