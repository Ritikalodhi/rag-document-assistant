import { useState, useMemo } from 'react';
import { groupConversationsByDate } from '@/utils/time';
import { useDeleteConversation, useClearConversations } from '@/features/chat/hooks/useConversations';
import { Dialog, Skeleton, EmptyState, ErrorState, Button } from '@/components/ui';
import type { ConversationEntry } from '@/types';

interface ConversationSidebarProps {
  conversations?: ConversationEntry[];
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
  onSelectConversation: (question: string) => void;
  onNewConversation: () => void;
}

export function ConversationSidebar({
  conversations,
  isLoading,
  error,
  onRefetch,
  onSelectConversation,
  onNewConversation,
}: ConversationSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const deleteConv = useDeleteConversation();
  const clearConvs = useClearConversations();

  const filteredConvs = useMemo(() => {
    if (!conversations) return [];
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.question.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const groupedConvs = useMemo(() => {
    return groupConversationsByDate(filteredConvs);
  }, [filteredConvs]);

  const handleDelete = (id: string) => {
    deleteConv.mutate(id);
    setDeleteConfirm(null);
  };

  const handleClear = () => {
    clearConvs.mutate();
    setClearConfirm(false);
  };

  return (
    <aside className="w-[240px] border-r border-[rgb(var(--color-border))] flex flex-col flex-shrink-0 hidden lg:flex bg-[rgb(var(--color-sidebar))]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgb(var(--color-border))]">
        <h2 className="text-caption font-medium text-[rgb(var(--color-text-secondary))] uppercase tracking-wider text-[11px]">
          Conversations
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={onNewConversation}
            className="p-1.5 rounded-[6px] hover:bg-[rgb(var(--color-surface))] transition-colors"
            aria-label="New conversation"
            title="New conversation"
          >
            <svg className="w-4 h-4 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {conversations && conversations.length > 0 && (
            <button
              onClick={() => setClearConfirm(true)}
              className="p-1.5 rounded-[6px] hover:bg-[rgb(var(--color-surface))] transition-colors"
              aria-label="Clear all conversations"
              title="Clear all"
            >
              <svg className="w-4 h-4 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {conversations && conversations.length > 0 && (
        <div className="px-3 py-2 border-b border-[rgb(var(--color-border))]">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-[6px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]">
            <svg className="w-3.5 h-3.5 text-[rgb(var(--color-text-secondary))] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="flex-1 bg-transparent border-none outline-none text-caption placeholder:text-[rgb(var(--color-text-secondary))]"
              aria-label="Search conversations"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-0.5 rounded hover:bg-[rgb(var(--color-border))] transition-colors"
                aria-label="Clear search"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {isLoading && (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="text" width={`${60 + (i * 5) % 30}%`} />
            ))}
          </div>
        )}

        {!isLoading && error && (
          <ErrorState onRetry={onRefetch} title="Failed to load" message="Could not load conversation history." />
        )}

        {!isLoading && !error && Object.keys(groupedConvs).length === 0 && (
          <div className="px-3 py-8 text-center">
            {searchQuery ? (
              <p className="text-caption text-[rgb(var(--color-text-secondary))]">
                No conversations matching "{searchQuery}"
              </p>
            ) : (
              <EmptyState
                title="No history yet"
                description="Your conversations will appear here."
              />
            )}
          </div>
        )}

        {!isLoading && !error && Object.keys(groupedConvs).length > 0 && (
          <div className="flex flex-col gap-2">
            {Object.entries(groupedConvs).map(([group, convs]) => (
              <div key={group}>
                <p className="px-3 mb-1 text-caption text-[rgb(var(--color-text-secondary))]">{group}</p>
                <div className="flex flex-col gap-0.5">
                  {convs.map((conv) => (
                    <div
                      key={conv.id}
                      className="group flex items-center gap-1 px-3 py-2 rounded-[6px] text-left text-caption text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))] transition-colors cursor-pointer"
                      onClick={() => onSelectConversation(conv.question)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') onSelectConversation(conv.question); }}
                      aria-label={`Conversation: ${conv.question}`}
                    >
                      <span className="truncate flex-1">{conv.question}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(conv.id);
                        }}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0"
                        aria-label="Delete conversation"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Delete conversation"
      >
        <p className="text-body text-[rgb(var(--color-text-secondary))] mb-6">
          Are you sure you want to delete this conversation? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
            Delete
          </Button>
        </div>
      </Dialog>

      {/* Clear all confirmation dialog */}
      <Dialog
        open={clearConfirm}
        onClose={() => setClearConfirm(false)}
        title="Clear all conversations"
      >
        <p className="text-body text-[rgb(var(--color-text-secondary))] mb-6">
          Are you sure you want to delete all conversations? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setClearConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleClear}>
            Clear all
          </Button>
        </div>
      </Dialog>
    </aside>
  );
}