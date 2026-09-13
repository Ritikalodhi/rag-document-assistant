import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { useToast } from '@/contexts/ToastContext';
import { Button, Skeleton, EmptyState, ErrorState } from '@/components/ui';
import { documentsService } from '@/services/documents.service';
import type { CrossAnalysisSuccess, CrossAnalysisError } from '@/services/documents.service';

const motionProps = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
});

export function CrossAnalysisPage() {
  const navigate = useNavigate();
  const { data: documents, isLoading, error, refetch } = useDocuments();
  const { addToast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<CrossAnalysisSuccess | CrossAnalysisError | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const toggleDoc = (docId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) next.delete(docId);
      else next.add(docId);
      return next;
    });
  };

  const handleAnalyze = async () => {
    if (selected.size < 2) return;
    setIsAnalyzing(true);
    setResult(null);
    try {
      const resultData = await documentsService.crossAnalysis(Array.from(selected));
      setResult(resultData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      addToast('error', msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-content">
        <Skeleton variant="text" width={260} height={32} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={70} />
          ))}
        </div>
      </div>
    );
  }

  if (error) return <ErrorState onRetry={() => refetch()} />;

  if (!documents || documents.length < 2) {
    return (
      <EmptyState
        title="Need at least 2 documents"
        description="Upload more documents to perform cross-document analysis."
        primaryCta={{ label: 'Upload documents', onClick: () => navigate('/upload') }}
      />
    );
  }

  const isSuccess = result && 'shared_concepts' in result;
  const isErrorState = result && 'success' in result && !isSuccess;

  return (
    <div className="flex flex-col gap-7 max-w-content">
      {/* Header */}
      <motion.div {...motionProps(0)}>
        <h1 className="text-[26px] sm:text-[28px] font-display font-semibold tracking-tight text-[rgb(var(--color-text))]">Cross-Document Analysis</h1>
        <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mt-1">
          Select 2 or more files to analyze overlapping themes, shared concepts, and connections across your library.
        </p>
      </motion.div>

      {/* Document selector cards */}
      <motion.div {...motionProps(0.05)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {documents.map((doc) => {
          const isSel = selected.has(doc.doc_id);
          return (
            <button
              key={doc.doc_id}
              onClick={() => toggleDoc(doc.doc_id)}
              className={`flex items-center gap-3 p-3.5 rounded-[10px] border transition-all duration-150 text-left ${isSel
                  ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent-muted))]'
                  : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-text-tertiary))]/50'
                }`}
            >
              <div
                className={`w-4.5 h-4.5 rounded-[5px] border flex items-center justify-center flex-shrink-0 transition-colors ${isSel
                    ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))] text-[rgb(var(--color-bg))]'
                    : 'border-[rgb(var(--color-border))]'
                  }`}
              >
                {isSel && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-medium text-[rgb(var(--color-text))] truncate">{doc.filename}</p>
                <p className="text-[12px] font-code text-[rgb(var(--color-text-tertiary))]">{doc.chunk_count} chunks</p>
              </div>
            </button>
          );
        })}
      </motion.div>

      {/* Action button */}
      <motion.div {...motionProps(0.08)} className="flex items-center gap-3">
        <Button onClick={handleAnalyze} isLoading={isAnalyzing} disabled={selected.size < 2}>
          Analyze {selected.size >= 2 ? `(${selected.size} documents)` : '(select 2+)'}
        </Button>
      </motion.div>

      {/* Backend error state */}
      {isErrorState && (
        <motion.div {...motionProps(0.1)}>
          <div className="p-4 rounded-[10px] border border-red-200 bg-red-50 text-[14px] text-red-600 font-medium dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-400">
            {(result as CrossAnalysisError).error}
          </div>
        </motion.div>
      )}

      {/* Results area */}
      {isSuccess && (result as CrossAnalysisSuccess).shared_concepts.length > 0 && (
        <motion.div {...motionProps(0.12)} className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-display font-semibold text-[rgb(var(--color-text))]">Shared Concepts</h2>
            <span className="text-[12px] font-code text-[rgb(var(--color-text-tertiary))]">
              Found across {(result as CrossAnalysisSuccess).document_count} documents
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {(result as CrossAnalysisSuccess).shared_concepts.map((concept, i) => (
              <div key={i} className="p-5 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] flex flex-col gap-3">
                <div>
                  <h3 className="text-[16px] font-display font-semibold text-[rgb(var(--color-text))]">{concept.concept}</h3>
                  <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mt-1 leading-relaxed">{concept.relevance}</p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1 border-t border-[rgb(var(--color-border-subtle))]">
                  {concept.found_in.map((docName, j) => (
                    <span
                      key={j}
                      className="inline-flex items-center px-2.5 py-1 rounded-[6px] text-[12px] font-medium bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))] border border-[rgb(var(--color-border))]"
                    >
                      {docName}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}