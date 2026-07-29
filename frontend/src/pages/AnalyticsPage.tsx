import { useAnalytics } from '@/features/analytics/hooks/useAnalytics';
import { Card, Skeleton, EmptyState, ErrorState } from '@/components/ui';

interface StatCardDef {
  label: string;
  value: string | number | null;
  icon: string;
  color: string;
}

export function AnalyticsPage() {
  const { data: analytics, isLoading, error, refetch } = useAnalytics();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton variant="text" width={200} height={32} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="p-6 border border-[rgb(var(--color-border))] rounded flex flex-col gap-3">
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
      color: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Total Chunks',
      value: analytics.total_chunks.toLocaleString(),
      icon: 'M4 6h16M4 12h16M4 18h16',
      color: 'from-indigo-500 to-indigo-600',
    },
    {
      label: 'Total Queries',
      value: analytics.total_queries,
      icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      color: 'from-purple-500 to-purple-600',
    },
    {
      label: 'Queries Today',
      value: analytics.queries_today,
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'from-teal-500 to-teal-600',
    },
    {
      label: 'Most Queried Document',
      value: analytics.most_queried_document,
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      color: 'from-amber-500 to-amber-600',
    },
    {
      label: 'Documents Summarized',
      value: analytics.documents_summarized,
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      color: 'from-rose-500 to-rose-600',
    },
    {
      label: 'Retrieval Mode',
      value: analytics.retrieval_mode,
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      color: 'from-cyan-500 to-cyan-600',
    },
  ];

  // Render any additional keys from the response that aren't in our known list
  const knownKeys = new Set([
    'total_documents', 'total_chunks', 'bm25_indexed_chunks', 'retrieval_mode',
    'total_queries', 'queries_today', 'most_queried_document', 'documents_summarized',
  ]);
  const extraKeys = Object.keys(analytics).filter((k) => !knownKeys.has(k));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-h1 font-display">Analytics</h1>
        <p className="text-body text-[rgb(var(--color-text-secondary))] mt-1">
          Usage statistics and insights for your workspace.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} padding="md">
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center flex-shrink-0`}>
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-caption text-[rgb(var(--color-text-secondary))]">{stat.label}</p>
                <p className="text-h2 font-display mt-1">
                  {stat.value ?? '—'}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Render extra unknown fields defensively */}
      {extraKeys.length > 0 && (
        <section>
          <h2 className="text-h2 font-display mb-4">Additional Metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {extraKeys.map((key) => (
              <Card key={key} padding="md">
                <p className="text-caption text-[rgb(var(--color-text-secondary))]">
                  {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </p>
                <p className="text-h2 font-display mt-1">
                  {String(analytics[key] ?? '—')}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

