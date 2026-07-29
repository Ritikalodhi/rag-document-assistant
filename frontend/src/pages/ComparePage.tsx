import { useState } from 'react';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { useToast } from '@/contexts/ToastContext';
import { Button, Card, Skeleton, EmptyState, ErrorState } from '@/components/ui';
import { documentsService } from '@/services/documents.service';
import type { ComparisonResult } from '@/services/documents.service';

export function ComparePage() {
  const { data: documents, isLoading, error, refetch } = useDocuments();
  const { addToast } = useToast();
  const [docA, setDocA] = useState('');
  const [docB, setDocB] = useState('');
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const handleCompare = async () => {
    if (!docA || !docB) return;
    setIsComparing(true);
    setResult(null);
    try {
      const resultData = await documentsService.compare(docA, docB);
      setResult(resultData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Comparison failed';
      addToast('error', msg);
    } finally {
      setIsComparing(false);
    }
  };

  const handleExportComparison = () => {
    if (!result?.comparison) return;
    const c = result.comparison;
    const md = [
      `# Document Comparison`,
      ``,
      `**Document A**: ${result.document_a}`,
      `**Document B**: ${result.document_b}`,
      `**Overall Match**: ${c.overall_match_percent}%`,
      ``,
      `## Matching Points`,
      ...c.matching_points.map((p) => `- ${p}`),
      ``,
      `## Missing in A`,
      ...c.missing_in_a.map((p) => `- ${p}`),
      ``,
      `## Missing in B`,
      ...c.missing_in_b.map((p) => `- ${p}`),
      ``,
      `## Recommendations`,
      ...c.recommendations.map((p) => `- ${p}`),
    ].join('\n');

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparison-${result.document_a}-vs-${result.document_b}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast('success', 'Comparison exported');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton variant="text" width={200} height={32} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton variant="rectangular" height={120} />
          <Skeleton variant="rectangular" height={120} />
        </div>
      </div>
    );
  }

  if (error) return <ErrorState onRetry={() => refetch()} />;

  if (!documents || documents.length < 2) {
    return (
      <EmptyState
        title="Need at least 2 documents"
        description="Upload more documents to compare them side by side."
        primaryCta={{ label: 'Upload documents', onClick: () => window.location.href = '/upload' }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8 max-w-content">
      <div>
        <h1 className="text-h1 font-display">Compare Documents</h1>
        <p className="text-body text-[rgb(var(--color-text-secondary))] mt-1">
          Select two documents to compare their content.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="text-caption font-medium text-[rgb(var(--color-text-secondary))] block mb-2">
            Document A
          </label>
          <select
            value={docA}
            onChange={(e) => setDocA(e.target.value)}
            className="w-full px-3 py-2.5 text-body bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded focus-ring"
            aria-label="Select document A"
          >
            <option value="">Select a document...</option>
            {documents.map((doc) => (
              <option key={doc.doc_id} value={doc.doc_id} disabled={doc.doc_id === docB}>
                {doc.filename}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-caption font-medium text-[rgb(var(--color-text-secondary))] block mb-2">
            Document B
          </label>
          <select
            value={docB}
            onChange={(e) => setDocB(e.target.value)}
            className="w-full px-3 py-2.5 text-body bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded focus-ring"
            aria-label="Select document B"
          >
            <option value="">Select a document...</option>
            {documents.map((doc) => (
              <option key={doc.doc_id} value={doc.doc_id} disabled={doc.doc_id === docA}>
                {doc.filename}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleCompare} isLoading={isComparing} disabled={!docA || !docB}>
          Compare
        </Button>
        {result?.comparison && (
          <Button variant="secondary" onClick={handleExportComparison}>
            Export comparison
          </Button>
        )}
      </div>

      {/* Error response from backend (success: false) */}
      {result && !result.success && (
        <Card padding="md">
          <p className="text-body text-red-500">{result.error ?? 'Comparison failed.'}</p>
        </Card>
      )}

      {/* Comparison results */}
      {result?.comparison && (
        <div className="flex flex-col gap-6">
          {/* Match percentage */}
          <Card padding="md">
            <div className="flex items-center justify-between">
              <span className="text-h2 font-display">Overall Match</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-16 h-16 rounded-full border-4 flex items-center justify-center text-h3 font-display"
                  style={{
                    borderColor:
                      result.comparison.overall_match_percent >= 80
                        ? 'rgb(var(--color-accent))'
                        : result.comparison.overall_match_percent >= 50
                          ? 'rgb(234, 179, 8)'
                          : 'rgb(239, 68, 68)',
                  }}
                >
                  {result.comparison.overall_match_percent}%
                </div>
              </div>
            </div>
          </Card>

          {/* Matching Points */}
          {result.comparison.matching_points.length > 0 && (
            <section>
              <h2 className="text-h2 font-display mb-4">Matching Points</h2>
              <div className="flex flex-col gap-2">
                {result.comparison.matching_points.map((point, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 rounded bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-caption flex-shrink-0">✓</span>
                    <p className="text-body">{point}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Missing in A */}
          {result.comparison.missing_in_a.length > 0 && (
            <section>
              <h2 className="text-h2 font-display mb-4">Missing in Document A</h2>
              <div className="flex flex-col gap-2">
                {result.comparison.missing_in_a.map((point, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 rounded bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-yellow-500 text-white flex items-center justify-center text-caption flex-shrink-0">!</span>
                    <p className="text-body">{point}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Missing in B */}
          {result.comparison.missing_in_b.length > 0 && (
            <section>
              <h2 className="text-h2 font-display mb-4">Missing in Document B</h2>
              <div className="flex flex-col gap-2">
                {result.comparison.missing_in_b.map((point, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 rounded bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-caption flex-shrink-0">!</span>
                    <p className="text-body">{point}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recommendations */}
          {result.comparison.recommendations.length > 0 && (
            <section>
              <h2 className="text-h2 font-display mb-4">Recommendations</h2>
              <div className="flex flex-col gap-2">
                {result.comparison.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 rounded bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-caption flex-shrink-0">→</span>
                    <p className="text-body">{rec}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

