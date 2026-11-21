import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { groupConversationsByDate } from '@/utils/time';
import { useDeleteConversation, useClearConversations, useRenameConversation } from '@/features/chat/hooks/useConversations';
import { Dialog, Skeleton, EmptyState, ErrorState, Button } from '@/components/ui';
import type { ConversationEntry } from '@/types';

interface ConversationSidebarProps {
  conversations?: ConversationEntry[];
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
  onSelectConversation: (conversation: ConversationEntry) => void;
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
  const renameConv = useRenameConversation();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const handleRenameStart = (conv: ConversationEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingId(conv.id);
    setRenameValue(conv.title);
  };

  const handleRenameSubmit = async (id: string) => {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    try {
      await renameConv.mutateAsync({ entryId: id, title: renameValue.trim() });
      onRefetch();
    } catch (err) {
      console.error('Failed to rename conversation', err);
    }
    setRenamingId(null);
  };

  const filteredConvs = useMemo(() => {
    if (!conversations) return [];
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
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
    <aside className="w-[260px] border-r border-[rgb(var(--color-border))] flex flex-col flex-shrink-0 bg-[rgb(var(--color-sidebar))]/90 shadow-[4px_0_24px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[rgb(var(--color-border))] bg-[linear-gradient(135deg,rgb(var(--color-accent-muted))_0%,transparent_68%)]">
        <h2 className="font-ui text-[15px] font-semibold text-[rgb(var(--color-text))] tracking-[-0.01em]">
          Conversations
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onNewConversation}
            className="p-2 rounded-[10px] border border-transparent hover:border-[rgb(var(--color-accent))]/30 hover:bg-[rgb(var(--color-elevated))]/70 transition-all"
            aria-label="New conversation"
            title="New conversation"
          >
            <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          {conversations && conversations.length > 0 && (
            <button
              onClick={() => setClearConfirm(true)}
              className="p-2.5 rounded-[8px] hover:bg-[rgb(var(--color-surface))] transition-colors"
              aria-label="Clear all conversations"
              title="Clear all"
            >
              <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {conversations && conversations.length > 0 && (
        <div className="px-3 py-2 border-b border-[rgb(var(--color-border))]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-[11px] bg-[rgb(var(--color-elevated))]/70 border border-[rgb(var(--color-border))] shadow-[var(--shadow-sm)] focus-within:border-[rgb(var(--color-accent))]/60">
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
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
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
          <div className="flex flex-col gap-3">
            {Object.entries(groupedConvs).map(([group, convs]) => (
              <div key={group}>
                <p className="px-3 mb-1 text-caption text-[rgb(var(--color-text-secondary))]">{group}</p>
                <div className="flex flex-col gap-1">
                  {convs.map((conv) => (
                    <motion.div
                      key={conv.id}
                      className={`group flex items-center gap-1 px-3 py-2.5 rounded-[12px] text-left text-caption transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/30 ${selectedConversationId === conv.id
                        ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))] border border-[rgb(var(--color-accent))]/35 shadow-[var(--shadow-sm),0_0_18px_-12px_var(--glow-color)]'
                        : 'text-[rgb(var(--color-text-secondary))] border border-transparent hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-border))] hover:shadow-[var(--shadow-sm)]'
                      }`}
                      onClick={() => {
                        if (renamingId !== conv.id) {
                          setSelectedConversationId(conv.id);
                          onSelectConversation(conv);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && renamingId !== conv.id) {
                          e.preventDefault();
                          setSelectedConversationId(conv.id);
                          onSelectConversation(conv);
                        }
                      }}
                      aria-label={`Conversation: ${conv.title}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: Math.min(0.18, convs.indexOf(conv) * 0.025), ease: 'easeOut' }}
                      whileHover={{ x: 2 }}
                    >
                      {renamingId === conv.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameSubmit(conv.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit(conv.id);
                            if (e.key === 'Escape') setRenamingId(null);
                            e.stopPropagation();
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-transparent border-b border-[rgb(var(--color-border))] outline-none text-caption text-[rgb(var(--color-text))]"
                        />
                      ) : (
                        <span className="truncate flex-1">{conv.title}</span>
                      )}
                      {/* Rename button */}
                      <button
                        onClick={(e) => handleRenameStart(conv, e)}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[rgb(var(--color-surface))] transition-all flex-shrink-0"
                        aria-label="Rename conversation"
                        title="Rename"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {/* Delete button */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(conv.id); }}
                        className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex-shrink-0"
                        aria-label="Delete conversation"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </motion.div>
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
