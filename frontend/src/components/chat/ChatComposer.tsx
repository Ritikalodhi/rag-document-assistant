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
    el.style.height = Math.min(el.scrollHeight, 200) + 'px';
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items || !onFileUpload) return;
      const fileItems = Array.from(items).filter((item) => item.kind === 'file');
      if (fileItems.length > 0) {
        // Files from clipboard aren't easily transferred
      }
    },
    [onFileUpload],
  );

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
      className="border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))]"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[rgb(var(--color-bg))]/90 border-2 border-dashed border-[rgb(var(--color-accent))] rounded-lg">
          <p className="text-body font-medium text-[rgb(var(--color-accent))]">
            Drop files to upload
          </p>
        </div>
      )}

      <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-4">
        <div className="flex items-end gap-2 rounded-[12px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] p-2 focus-within:border-[rgb(var(--color-text-secondary))] transition-colors shadow-sm">
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
              className="p-2 rounded-[8px] hover:bg-[rgb(var(--color-surface))] transition-colors text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] flex-shrink-0 self-end mb-0.5"
              aria-label="Attach file"
              title="Attach file"
            >
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask a question across your documents..."
            rows={1}
            className="flex-1 resize-none bg-transparent border-none outline-none text-body placeholder:text-[rgb(var(--color-text-secondary))] max-h-[200px] py-1.5"
            aria-label="Message input"
            disabled={isLoading}
          />

          <div className="flex items-center gap-1 flex-shrink-0 self-end mb-0.5">
            {isLoading ? (
              <button
                onClick={onAbort}
                className="p-2 rounded-[8px] hover:bg-[rgb(var(--color-surface))] transition-colors text-[rgb(var(--color-text-secondary))] hover:text-red-500"
                aria-label="Stop generating"
              >
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" />
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 rounded-[8px] transition-colors flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Send message"
              >
                <svg
                  className={`w-[18px] h-[18px] ${input.trim() ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-secondary))]'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <p className="text-caption text-[rgb(var(--color-text-secondary))]">
            AI may produce inaccurate information. Verify important facts.
          </p>
          <span className="text-caption text-[rgb(var(--color-text-secondary))] hidden sm:inline">
            Enter to send · Shift+Enter for newline
          </span>
        </div>
      </div>
    </div>
  );
}