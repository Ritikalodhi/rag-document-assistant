import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { Button, Skeleton } from '@/components/ui';
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
    href: '/upload',
    color: 'from-blue-500/20 to-blue-600/10',
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    borderHover: 'hover:border-blue-500/30',
  },
  {
    label: 'Ask AI',
    description: 'Question your library',
    icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
    href: '/chat',
    color: 'from-indigo-500/20 to-indigo-600/10',
    iconColor: 'text-indigo-400',
    iconBg: 'bg-indigo-500/15',
    borderHover: 'hover:border-indigo-500/30',
  },
  {
    label: 'Summarize',
    description: 'Condense any document',
    icon: 'M4 6h16M4 12h16M4 18h7',
    href: '/documents',
    color: 'from-amber-500/20 to-amber-600/10',
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
    borderHover: 'hover:border-amber-500/30',
  },
  {
    label: 'Compare',
    description: 'Diff two sources',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    href: '/compare',
    color: 'from-violet-500/20 to-violet-600/10',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-500/15',
    borderHover: 'hover:border-violet-500/30',
  },
  {
    label: 'Cross-Document',
    description: 'Analyze across files',
    icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
    href: '/cross-analysis',
    color: 'from-purple-500/20 to-purple-600/10',
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/15',
    borderHover: 'hover:border-purple-500/30',
  },
  {
    label: 'Collections',
    description: 'Organise your library',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    href: '/collections',
    color: 'from-emerald-500/20 to-emerald-600/10',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
    borderHover: 'hover:border-emerald-500/30',
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const activityIcons: Record<ActivityEntry['type'], string> = {
  upload: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
  summary: 'M4 6h16M4 12h16M4 18h7',
  query: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  compare: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  export: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12',
};

const statMeta = [
  { label: 'Documents', key: 'documents', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', iconBg: 'bg-blue-500/15', iconColor: 'text-blue-400' },
  { label: 'Total Chunks', key: 'chunks', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4', iconBg: 'bg-violet-500/15', iconColor: 'text-violet-400' },
  { label: 'Summarized', key: 'summarized', icon: 'M4 6h16M4 12h16M4 18h7', iconBg: 'bg-emerald-500/15', iconColor: 'text-emerald-400' },
  { label: 'System Status', key: 'status', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', iconBg: 'bg-amber-500/15', iconColor: 'text-amber-400' },
];

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

  const motionProps = (delay = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  });

  const statValues = [
    docCount,
    totalChunks.toLocaleString(),
    summarizedCount,
    healthLoading ? null : (health?.status === 'healthy' ? 'Healthy' : 'Unavailable'),
  ];

  const isStatusDanger = health?.status !== 'healthy' && !healthLoading;

  return (
    <div className="flex flex-col gap-7 max-w-7xl mx-auto pb-8">

      {/* ── Greeting Banner ── */}
      <motion.div {...motionProps(0)} className="relative overflow-hidden rounded-[20px] border border-[rgb(var(--color-border))] p-7 sm:p-9"
                  style={{ background: 'linear-gradient(135deg, rgb(var(--color-elevated)) 0%, rgb(var(--color-surface)) 100%)' }}>
        {/* Gradient orbs */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full pointer-events-none opacity-30"
             style={{ background: 'radial-gradient(circle, rgb(var(--color-accent)) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full pointer-events-none opacity-10"
             style={{ background: 'radial-gradient(circle, rgb(139,92,246) 0%, transparent 70%)', transform: 'translateY(30%)' }} />

        <div className="relative z-10">
          <p className="text-[12px] font-semibold text-[rgb(var(--color-text-tertiary))] uppercase tracking-[0.1em] mb-2">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-[28px] sm:text-[34px] font-display font-semibold tracking-tight text-[rgb(var(--color-text))]">
            {getGreeting()}{user?.username ? `, ${user.username}` : ''} 👋
          </h1>
          {docsLoading ? (
            <Skeleton variant="text" width={300} className="mt-3" />
          ) : (
            <p className="text-[15px] text-[rgb(var(--color-text-secondary))] mt-2 max-w-xl leading-relaxed">
              {docCount === 0
                ? 'Your research workspace is ready. Upload your first document to start extracting insights.'
                : `You have ${docCount} document${docCount !== 1 ? 's' : ''} in your research library ready for querying and analysis.`}
            </p>
          )}
          {docCount === 0 && !docsLoading && (
            <div className="mt-5">
              <Button size="md" onClick={() => navigate('/upload')}>
                Upload your first document →
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Primary Grid: Continue Reading | Activity ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">

        {/* Continue reading card */}
        <motion.div {...motionProps(0.05)}>
          <div className="h-full rounded-[16px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] p-6 shadow-[var(--shadow-sm)] hover:border-[rgb(var(--color-accent))]/30 transition-all duration-200">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[9px] bg-[rgb(var(--color-accent))]/10 flex items-center justify-center text-[rgb(var(--color-accent))]">
                  <svg className="w-[16px] h-[16px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <span className="text-[14px] font-semibold text-[rgb(var(--color-text))]">
                  Continue Reading
                </span>
              </div>
              {continueEntries[0] && (
                <div className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--color-text-tertiary))] bg-[rgb(var(--color-surface))] px-2.5 py-1 rounded-full border border-[rgb(var(--color-border))]">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{formatRelativeTime(continueEntries[0][1].lastOpened)}</span>
                </div>
              )}
            </div>

            {continueEntries.length > 0 ? (
              continueEntries.map(([docId, data]) => (
                <div key={docId}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-[10px] bg-[rgb(var(--color-accent))]/10 border border-[rgb(var(--color-accent))]/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-[rgb(var(--color-accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold text-[rgb(var(--color-text))] truncate leading-snug">
                          {data.title}
                        </p>
                        <p className="text-[13px] text-[rgb(var(--color-text-secondary))] mt-0.5">
                          {data.progress}% completed
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => navigate(`/documents/${docId}`)}
                      className="flex-shrink-0 whitespace-nowrap"
                    >
                      Resume →
                    </Button>
                  </div>

                  <div className="mt-5">
                    <div className="w-full h-1.5 bg-[rgb(var(--color-surface))] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, rgb(var(--color-accent)), rgb(99,102,241))' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${data.progress}%` }}
                        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] font-code text-[rgb(var(--color-text-tertiary))]">
                      {data.progress}% through document
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="w-12 h-12 rounded-[14px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="text-[14px] font-semibold text-[rgb(var(--color-text))]">No reading activity yet</p>
                <p className="text-[13px] text-[rgb(var(--color-text-secondary))] mt-1 max-w-[240px] leading-snug">
                  Open a document to start building your reading progress.
                </p>
                <Button size="sm" variant="secondary" className="mt-4" onClick={() => navigate('/documents')}>
                  Browse library
                </Button>
              </div>
            )}
          </div>
        </motion.div>

        {/* Activity panel */}
        <motion.div {...motionProps(0.1)}>
          <div className="h-full rounded-[16px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] p-5 shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-[8px] bg-[rgb(var(--color-accent))]/10 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[rgb(var(--color-accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-[13px] font-bold text-[rgb(var(--color-text))] uppercase tracking-[0.07em]">
                Recent Activity
              </h2>
            </div>

            {docsLoading ? (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton variant="circular" width={28} height={28} />
                    <div className="flex-1 flex flex-col gap-1.5">
                      <Skeleton variant="text" width="70%" />
                      <Skeleton variant="text" width="50%" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length > 0 ? (
              <div className="relative">
                <div className="absolute left-[13px] top-4 bottom-4 w-px bg-[rgb(var(--color-border))]" aria-hidden="true" />
                <div className="flex flex-col gap-4">
                  {activity.map((entry, i) => (
                    <button
                      key={i}
                      className="relative flex items-start gap-3 text-left group transition-opacity hover:opacity-85"
                      onClick={() => entry.docId && navigate(`/documents/${entry.docId}`)}
                      aria-label={`${entry.label}: ${entry.secondary ?? ''}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] flex items-center justify-center flex-shrink-0 z-10 group-hover:border-[rgb(var(--color-accent))]/50 group-hover:bg-[rgb(var(--color-accent))]/8 transition-all">
                        <svg className="w-3.5 h-3.5 text-[rgb(var(--color-text-secondary))] group-hover:text-[rgb(var(--color-accent))] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={activityIcons[entry.type]} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p className="text-[13px] font-medium text-[rgb(var(--color-text))] leading-snug group-hover:text-[rgb(var(--color-accent))] transition-colors">
                          {entry.label}
                        </p>
                        {entry.secondary && (
                          <p className="text-[12px] text-[rgb(var(--color-text-secondary))] truncate mt-0.5">
                            {entry.secondary}
                          </p>
                        )}
                        <p className="text-[11px] text-[rgb(var(--color-text-tertiary))] mt-1 font-code">
                          {formatRelativeTime(entry.timestamp)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-[13px] text-[rgb(var(--color-text-secondary))]">No recent activity recorded</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ── Quick Actions ── */}
      <motion.section {...motionProps(0.15)}>
        <h2 className="text-[11px] font-bold text-[rgb(var(--color-text-tertiary))] uppercase tracking-[0.1em] mb-3.5">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.href)}
              className={`flex flex-col items-start gap-3 p-4 rounded-[14px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:shadow-[var(--shadow-md)] transition-all duration-200 text-left group shadow-[var(--shadow-sm)] hover:-translate-y-0.5 active:scale-[0.98] ${action.borderHover}`}
            >
              <div className={`w-9 h-9 rounded-[10px] ${action.iconBg} flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110`}>
                <svg className={`w-[18px] h-[18px] ${action.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={action.icon} />
                </svg>
              </div>
              <div>
                <p className="text-[13.5px] font-semibold text-[rgb(var(--color-text))] leading-snug">{action.label}</p>
                <p className="text-[11.5px] text-[rgb(var(--color-text-secondary))] mt-0.5 leading-snug">
                  {action.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </motion.section>

      {/* ── Research Overview Stats ── */}
      {!docsLoading && documents && (
        <motion.section {...motionProps(0.2)}>
          <h2 className="text-[11px] font-bold text-[rgb(var(--color-text-tertiary))] uppercase tracking-[0.1em] mb-3.5">
            Research Overview
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {statMeta.map((stat, index) => {
              const val = statValues[index];
              const isDanger = stat.key === 'status' && isStatusDanger;
              return (
                <div
                  key={stat.label}
                  className="p-5 rounded-[16px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] shadow-[var(--shadow-sm)] flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-[rgb(var(--color-text-tertiary))] uppercase tracking-[0.08em]">
                      {stat.label}
                    </p>
                    <div className={`w-7 h-7 rounded-[8px] ${stat.iconBg} flex items-center justify-center`}>
                      <svg className={`w-3.5 h-3.5 ${stat.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                      </svg>
                    </div>
                  </div>
                  <p className={`text-[26px] sm:text-[28px] font-display font-semibold tracking-tight leading-none ${
                    isDanger ? 'text-[rgb(var(--color-danger))]' : 'text-[rgb(var(--color-text))]'
                  }`}>
                    {val === null ? (
                      <Skeleton variant="text" width={60} />
                    ) : (
                      val
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.section>
      )}
    </div>
  );
}