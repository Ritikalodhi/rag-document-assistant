import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { useToast } from '@/contexts/ToastContext';
import { Button, Skeleton, EmptyState, ErrorState } from '@/components/ui';
import { documentsService } from '@/services/documents.service';
import type { ComparisonResult } from '@/services/documents.service';

const motionProps = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
});

export function ComparePage() {
  const navigate = useNavigate();
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
      <div className="flex flex-col gap-6 max-w-content">
        <Skeleton variant="text" width={220} height={32} />
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
        primaryCta={{ label: 'Upload documents', onClick: () => navigate('/upload') }}
      />
    );
  }

  const selectedDocA = documents.find((d) => d.doc_id === docA);
  const selectedDocB = documents.find((d) => d.doc_id === docB);

  return (
    <div className="flex flex-col gap-7 max-w-content">
      {/* Header */}
      <motion.div {...motionProps(0)}>
        <h1 className="text-[26px] sm:text-[28px] font-display font-semibold tracking-tight text-[rgb(var(--color-text))]">Compare Documents</h1>
        <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mt-1">
          Diff two sources side by side to uncover similarities, gaps, and recommendations.
        </p>
      </motion.div>

      {/* Side-by-side source selector cards */}
      <motion.div {...motionProps(0.05)} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="p-5 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-tertiary))] mb-3">
            <span className="w-5 h-5 rounded-full bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] flex items-center justify-center text-[10px] font-bold">A</span>
            Document A
          </label>
          <select
            value={docA}
            onChange={(e) => setDocA(e.target.value)}
            className="w-full px-3 py-2.5 text-[14px] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] border border-[rgb(var(--color-border))] rounded-[8px] focus:outline-none focus:border-[rgb(var(--color-accent))] transition-colors"
            aria-label="Select document A"
          >
            <option value="">Select a document...</option>
            {documents.map((doc) => (
              <option key={doc.doc_id} value={doc.doc_id} disabled={doc.doc_id === docB}>
                {doc.filename}
              </option>
            ))}
          </select>
          {selectedDocA && (
            <div className="flex items-center gap-2 mt-2.5 text-[12px] text-[rgb(var(--color-text-tertiary))] font-code">
              <span>{selectedDocA.chunk_count} chunks</span>
              <span>·</span>
              <span>{new Date(selectedDocA.uploaded_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        <div className="p-5 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
          <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[rgb(var(--color-text-tertiary))] mb-3">
            <span className="w-5 h-5 rounded-full bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] flex items-center justify-center text-[10px] font-bold">B</span>
            Document B
          </label>
          <select
            value={docB}
            onChange={(e) => setDocB(e.target.value)}
            className="w-full px-3 py-2.5 text-[14px] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] border border-[rgb(var(--color-border))] rounded-[8px] focus:outline-none focus:border-[rgb(var(--color-accent))] transition-colors"
            aria-label="Select document B"
          >
            <option value="">Select a document...</option>
            {documents.map((doc) => (
              <option key={doc.doc_id} value={doc.doc_id} disabled={doc.doc_id === docA}>
                {doc.filename}
              </option>
            ))}
          </select>
          {selectedDocB && (
            <div className="flex items-center gap-2 mt-2.5 text-[12px] text-[rgb(var(--color-text-tertiary))] font-code">
              <span>{selectedDocB.chunk_count} chunks</span>
              <span>·</span>
              <span>{new Date(selectedDocB.uploaded_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Action row */}
      <motion.div {...motionProps(0.08)} className="flex items-center gap-3">
        <Button onClick={handleCompare} isLoading={isComparing} disabled={!docA || !docB}>
          Compare sources
        </Button>
        {result?.comparison && (
          <Button variant="secondary" onClick={handleExportComparison}>
            Export markdown
          </Button>
        )}
      </motion.div>

      {/* Error state */}
      {result && !result.success && (
        <motion.div {...motionProps(0.1)}>
          <div className="p-4 rounded-[10px] border border-red-200 bg-red-50 text-[14px] text-red-600 font-medium dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-400">
            {result.error ?? 'Comparison failed.'}
          </div>
        </motion.div>
      )}

      {/* Comparison results */}
      {result?.comparison && (
        <motion.div {...motionProps(0.12)} className="flex flex-col gap-6">
          {/* Overall Match score */}
          <div className="p-5 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-display font-semibold text-[rgb(var(--color-text))]">Overall Match Score</h2>
              <p className="text-[13px] text-[rgb(var(--color-text-secondary))] mt-0.5">Similarity index between selected sources</p>
            </div>
            <div
              className="w-14 h-14 rounded-full border-2 flex items-center justify-center text-[18px] font-display font-semibold tabular-nums"
              style={{
                borderColor:
                  result.comparison.overall_match_percent >= 80
                    ? 'rgb(var(--color-success))'
                    : result.comparison.overall_match_percent >= 50
                      ? 'rgb(234, 179, 8)'
                      : 'rgb(239, 68, 68)',
                color:
                  result.comparison.overall_match_percent >= 80
                    ? 'rgb(var(--color-success))'
                    : result.comparison.overall_match_percent >= 50
                      ? 'rgb(234, 179, 8)'
                      : 'rgb(239, 68, 68)',
              }}
            >
              {result.comparison.overall_match_percent}%
            </div>
          </div>

          {/* Matching Points */}
          {result.comparison.matching_points.length > 0 && (
            <section>
              <h2 className="text-[13px] font-semibold text-[rgb(var(--color-text-secondary))] uppercase tracking-wider mb-3">Matching Points</h2>
              <div className="flex flex-col gap-2">
                {result.comparison.matching_points.map((point, i) => (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-[8px] bg-emerald-500/5 border border-emerald-500/20 text-[14px] text-[rgb(var(--color-text))]">
                    <span className="mt-0.5 w-4.5 h-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">✓</span>
                    <p className="leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Missing in A */}
          {result.comparison.missing_in_a.length > 0 && (
            <section>
              <h2 className="text-[13px] font-semibold text-[rgb(var(--color-text-secondary))] uppercase tracking-wider mb-3">Missing in Document A</h2>
              <div className="flex flex-col gap-2">
                {result.comparison.missing_in_a.map((point, i) => (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-[8px] bg-amber-500/5 border border-amber-500/20 text-[14px] text-[rgb(var(--color-text))]">
                    <span className="mt-0.5 w-4.5 h-4.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">!</span>
                    <p className="leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Missing in B */}
          {result.comparison.missing_in_b.length > 0 && (
            <section>
              <h2 className="text-[13px] font-semibold text-[rgb(var(--color-text-secondary))] uppercase tracking-wider mb-3">Missing in Document B</h2>
              <div className="flex flex-col gap-2">
                {result.comparison.missing_in_b.map((point, i) => (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-[8px] bg-orange-500/5 border border-orange-500/20 text-[14px] text-[rgb(var(--color-text))]">
                    <span className="mt-0.5 w-4.5 h-4.5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">!</span>
                    <p className="leading-relaxed">{point}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recommendations */}
          {result.comparison.recommendations.length > 0 && (
            <section>
              <h2 className="text-[13px] font-semibold text-[rgb(var(--color-text-secondary))] uppercase tracking-wider mb-3">Recommendations</h2>
              <div className="flex flex-col gap-2">
                {result.comparison.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3.5 rounded-[8px] bg-blue-500/5 border border-blue-500/20 text-[14px] text-[rgb(var(--color-text))]">
                    <span className="mt-0.5 w-4.5 h-4.5 rounded-full bg-[rgb(var(--color-accent))] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">→</span>
                    <p className="leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      )}
    </div>
  );
}