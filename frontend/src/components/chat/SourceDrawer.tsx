import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { QueryContext } from '@/types';

interface SourceDrawerProps {
  open: boolean;
  onClose: () => void;
  sources: QueryContext[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  docId?: string;
}

export function SourceDrawer({
  open,
  onClose,
  sources,
  activeIndex,
  onActiveChange,
  docId,
}: SourceDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleFocus = (e: FocusEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        drawerRef.current.focus();
      }
    };
    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  const activeSource = sources[activeIndex];

  return (
    <div
      ref={drawerRef}
      className="fixed top-0 right-0 h-full w-[400px] max-w-[90vw] z-50 bg-[rgb(var(--color-bg))] border-l border-[rgb(var(--color-border))] shadow-lg flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Source details"
      tabIndex={-1}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--color-border))]">
        <div className="flex items-center gap-2">
          <h2 className="text-h3 font-display font-semibold">Source</h2>
          <span className="text-caption text-[rgb(var(--color-text-secondary))]">
            {activeIndex + 1} of {sources.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-[6px] hover:bg-[rgb(var(--color-surface))] transition-colors"
          aria-label="Close source drawer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
        {sources.length === 0 ? (
          <p className="text-body text-[rgb(var(--color-text-secondary))]">No sources available</p>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Source navigation tabs */}
            {sources.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {sources.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => onActiveChange(i)}
                    className={`w-7 h-7 rounded-[4px] text-caption font-medium border transition-colors ${
                      i === activeIndex
                        ? 'bg-[rgb(var(--color-accent))] text-white border-[rgb(var(--color-accent))]'
                        : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent))] hover:text-[rgb(var(--color-accent))]'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}

            {activeSource && (
              <div className="flex flex-col gap-4">
                {/* Source metadata */}
                <div>
                  <p className="font-medium text-body">{activeSource.source}</p>
                  {activeSource.page !== null && activeSource.page !== undefined && (
                    <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">
                      Page {activeSource.page}
                    </p>
                  )}
                  {activeSource.confidence_percent !== undefined && (
                    <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">
                      Relevance: {activeSource.confidence_percent}%
                    </p>
                  )}
                </div>

                {/* Source content */}
                <div className="p-4 rounded-[8px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]">
                  <p className="text-body text-[rgb(var(--color-text))] leading-relaxed whitespace-pre-wrap">
                    {activeSource.content}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(activeSource.content).catch(() => {})}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-caption border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface))] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy excerpt
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      navigate(docId ? `/documents/${docId}` : '/documents');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-caption border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface))] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    View document
                  </button>
                </div>

                {/* Previous / Next navigation */}
                <div className="flex items-center justify-between pt-2 border-t border-[rgb(var(--color-border))]">
                  <button
                    onClick={() => onActiveChange(Math.max(0, activeIndex - 1))}
                    disabled={activeIndex <= 0}
                    className="text-caption text-[rgb(var(--color-text-secondary))] disabled:opacity-30 hover:text-[rgb(var(--color-text))] transition-colors"
                  >
                    &larr; Previous
                  </button>
                  <button
                    onClick={() => onActiveChange(Math.min(sources.length - 1, activeIndex + 1))}
                    disabled={activeIndex >= sources.length - 1}
                    className="text-caption text-[rgb(var(--color-text-secondary))] disabled:opacity-30 hover:text-[rgb(var(--color-text))] transition-colors"
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}