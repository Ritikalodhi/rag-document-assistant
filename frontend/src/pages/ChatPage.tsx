import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useChat } from '@/features/chat/hooks/useChat';
import { useConversations } from '@/features/chat/hooks/useConversations';
import { CommandPalette } from '@/components/chat/CommandPalette';
import { ConversationSidebar } from '@/components/chat/ConversationSidebar';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { SourceDrawer } from '@/components/chat/SourceDrawer';
import { FollowUpQuestions } from '@/components/chat/FollowUpQuestions';
import type { QueryContext, ConversationEntry } from '@/types';
import { getLastViewedDocId, clearLastViewedDocId } from '@/utils/lastDocument';

export function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // If the user didn't open chat from a specific document, default to
  // whichever document they last viewed instead of searching everything.
  const docIdParam = searchParams.get('docId') ?? getLastViewedDocId();
  const prefillQuestion = searchParams.get('question') ?? undefined;

  const { messages, isLoading, sendMessage, abort, retry, clearMessages, loadConversation } = useChat();
  const { data: conversations, isLoading: convsLoading, error: convsError, refetch: refetchConvs } = useConversations();

  // Handle "New chat" from Topbar — clear messages and remove ?new=1 from URL
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      clearMessages();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('new');
        return next;
      }, { replace: true });
    }
  }, [searchParams, clearMessages, setSearchParams]);

  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [activeSources, setActiveSources] = useState<QueryContext[]>([]);
  const [showTrace, setShowTrace] = useState<string | null>(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle pre-filled question from URL
  useEffect(() => {
    if (prefillQuestion && messages.length === 0) {
      const filter = docIdParam ? { document_id: docIdParam } : undefined;
      sendMessage(prefillQuestion, filter);
    }
  }, [prefillQuestion, messages.length, sendMessage, docIdParam]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      const filter = docIdParam ? { document_id: docIdParam } : undefined;
      sendMessage(text, filter);
    },
    [sendMessage, docIdParam],
  );

  const handleSelectConversation = useCallback(
    (conversation: ConversationEntry) => {
      setMobileHistoryOpen(false);
      loadConversation(conversation);
    },
    [loadConversation],
  );

  const handleSelectFollowUp = useCallback(
    (question: string) => {
      const filter = docIdParam ? { document_id: docIdParam } : undefined;
      sendMessage(question, filter);
    },
    [sendMessage, docIdParam],
  );

  const handleFileUpload = useCallback(
    (_files: FileList) => {
      window.location.href = '/upload';
    },
    [],
  );

  const handleRetry = useCallback(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (lastAssistant) {
      const lastUserIndex = [...messages].reverse().findIndex((m) => m.role === 'user');
      if (lastUserIndex !== -1) {
        const lastUser = [...messages].reverse()[lastUserIndex];
        if (lastUser) {
          const filter = docIdParam ? { document_id: docIdParam } : undefined;
          retry(lastUser.content, filter);
        }
      }
    }
  }, [messages, retry, docIdParam]);

  const openSources = (sources: QueryContext[], index: number) => {
    setActiveSources(sources);
    setActiveSourceIndex(index);
    setSourceDrawerOpen(true);
  };

  const lastAssistantMsg = [...messages].reverse().find(
    (m) => m.role === 'assistant' && !m.isStreaming && !m.error,
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 sm:-m-6 lg:-m-8 bg-[rgb(var(--color-bg))] overflow-hidden">
      <CommandPalette />

      {/* Mobile history overlay */}
      {mobileHistoryOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 dark:bg-black/60 lg:hidden"
          onClick={() => setMobileHistoryOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile history drawer */}
      <div
        className={`fixed top-0 left-0 h-full z-40 w-[260px] lg:hidden transition-transform duration-250 ${mobileHistoryOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        <ConversationSidebar
          conversations={conversations}
          isLoading={convsLoading}
          error={convsError}
          onRefetch={refetchConvs}
          onSelectConversation={handleSelectConversation}
          onNewConversation={() => { clearMessages(); setMobileHistoryOpen(false); }}
        />
      </div>

      {/* Conversation history sidebar (desktop) */}
      <ConversationSidebar
        conversations={conversations}
        isLoading={convsLoading}
        error={convsError}
        onRefetch={refetchConvs}
        onSelectConversation={handleSelectConversation}
        onNewConversation={clearMessages}
      />

      {/* Main chat container */}
      <div className="flex-1 flex flex-col min-w-0 bg-[rgb(var(--color-bg))] h-full">
        {/* Header line for scoped doc if docIdParam present */}
        {docIdParam && (
          <div className="h-11 border-b border-[rgb(var(--color-border))] px-4 sm:px-6 flex items-center justify-between bg-[rgb(var(--color-elevated))] flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-[rgb(var(--color-text))]">Scope:</span>
              <span className="px-2 py-0.5 rounded-[5px] bg-[rgb(var(--color-surface))] text-[12px] font-code text-[rgb(var(--color-text-secondary))] border border-[rgb(var(--color-border))] truncate max-w-[240px]">
                {docIdParam}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-[rgb(var(--color-text-tertiary))]">Filtered Query</span>
              <button
                type="button"
                onClick={() => {
                  clearLastViewedDocId();
                  searchParams.delete('docId');
                  setSearchParams(searchParams);
                }}
                className="text-[11px] text-[rgb(var(--color-accent))] hover:underline"
              >
                Search all documents
              </button>
            </div>
          </div>
        )}

        {/* Messages scroll area */}
        <div
          className="flex-1 overflow-y-auto scrollbar-thin"
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-6">
            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center text-center pt-[15vh]">
                <div className="w-11 h-11 rounded-[12px] bg-[rgb(var(--color-surface))] flex items-center justify-center mb-3.5 border border-[rgb(var(--color-border))]">
                  <svg className="w-5 h-5 text-[rgb(var(--color-accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-[20px] font-display font-semibold mb-1.5 text-[rgb(var(--color-text))]">Ask your research library</h2>
                <p className="text-[14px] text-[rgb(var(--color-text-secondary))] max-w-md leading-relaxed">
                  Search across your documents, compare ideas, and get answers grounded in your sources.
                </p>

                <div className="flex flex-wrap justify-center gap-2.5 mt-6">
                  <button
                    onClick={() => handleSend('Summarize my documents')}
                    className="px-3.5 py-2 rounded-[8px] text-[13px] font-medium border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))] transition-colors"
                  >
                    Summarize a document
                  </button>
                  <button
                    onClick={() => handleSend('Compare key findings across my documents')}
                    className="px-3.5 py-2 rounded-[8px] text-[13px] font-medium border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))] transition-colors"
                  >
                    Compare key findings
                  </button>
                  <button
                    onClick={() => handleSend('What are the main topics in my documents?')}
                    className="px-3.5 py-2 rounded-[8px] text-[13px] font-medium border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))] transition-colors"
                  >
                    Ask across documents
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {/* Mobile history toggle */}
                <div className="flex items-center gap-2 lg:hidden">
                  <button
                    onClick={() => setMobileHistoryOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] transition-colors"
                    aria-label="Open conversation history"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    Conversations
                  </button>
                </div>

                {messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onOpenSources={openSources}
                    onToggleTrace={setShowTrace}
                    showTrace={showTrace === msg.id}
                    onRetry={handleRetry}
                  />
                ))}

                {lastAssistantMsg && (
                  <FollowUpQuestions
                    docId={docIdParam}
                    onSelect={handleSelectFollowUp}
                  />
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <ChatComposer
          onSend={handleSend}
          onAbort={abort}
          onFileUpload={handleFileUpload}
          isLoading={isLoading}
        />
      </div>

      {/* Source drawer */}
      <SourceDrawer
        open={sourceDrawerOpen}
        onClose={() => setSourceDrawerOpen(false)}
        sources={activeSources}
        activeIndex={activeSourceIndex}
        onActiveChange={setActiveSourceIndex}
        docId={docIdParam}
      />
    </div>
  );
}