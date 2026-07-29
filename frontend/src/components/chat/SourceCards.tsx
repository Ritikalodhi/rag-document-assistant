import type { QueryContext } from '@/types';

interface SourceCardsProps {
  context: QueryContext[];
  onOpenSource: (sources: QueryContext[], index: number) => void;
}

export function SourceCards({ context, onOpenSource }: SourceCardsProps) {
  if (!context || context.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {context.map((source, i) => (
        <button
          key={i}
          onClick={() => onOpenSource(context, i)}
          className="w-full flex items-start gap-3 p-3 rounded-[8px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:bg-[rgb(var(--color-surface))] transition-colors text-left group"
        >
          {/* Source number */}
          <span className="flex-shrink-0 w-6 h-6 rounded-[4px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] flex items-center justify-center text-caption font-medium text-[rgb(var(--color-text-secondary))] group-hover:border-[rgb(var(--color-accent))] group-hover:text-[rgb(var(--color-accent))] transition-colors">
            {i + 1}
          </span>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-caption font-medium truncate">{source.source}</p>
              {source.confidence_percent !== undefined && (
                <span className="text-caption text-[rgb(var(--color-text-secondary))] flex-shrink-0">
                  · {source.confidence_percent}%
                </span>
              )}
            </div>
            {source.page !== null && source.page !== undefined && (
              <p className="text-caption text-[rgb(var(--color-text-secondary))] mb-1">
                Page {source.page}
              </p>
            )}
            <p className="text-caption text-[rgb(var(--color-text-secondary))] line-clamp-2 leading-relaxed">
              {source.content}
            </p>
          </div>

          <svg
            className="w-3.5 h-3.5 flex-shrink-0 text-[rgb(var(--color-text-secondary))] mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ))}
    </div>
  );
}