import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { Button, Card, Skeleton } from '@/components/ui';
import { healthService, type HealthStatus } from '@/services/health.service';
import { formatRelativeTime } from '@/utils/time';
import { getReadingProgress } from '@/utils/readingProgress';

interface ActivityEntry {
  type: 'upload' | 'summary' | 'query' | 'compare' | 'export';
  label: string;
  secondary?: string;
  timestamp: number;
  docId?: string;
}

const quickActions = [
  {
    label: 'Upload',
    description: 'Add PDFs, docs & notes',
    icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
    onClick: '/upload',
  },
  {
    label: 'Ask AI',
    description: 'Question your library',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    onClick: '/chat',
  },
  {
    label: 'Summarize',
    description: 'Condense a document',
    icon: 'M4 6h16M4 12h16M4 18h7',
    onClick: '/documents',
  },
  {
    label: 'Study Notes',
    description: 'Generate structured notes',
    icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    onClick: '/documents',
  },
  {
    label: 'Compare',
    description: 'Compare two sources',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    onClick: '/compare',
  },
  {
    label: 'Cross-Document',
    description: 'Analyze across files',
    icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
    onClick: '/cross-analysis',
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: documents, isLoading: docsLoading } = useDocuments();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await healthService.check();
        setHealth(res);
      } catch {
        setHealth({ status: 'unavailable' });
      } finally {
        setHealthLoading(false);
      }
    };
    fetchHealth();
  }, []);

  useEffect(() => {
    const entries: ActivityEntry[] = [];
    if (documents) {
      documents.slice(0, 5).forEach((doc) => {
        entries.push({
          type: 'upload',
          label: 'Uploaded document',
          secondary: doc.filename,
          timestamp: new Date(doc.uploaded_at).getTime(),
          docId: doc.doc_id,
        });
      });
    }
    entries.sort((a, b) => b.timestamp - a.timestamp);
    setActivity(entries.slice(0, 5));
  }, [documents]);

  const docCount = documents?.length ?? 0;
  const totalChunks = useMemo(
    () => documents?.reduce((acc, d) => acc + d.chunk_count, 0) ?? 0,
    [documents],
  );
  const summarizedCount = useMemo(
    () => documents?.filter((d) => d.summary).length ?? 0,
    [documents],
  );

  const readingProgress = getReadingProgress();
  const continueEntries = Object.entries(readingProgress)
    .sort(([, a], [, b]) => b.lastOpened - a.lastOpened)
    .slice(0, 1);

  return (
    <div className="flex flex-col gap-8">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <h1 className="text-[28px] sm:text-[30px] font-display font-semibold tracking-tight">
          {getGreeting()}{user?.username ? `, ${user.username}` : ''}
        </h1>
        {!docsLoading && (
          <p className="text-body text-[rgb(var(--color-text-secondary))] mt-1.5">
            You have {docCount} document{docCount !== 1 ? 's' : ''} in your research library.
          </p>
        )}
      </motion.div>

      {/* Primary grid: Continue Reading | Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Continue where you left off */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Card padding="none" className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <svg className="w-[18px] h-[18px] text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <h2 className="text-h3 font-display font-semibold">Continue where you left off</h2>
                </div>
              </div>

              {continueEntries.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {continueEntries.map(([docId, data]) => (
                    <div key={docId} className="flex flex-col gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[rgb(var(--color-surface))] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-body truncate">{data.title}</p>
                          <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">
                            {data.progress}% complete
                          </p>
                          <div className="mt-2.5 w-full h-1.5 bg-[rgb(var(--color-border))] rounded-full overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-[rgb(var(--color-progress))]"
                              initial={{ width: 0 }}
                              animate={{ width: `${data.progress}%` }}
                              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate(`/documents/${docId}`)}
                        >
                          Resume reading &rarr;
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="w-12 h-12 rounded-xl bg-[rgb(var(--color-surface))] flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <p className="text-body font-medium">No reading activity yet</p>
                  <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-1">
                    Open a document to start building your reading history.
                  </p>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-4"
                    onClick={() => navigate('/documents')}
                  >
                    Browse documents
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Activity */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Card padding="none" className="overflow-hidden">
            <div className="p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <svg className="w-[18px] h-[18px] text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h2 className="text-h3 font-display font-semibold">Activity</h2>
              </div>

              {activity.length > 0 ? (
                <div className="flex flex-col gap-0 -mx-5">
                  {activity.map((entry, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-5 py-3 hover:bg-[rgb(var(--color-surface))] transition-colors cursor-pointer"
                      onClick={() => entry.docId && navigate(`/documents/${entry.docId}`)}
                    >
                      <div className="w-[6px] h-[6px] rounded-full bg-[rgb(var(--color-accent))] flex-shrink-0 mt-1.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-body text-[rgb(var(--color-text))] truncate">{entry.label}</p>
                        {entry.secondary && (
                          <p className="text-caption text-[rgb(var(--color-text-secondary))] truncate mt-0.5">
                            {entry.secondary}
                          </p>
                        )}
                      </div>
                      <span className="text-caption text-[rgb(var(--color-text-secondary))] flex-shrink-0 whitespace-nowrap">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="text-body text-[rgb(var(--color-text-secondary))]">
                    No recent activity
                  </p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <h2 className="text-h2 font-display font-semibold mb-4">Quick actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.onClick)}
              className="flex flex-col items-start gap-2.5 p-4 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-text-secondary))] transition-all duration-150 text-left"
            >
              <div className="w-[36px] h-[36px] rounded-[8px] bg-[rgb(var(--color-surface))] flex items-center justify-center flex-shrink-0">
                <svg className="w-[18px] h-[18px] text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={action.icon} />
                </svg>
              </div>
              <div>
                <p className="text-body font-medium">{action.label}</p>
                <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-0.5">
                  {action.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* Research Overview (compact stats) */}
      {!docsLoading && documents && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <h2 className="text-h2 font-display font-semibold mb-4">Research overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
              <p className="text-caption text-[rgb(var(--color-text-secondary))] font-medium">Documents</p>
              <p className="text-[22px] font-display font-semibold mt-1">{docCount}</p>
            </div>
            <div className="p-4 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
              <p className="text-caption text-[rgb(var(--color-text-secondary))] font-medium">Chunks</p>
              <p className="text-[22px] font-display font-semibold mt-1">{totalChunks.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
              <p className="text-caption text-[rgb(var(--color-text-secondary))] font-medium">Summarized</p>
              <p className="text-[22px] font-display font-semibold mt-1">{summarizedCount}</p>
            </div>
            <div className="p-4 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
              <p className="text-caption text-[rgb(var(--color-text-secondary))] font-medium">System</p>
              <p className="text-[22px] font-display font-semibold mt-1">
                {healthLoading ? (
                  <Skeleton variant="text" width={80} />
                ) : health?.status === 'healthy' ? (
                  'Healthy'
                ) : (
                  'Unavailable'
                )}
              </p>
            </div>
          </div>
        </motion.section>
      )}
    </div>
  );
}