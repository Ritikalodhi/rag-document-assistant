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
import type { QueryContext } from '@/types';

export function ChatPage() {
  const [searchParams] = useSearchParams();
  const docIdParam = searchParams.get('docId') ?? undefined;
  const prefillQuestion = searchParams.get('question') ?? undefined;

  const { messages, isLoading, sendMessage, abort, retry, clearMessages } = useChat();
  const { data: conversations, isLoading: convsLoading, error: convsError, refetch: refetchConvs } = useConversations();

  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(false);
  const [activeSourceIndex, setActiveSourceIndex] = useState(0);
  const [activeSources, setActiveSources] = useState<QueryContext[]>([]);
  const [showTrace, setShowTrace] = useState<string | null>(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle pre-filled question from URL
  useEffect(() => {
    if (prefillQuestion && messages.length === 0) {
      const filter = docIdParam ? { filename: docIdParam } : undefined;
      sendMessage(prefillQuestion, filter);
    }
  }, [prefillQuestion, messages.length, sendMessage, docIdParam]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      const filter = docIdParam ? { filename: docIdParam } : undefined;
      sendMessage(text, filter);
    },
    [sendMessage, docIdParam],
  );

  const handleSelectConversation = useCallback(
    (question: string) => {
      clearMessages();
      setMobileHistoryOpen(false);
      const filter = docIdParam ? { filename: docIdParam } : undefined;
      sendMessage(question, filter);
    },
    [clearMessages, sendMessage, docIdParam],
  );

  const handleSelectFollowUp = useCallback(
    (question: string) => {
      const filter = docIdParam ? { filename: docIdParam } : undefined;
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
          const filter = docIdParam ? { filename: docIdParam } : undefined;
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
    <div className="flex h-[calc(100vh-4rem)] -m-4 sm:-m-6 lg:-m-8">
      <CommandPalette />

      {/* Mobile history overlay */}
      {mobileHistoryOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileHistoryOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile history drawer */}
      <div
        className={`fixed top-0 left-0 h-full z-40 w-[280px] lg:hidden transition-transform duration-250 ${
          mobileHistoryOpen ? 'translate-x-0' : '-translate-x-full'
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

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[rgb(var(--color-bg))]">
        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto scrollbar-thin"
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {messages.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center text-center pt-[15vh]">
                <div className="w-12 h-12 rounded-xl bg-[rgb(var(--color-surface))] flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-[rgb(var(--color-accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-h2 font-display font-semibold mb-2">Ask your research library</h2>
                <p className="text-body text-[rgb(var(--color-text-secondary))] max-w-md">
                  Search across your documents, compare ideas, and get answers grounded in your sources.
                </p>
                <div className="flex flex-wrap justify-center gap-3 mt-8">
                  <button
                    onClick={() => handleSend('Summarize my documents')}
                    className="px-4 py-2.5 rounded-[8px] text-caption font-medium border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))] transition-colors"
                  >
                    Summarize a document
                  </button>
                  <button
                    onClick={() => handleSend('Compare key findings across my documents')}
                    className="px-4 py-2.5 rounded-[8px] text-caption font-medium border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))] transition-colors"
                  >
                    Compare key findings
                  </button>
                  <button
                    onClick={() => handleSend('What are the main topics in my documents?')}
                    className="px-4 py-2.5 rounded-[8px] text-caption font-medium border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))] transition-colors"
                  >
                    Ask across documents
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {/* Mobile history toggle */}
                <div className="flex items-center gap-2 lg:hidden">
                  <button
                    onClick={() => setMobileHistoryOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-caption font-medium border border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] transition-colors"
                    aria-label="Open conversation history"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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