import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { useConversations } from '@/features/chat/hooks/useConversations';
import { useCollections } from '@/features/collections/hooks/useCollections';
import { Skeleton } from '@/components/ui';
import { healthService, type HealthStatus } from '@/services/health.service';
import { formatRelativeTime } from '@/utils/time';
import { getReadingProgress } from '@/utils/readingProgress';
import { getNotesGeneratedCount } from '@/utils/notesProgress';

interface ActivityEntry {
  type: 'query' | 'upload' | 'collection';
  title: string;
  subtitle: string;
  time: string;
  timestamp: number;
  docId?: string;
  convId?: string;
}

const quickActions = [
  {
    label: 'Upload',
    description: 'Add PDFs, docs & notes',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    href: '/upload',
    iconColor: 'text-[rgb(var(--color-accent))]',
    iconBg: 'bg-[rgb(var(--color-accent-muted))]',
  },
  {
    label: 'Ask AI',
    description: 'Question your library',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    href: '/chat',
    iconColor: 'text-blue-600 dark:text-blue-300',
    iconBg: 'bg-blue-500/10 dark:bg-blue-400/10',
  },
  {
    label: 'Summarize',
    description: 'Condense any document',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 6h16M4 12h16M4 18h7" />
      </svg>
    ),
    href: '/documents',
    iconColor: 'text-amber-600 dark:text-amber-300',
    iconBg: 'bg-amber-500/10 dark:bg-amber-400/10',
  },
  {
    label: 'Study Notes',
    description: 'Create & organize notes',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    href: '/study-notes',
    iconColor: 'text-violet-600 dark:text-violet-300',
    iconBg: 'bg-violet-500/10 dark:bg-violet-400/10',
  },
  {
    label: 'Compare',
    description: 'Compare two sources',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    href: '/compare',
    iconColor: 'text-sky-600 dark:text-sky-300',
    iconBg: 'bg-sky-500/10 dark:bg-sky-400/10',
  },
  {
    label: 'Cross-Document',
    description: 'Analyze across files',
    icon: (
      <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
    href: '/cross-analysis',
    iconColor: 'text-fuchsia-600 dark:text-fuchsia-300',
    iconBg: 'bg-fuchsia-500/10 dark:bg-fuchsia-400/10',
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function WelcomeIllustration() {
  return (
    <svg
      width="160"
      height="130"
      viewBox="0 0 160 130"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      {/* Background Document Card (theme-aware) */}
      <rect x="24" y="22" width="76" height="92" rx="8" className="fill-[rgb(var(--color-surface))] stroke-[rgb(var(--color-border))]" strokeWidth="1.2" />
      <rect x="36" y="38" width="52" height="3.5" rx="1.75" className="fill-[rgb(var(--color-accent))]" fillOpacity="0.55" />
      <rect x="36" y="48" width="42" height="3" rx="1.5" className="fill-[rgb(var(--color-border))]" />
      <rect x="36" y="58" width="48" height="3" rx="1.5" className="fill-[rgb(var(--color-border))]" />
      <rect x="36" y="68" width="34" height="3" rx="1.5" className="fill-[rgb(var(--color-border))]" />
      <rect x="36" y="78" width="44" height="3" rx="1.5" className="fill-[rgb(var(--color-border))]" />
      <rect x="36" y="88" width="30" height="3" rx="1.5" className="fill-[rgb(var(--color-border))]" />

      {/* Foreground Elevated Card (theme-aware) */}
      <rect x="62" y="10" width="86" height="66" rx="8" className="fill-[rgb(var(--color-elevated))] stroke-[rgb(var(--color-accent))]" strokeOpacity="0.35" strokeWidth="1.4" />
      <rect x="74" y="24" width="56" height="4" rx="2" className="fill-[rgb(var(--color-accent))]" fillOpacity="0.85" />
      <rect x="74" y="36" width="44" height="3" rx="1.5" className="fill-[rgb(var(--color-text))]" fillOpacity="0.3" />
      <rect x="74" y="45" width="50" height="3" rx="1.5" className="fill-[rgb(var(--color-text))]" fillOpacity="0.18" />
      <rect x="74" y="54" width="36" height="3" rx="1.5" className="fill-[rgb(var(--color-text))]" fillOpacity="0.12" />

      {/* Floating Sparkles */}
      <path d="M138 18L139.5 23L144.5 24.5L139.5 26L138 31L136.5 26L131.5 24.5L136.5 23L138 18Z" className="fill-[rgb(var(--color-accent))]" />
      <circle cx="20" cy="40" r="2.5" className="fill-[rgb(var(--color-accent))]" fillOpacity="0.7" />
      <circle cx="148" cy="85" r="2" className="fill-[rgb(var(--color-accent))]" fillOpacity="0.5" />
    </svg>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: documents, isLoading: docsLoading } = useDocuments();
  const { data: conversations } = useConversations();
  const { data: collections } = useCollections();
  const [, setHealth] = useState<HealthStatus | null>(null);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [studyNotesCount, setStudyNotesCount] = useState(() => getNotesGeneratedCount());

  useEffect(() => {
    healthService.check().then(setHealth).catch(() => setHealth({ status: 'unavailable' }));
  }, []);

  // Refresh the Study Notes stat when the document list changes
  useEffect(() => {
    setStudyNotesCount(getNotesGeneratedCount());
  }, [documents]);

  const docCount = documents?.length ?? 0;
  const conversationCount = conversations?.length ?? 0;
  const collectionCount = collections?.length ?? 0;

  // Real reading progress from localStorage
  const readingProgress = getReadingProgress();
  const readingEntries = useMemo(() => {
    return Object.entries(readingProgress)
      .filter(([id, data]) => id && data && typeof data.progress === 'number')
      .sort((a, b) => (b[1].lastOpened || 0) - (a[1].lastOpened || 0));
  }, [readingProgress]);

  const activeReadingEntry = readingEntries.length > 0 ? readingEntries[0] : null;
  const activeReadingDocId = activeReadingEntry ? activeReadingEntry[0] : null;
  const activeReadingData = activeReadingEntry ? activeReadingEntry[1] : null;

  // Find matching document metadata if available
  const matchingDoc = documents?.find((d) => d.doc_id === activeReadingDocId);

  // Real activity entries aggregated from actual application state
  const activityList: ActivityEntry[] = useMemo(() => {
    const list: ActivityEntry[] = [];

    // Real document uploads
    if (documents && documents.length > 0) {
      documents.forEach((d) => {
        if (d.uploaded_at) {
          const ts = new Date(d.uploaded_at).getTime();
          if (!isNaN(ts)) {
            list.push({
              type: 'upload',
              title: 'Uploaded document',
              subtitle: d.filename,
              time: formatRelativeTime(ts),
              timestamp: ts,
              docId: d.doc_id,
            });
          }
        }
      });
    }

    // Real conversations
    if (conversations && conversations.length > 0) {
      conversations.forEach((c) => {
        if (c.created_at) {
          const ts = new Date(c.created_at).getTime();
          if (!isNaN(ts)) {
            list.push({
              type: 'query',
              title: 'Conversation started',
              subtitle: c.title || 'Chat conversation',
              time: formatRelativeTime(ts),
              timestamp: ts,
              convId: c.id,
            });
          }
        }
      });
    }

    // Real collections
    if (collections && collections.length > 0) {
      collections.forEach((col) => {
        list.push({
          type: 'collection',
          title: 'Created collection',
          subtitle: col.name,
          time: 'Recently',
          timestamp: Date.now(),
        });
      });
    }

    // Sort by newest timestamp first
    list.sort((a, b) => b.timestamp - a.timestamp);

    // Limit to recent activities (expandable via "View all")
    return list.slice(0, showAllActivity ? 12 : 5);
  }, [documents, conversations, collections, showAllActivity]);

  const motionProps = (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  });

  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).toUpperCase();

  return (
    <div className="flex flex-col gap-6 pb-12 w-full max-w-full overflow-x-hidden min-w-0">

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start w-full min-w-0">

        {/* ─── LEFT COLUMN ─── */}
        <div className="flex flex-col gap-6 min-w-0 w-full">

          {/* ── 1. Welcome Card ── */}
          <motion.div
            {...motionProps(0)}
            className="relative overflow-hidden rounded-[20px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] p-8 sm:p-9 shadow-[var(--shadow-sm)]"
          >
            {/* Subtle background pine glow */}
            <div
              className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, var(--glow-color) 0%, transparent 70%)',
                transform: 'translate(20%, -30%)',
              }}
            />
            {/* Very subtle mint halo behind the decorative illustration */}
            <div
              className="absolute bottom-[-30%] right-[-5%] w-72 h-72 rounded-full pointer-events-none"
              style={{
                background: 'radial-gradient(circle, var(--glow-color) 0%, transparent 70%)',
              }}
            />

            <div className="relative z-10 flex items-center justify-between gap-8">
              <div className="flex-1 min-w-0">
                <p className="text-[11.5px] font-bold text-[rgb(var(--color-text-tertiary))] uppercase tracking-[0.14em] mb-2.5">
                  {dateLabel}
                </p>
                <h1 className="text-[32px] sm:text-[36px] font-bold tracking-tight text-[rgb(var(--color-text))] leading-[1.15] font-ui">
                  {getGreeting()}{user?.username ? `, ${user.username}` : ''} 👋
                </h1>
                {docsLoading ? (
                  <Skeleton variant="text" width={320} className="mt-3" />
                ) : (
                  <p className="text-[14.5px] text-[rgb(var(--color-text-secondary))] mt-3 leading-relaxed max-w-lg">
                    {docCount === 0
                      ? 'Your research workspace is ready. Upload a document or ask a question to get started.'
                      : `You have ${docCount} document${docCount !== 1 ? 's' : ''} in your library ready for analysis and synthesis.`}
                  </p>
                )}

                <div className="flex items-center gap-3.5 mt-6 flex-wrap">
                  <button
                    onClick={() => navigate('/upload')}
                    className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-[10px] text-[rgb(var(--color-btn-primary-text))] font-semibold text-[14px] bg-[rgb(var(--color-btn-primary))] bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0)_42%)] hover:bg-[rgb(var(--color-btn-primary-hover))] shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.25),0_0_18px_-6px_var(--glow-color)] transition-all duration-200 cursor-pointer active:scale-[0.98] min-h-[44px]"
                  >
                    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>{docCount === 0 ? 'Upload your first document' : 'Upload document'}</span>
                  </button>

                  <button
                    onClick={() => navigate('/chat')}
                    className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-[10px] text-[rgb(var(--color-text))] font-semibold text-[14px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-elevated))] hover:border-[rgb(var(--color-accent-muted))] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all duration-200 cursor-pointer active:scale-[0.98] min-h-[44px]"
                  >
                    <svg className="w-[18px] h-[18px] text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>Ask AI</span>
                  </button>
                </div>
              </div>

              {/* Illustration matching reference */}
              <div className="hidden md:flex items-center justify-center flex-shrink-0">
                <WelcomeIllustration />
              </div>
            </div>
          </motion.div>

          {/* ── 2. Continue Reading Card (Data-Driven) ── */}
          <motion.div {...motionProps(0.05)}>
            <div className="rounded-[20px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] p-7 shadow-[var(--shadow-sm),inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-[rgb(var(--color-accent-muted))] hover:shadow-[var(--shadow-md),0_0_20px_-8px_var(--glow-color)] transition-all duration-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-bold text-[rgb(var(--color-text))] font-ui">
                  Continue Reading
                </h2>
                {activeReadingData?.lastOpened && (
                  <div className="flex items-center gap-1.5 text-[12px] text-[rgb(var(--color-text-tertiary))]">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{formatRelativeTime(activeReadingData.lastOpened)}</span>
                  </div>
                )}
              </div>

              {activeReadingEntry && activeReadingDocId && activeReadingData ? (
                /* Real Reading Progress State */
                <>
                  <div className="flex items-center justify-between gap-4 mt-3">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-[48px] h-[48px] rounded-[13px] bg-[rgb(var(--color-accent-muted))] border border-[rgb(var(--color-accent))]/25 flex items-center justify-center flex-shrink-0">
                        <svg className="w-[24px] h-[24px] text-[rgb(var(--color-accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.65} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15.5px] font-semibold text-[rgb(var(--color-text))] truncate leading-tight">
                          {activeReadingData.title || matchingDoc?.filename || 'Document'}
                        </p>
                        <p className="text-[13px] text-[rgb(var(--color-text-secondary))] mt-1 truncate">
                          {activeReadingData.section || (matchingDoc?.chunk_count ? `${matchingDoc.chunk_count} indexed chunks` : 'Indexed document')}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/documents/${activeReadingDocId}`)}
                      className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[13px] font-semibold text-[rgb(var(--color-accent))] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-btn-primary))]/60 hover:bg-[rgb(var(--color-btn-primary))] hover:text-[rgb(var(--color-btn-primary-text))] transition-all duration-150 flex-shrink-0 whitespace-nowrap cursor-pointer active:scale-[0.98]"
                    >
                      <span>Resume Reading</span>
                      <span>→</span>
                    </button>
                  </div>

                  {/* Real Progress Bar */}
                  <div className="mt-5">
                    {activeReadingData.currentPage && activeReadingData.totalPages ? (
                      <div className="flex items-center justify-between text-[12px] text-[rgb(var(--color-text-secondary))] mb-2">
                        <span>Page {activeReadingData.currentPage} of {activeReadingData.totalPages}</span>
                      </div>
                    ) : null}
                    <div className="w-full h-2 bg-[rgb(var(--color-surface))] rounded-full overflow-hidden border border-[rgb(var(--color-border))]">
                      <motion.div
                        className="h-full rounded-full bg-[rgb(var(--color-accent))]"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, activeReadingData.progress))}%` }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[12px] text-[rgb(var(--color-text-tertiary))]">
                      <span>{Math.min(100, Math.max(0, Math.round(activeReadingData.progress)))}% completed</span>
                    </div>
                  </div>
                </>
              ) : (
                /* Polished Empty State */
                <div className="flex flex-col items-center justify-center py-6 sm:py-7 text-center">
                  <div className="w-14 h-14 rounded-[16px] bg-[rgb(var(--color-accent-muted))] border border-[rgb(var(--color-accent))]/20 flex items-center justify-center mb-3 text-[rgb(var(--color-accent))] shadow-[var(--shadow-sm)]">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">
                    No reading activity yet
                  </p>
                  <p className="text-[13px] text-[rgb(var(--color-text-secondary))] mt-1 max-w-sm">
                    Open a document to start tracking your reading progress.
                  </p>
                  <button
                    onClick={() => navigate('/documents')}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-[13px] font-semibold text-[rgb(var(--color-accent))] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-btn-primary))]/60 hover:bg-[rgb(var(--color-btn-primary))] hover:text-[rgb(var(--color-btn-primary-text))] transition-all duration-150 cursor-pointer active:scale-[0.98]"
                  >
                    <span>Browse library</span>
                    <span>→</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── 3. Quick Actions Grid ── */}
          <motion.section {...motionProps(0.1)}>
            <h2 className="text-[15px] font-bold text-[rgb(var(--color-text))] mb-3.5 font-ui">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.href)}
                  className="flex items-start gap-4 p-5 rounded-[18px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:border-[rgb(var(--color-accent-muted))] hover:bg-[rgb(var(--color-surface))] hover:shadow-[var(--shadow-md),0_0_18px_-8px_var(--glow-color)] transition-all duration-200 text-left group shadow-[var(--shadow-sm)] active:scale-[0.98] min-h-[110px] cursor-pointer"
                >
                  <div className={`w-[48px] h-[48px] rounded-[13px] ${action.iconBg} ${action.iconColor} flex items-center justify-center flex-shrink-0 transition-all duration-200 group-hover:scale-[1.06] border border-[rgb(var(--color-border))]`}>
                    {action.icon}
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[14.5px] font-semibold text-[rgb(var(--color-text))] leading-snug truncate group-hover:text-[rgb(var(--color-accent))] transition-colors duration-200">
                      {action.label}
                    </p>
                    <p className="text-[12px] text-[rgb(var(--color-text-secondary))] mt-1 leading-snug line-clamp-2">
                      {action.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.section>

        </div>

        {/* ─── RIGHT COLUMN ─── */}
        <div className="flex flex-col gap-6 w-full lg:w-[380px] min-w-0 flex-shrink-0">

          {/* ── 4. Recent Activity (Data-Driven) ── */}
          <motion.div {...motionProps(0.08)}>
            <div className="rounded-[20px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] p-6 shadow-[var(--shadow-sm)]">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[16px] font-bold text-[rgb(var(--color-text))] font-ui">
                  Recent Activity
                </h2>
                {activityList.length > 0 && (
                  <button
                    onClick={() => setShowAllActivity((v) => !v)}
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-accent))] bg-transparent border border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent))]/40 rounded-[8px] px-2.5 py-1 transition-colors duration-150 cursor-pointer"
                    aria-label={showAllActivity ? 'Show fewer activities' : 'View all activities'}
                  >
                    <span>{showAllActivity ? 'Show less' : 'View all'}</span>
                    <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>

              {activityList.length > 0 ? (
                <div className="relative pl-1">
                  {/* Timeline vertical connector line */}
                  <div
                    className="absolute left-[19px] top-4 bottom-4 w-px bg-[rgb(var(--color-border))]"
                    aria-hidden="true"
                  />

                  <div className="flex flex-col gap-5">
                    {activityList.map((entry, idx) => (
                      <button
                        key={idx}
                        className="relative flex items-start gap-3.5 text-left group transition-all duration-150 hover:opacity-100 opacity-90 w-full cursor-pointer"
                        onClick={() => {
                          if (entry.docId) navigate(`/documents/${entry.docId}`);
                          else if (entry.convId) navigate(`/chat?id=${entry.convId}`);
                          else navigate('/chat');
                        }}
                        aria-label={`${entry.title}: ${entry.subtitle}`}
                      >
                        <div className="w-[36px] h-[36px] rounded-full bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] flex items-center justify-center flex-shrink-0 z-10 group-hover:border-[rgb(var(--color-accent-muted))] group-hover:bg-[rgb(var(--color-accent-muted))]/10 transition-all duration-200">
                          {entry.type === 'query' && (
                            <svg className="w-[16px] h-[16px] text-[#93C5FD]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                          )}
                          {entry.type === 'upload' && (
                            <svg className="w-[16px] h-[16px] text-[rgb(var(--color-accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          )}
                          {entry.type === 'collection' && (
                            <svg className="w-[16px] h-[16px] text-[#FCD34D]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13.5px] font-semibold text-[rgb(var(--color-text))] leading-snug group-hover:text-[rgb(var(--color-accent))] transition-colors duration-150 truncate">
                              {entry.title}
                            </p>
                            <span className="text-[12px] text-[rgb(var(--color-text-secondary))] flex-shrink-0">
                              {entry.time}
                            </span>
                          </div>
                          <p className="text-[12.5px] text-[rgb(var(--color-text-secondary))] truncate mt-0.5">
                            {entry.subtitle}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-[14px] bg-[rgb(var(--color-accent-muted))] border border-[rgb(var(--color-accent))]/20 flex items-center justify-center mb-3 text-[rgb(var(--color-accent))] shadow-[var(--shadow-sm)]">
                    <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-[14px] font-medium text-[rgb(var(--color-text))]">No recent activity yet</p>
                  <p className="text-[12.5px] text-[rgb(var(--color-text-secondary))] mt-1">
                    Ask a question or upload a document to see your activity here.
                  </p>
                </div>
              )}
            </div>
          </motion.div>

          {/* ── 5. Workspace Overview (Data-Driven) ── */}
          <motion.div {...motionProps(0.12)}>
            <div className="rounded-[20px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] p-6 shadow-[var(--shadow-sm)]">
              <h2 className="text-[16px] font-bold text-[rgb(var(--color-text))] mb-4 font-ui">
                Workspace Overview
              </h2>
              <div className="flex flex-col gap-2.5">
                {/* Documents */}
                <button
                  onClick={() => navigate('/documents')}
                  className="flex items-center justify-between p-3 rounded-[14px] hover:bg-[rgb(var(--color-surface))] transition-colors group cursor-pointer w-full text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-[40px] h-[40px] rounded-[12px] bg-[rgb(var(--color-accent-muted))] border border-[rgb(var(--color-accent))]/25 flex items-center justify-center">
                      <svg className="w-[20px] h-[20px] text-[rgb(var(--color-accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <span className="text-[14.5px] font-medium text-[rgb(var(--color-text))]">Documents</span>
                  </div>
                  <span className="text-[16px] font-bold text-[rgb(var(--color-text))] tabular-nums">
                    {docsLoading ? <Skeleton variant="text" width={24} /> : docCount}
                  </span>
                </button>

                {/* Conversations */}
                <button
                  onClick={() => navigate('/chat')}
                  className="flex items-center justify-between p-3 rounded-[14px] hover:bg-[rgb(var(--color-surface))] transition-colors group cursor-pointer w-full text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-[40px] h-[40px] rounded-[12px] bg-blue-500/10 dark:bg-blue-400/10 border border-[rgb(var(--color-border))] flex items-center justify-center">
                      <svg className="w-[20px] h-[20px] text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <span className="text-[14.5px] font-medium text-[rgb(var(--color-text))]">Conversations</span>
                  </div>
                  <span className="text-[16px] font-bold text-[rgb(var(--color-text))] tabular-nums">
                    {conversationCount}
                  </span>
                </button>

                {/* Collections */}
                <button
                  onClick={() => navigate('/collections')}
                  className="flex items-center justify-between p-3 rounded-[14px] hover:bg-[rgb(var(--color-surface))] transition-colors group cursor-pointer w-full text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-[40px] h-[40px] rounded-[12px] bg-amber-500/10 dark:bg-amber-400/10 border border-[rgb(var(--color-border))] flex items-center justify-center">
                      <svg className="w-[20px] h-[20px] text-amber-600 dark:text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <span className="text-[14.5px] font-medium text-[rgb(var(--color-text))]">Collections</span>
                  </div>
                  <span className="text-[16px] font-bold text-[rgb(var(--color-text))] tabular-nums">
                    {collectionCount}
                  </span>
                </button>

                {/* Study Notes */}
                <button
                  onClick={() => navigate('/study-notes')}
                  className="flex items-center justify-between p-3 rounded-[14px] hover:bg-[rgb(var(--color-surface))] transition-colors group cursor-pointer w-full text-left"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-[40px] h-[40px] rounded-[12px] bg-violet-500/10 dark:bg-violet-400/10 border border-[rgb(var(--color-border))] flex items-center justify-center">
                      <svg className="w-[20px] h-[20px] text-violet-600 dark:text-violet-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <span className="text-[14.5px] font-medium text-[rgb(var(--color-text))]">Study Notes</span>
                  </div>
                  <span className="text-[16px] font-bold text-[rgb(var(--color-text))] tabular-nums">
                    {studyNotesCount}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}