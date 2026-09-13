import { motion } from 'framer-motion';
import { useAnalytics } from '@/features/analytics/hooks/useAnalytics';
import { Skeleton, EmptyState, ErrorState } from '@/components/ui';

interface StatCardDef {
  label: string;
  value: string | number | null;
  icon: string;
  iconBg: string;
  iconColor: string;
}

const motionProps = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
});

export function AnalyticsPage() {
  const { data: analytics, isLoading, error, refetch } = useAnalytics();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton variant="text" width={200} height={32} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-5 border border-[rgb(var(--color-border))] rounded-[14px] bg-[rgb(var(--color-elevated))] flex flex-col gap-3">
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="60%" height={28} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <ErrorState onRetry={() => refetch()} />;
  if (!analytics) return <EmptyState title="No analytics data available" description="Start using the application to see analytics." />;

  const stats: StatCardDef[] = [
    {
      label: 'Total Documents',
      value: analytics.total_documents,
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      iconBg: 'bg-[rgb(var(--color-accent-muted))]',
      iconColor: 'text-[rgb(var(--color-accent))]',
    },
    {
      label: 'Total Chunks',
      value: analytics.total_chunks.toLocaleString(),
      icon: 'M4 6h16M4 12h16M4 18h16',
      iconBg: 'bg-[rgb(var(--color-surface))]',
      iconColor: 'text-[rgb(var(--color-accent))]',
    },
    {
      label: 'Total Queries',
      value: analytics.total_queries,
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      iconBg: 'bg-[rgb(var(--color-surface))]',
      iconColor: 'text-[rgb(var(--color-text-secondary))]',
    },
    {
      label: 'Queries Today',
      value: analytics.queries_today,
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      iconBg: 'bg-[rgb(var(--color-surface))]',
      iconColor: 'text-[rgb(var(--color-text-secondary))]',
    },
    {
      label: 'Most Queried Document',
      value: analytics.most_queried_document,
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      iconBg: 'bg-[rgb(var(--color-surface))]',
      iconColor: 'text-[rgb(var(--color-text-secondary))]',
    },
    {
      label: 'Documents Summarized',
      value: analytics.documents_summarized,
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      iconBg: 'bg-[rgb(var(--color-accent-muted))]',
      iconColor: 'text-[rgb(var(--color-accent))]',
    },
    {
      label: 'Retrieval Mode',
      value: analytics.retrieval_mode,
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      iconBg: 'bg-[rgb(var(--color-surface))]',
      iconColor: 'text-[rgb(var(--color-text-secondary))]',
    },
  ];

  // Render any additional keys from the response that aren't in our known list
  const knownKeys = new Set([
    'total_documents', 'total_chunks', 'bm25_indexed_chunks', 'retrieval_mode',
    'total_queries', 'queries_today', 'most_queried_document', 'documents_summarized',
  ]);
  const extraKeys = Object.keys(analytics).filter((k) => !knownKeys.has(k));

  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <motion.div {...motionProps(0)}>
        <h1 className="text-[26px] sm:text-[28px] font-display font-semibold tracking-tight text-[rgb(var(--color-text))]">Analytics</h1>
        <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mt-1">
          System telemetry and workspace usage statistics.
        </p>
      </motion.div>

      {/* Main stat cards */}
      <motion.div {...motionProps(0.05)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="p-5 rounded-[14px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] shadow-[var(--shadow-sm)] flex flex-col gap-4 hover:border-[rgb(var(--color-accent-muted))] hover:shadow-[var(--shadow-md),0_0_16px_-8px_var(--glow-color)] transition-all duration-200"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--color-text-tertiary))]">
                {stat.label}
              </p>
              <div className={`w-8 h-8 rounded-[9px] ${stat.iconBg} flex items-center justify-center`}>
                <svg className={`w-4 h-4 ${stat.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                </svg>
              </div>
            </div>
            <p className="text-[26px] font-display font-semibold text-[rgb(var(--color-text))] truncate leading-none">
              {stat.value ?? '—'}
            </p>
          </div>
        ))}
      </motion.div>

      {/* Render extra unknown fields defensively */}
      {extraKeys.length > 0 && (
        <motion.section {...motionProps(0.08)}>
          <h2 className="text-[11px] font-bold text-[rgb(var(--color-text-tertiary))] uppercase tracking-[0.1em] mb-3.5">
            Additional Telemetry
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {extraKeys.map((key) => (
              <div key={key} className="p-5 rounded-[14px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-tertiary))]">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                <p className="text-[22px] font-display font-semibold text-[rgb(var(--color-text))] mt-2">
                  {String(analytics[key] ?? '—')}
                </p>
              </div>
            ))}
          </div>
        </motion.section>
      )}
    </div>
  );
}