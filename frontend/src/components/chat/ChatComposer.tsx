import { useState, useRef, useCallback, type DragEvent } from 'react';

interface ChatComposerProps {
  onSend: (text: string) => void;
  onAbort: () => void;
  onFileUpload?: (files: FileList) => void;
  isLoading: boolean;
}

export function ChatComposer({ onSend, onAbort, onFileUpload, isLoading }: ChatComposerProps) {
  const [input, setInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    onSend(trimmed);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, isLoading, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 180) + 'px';
  }, []);

  /* ─── Drag-and-drop ─── */
  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = e.dataTransfer?.files;
      if (files && files.length > 0 && onFileUpload) {
        onFileUpload(files);
      }
    },
    [onFileUpload],
  );

  return (
    <div
      className="border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))] relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgb(var(--color-bg))]/90 border-2 border-dashed border-[rgb(var(--color-accent))] rounded-lg">
          <p className="text-[14px] font-medium text-[rgb(var(--color-accent))]">
            Drop files to upload
          </p>
        </div>
      )}

      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-3">
        <div className="rounded-[12px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] p-2.5 focus-within:border-[rgb(var(--color-text-tertiary))] transition-colors shadow-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question across your documents..."
            rows={1}
            className="w-full resize-none bg-transparent border-none outline-none text-[14px] text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-tertiary))] max-h-[180px] px-1 py-1"
            aria-label="Message input"
            disabled={isLoading}
          />

          <div className="flex items-center justify-between mt-2 pt-1 border-t border-[rgb(var(--color-border-subtle))]">
            <div className="flex items-center gap-1">
              {/* File attach button */}
              {onFileUpload && (
                <button
                  type="button"
                  onClick={() => {
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.multiple = true;
                    fileInput.accept = '.pdf,.txt,.docx,.md,.csv,.json,.html,.epub,.png,.jpg,.jpeg';
                    fileInput.onchange = (e) => {
                      const files = (e.target as HTMLInputElement).files;
                      if (files && files.length > 0) onFileUpload(files);
                    };
                    fileInput.click();
                  }}
                  className="p-2.5 rounded-[8px] hover:bg-[rgb(var(--color-surface))] transition-colors text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))]"
                  aria-label="Attach file"
                  title="Attach file"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[rgb(var(--color-text-tertiary))] hidden sm:inline">
                Enter to send · Shift+Enter for newline
              </span>

              {isLoading ? (
                <button
                  onClick={onAbort}
                  className="p-2.5 rounded-full bg-[rgb(var(--color-surface))] hover:bg-red-500/10 text-red-500 transition-colors"
                  aria-label="Stop generating"
                  title="Stop generating"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <rect x="7" y="7" width="10" height="10" rx="1" fill="currentColor" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="w-7 h-7 rounded-full bg-[rgb(var(--color-btn-primary))] text-[rgb(var(--color-btn-primary-text))] hover:bg-[rgb(var(--color-btn-primary-hover))] flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
                  aria-label="Send message"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}