import { useState } from 'react';
import { useDocuments } from '@/features/documents/hooks/useDocuments';
import { useToast } from '@/contexts/ToastContext';
import { Button, Card, Skeleton, EmptyState, ErrorState } from '@/components/ui';
import { documentsService } from '@/services/documents.service';
import type { CrossAnalysisSuccess, CrossAnalysisError } from '@/services/documents.service';

export function CrossAnalysisPage() {
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
      <div className="flex flex-col gap-6">
        <Skeleton variant="text" width={300} height={32} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={80} />
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
        primaryCta={{ label: 'Upload documents', onClick: () => window.location.href = '/upload' }}
      />
    );
  }

  const isSuccess = result && 'shared_concepts' in result;
  const isErrorState = result && 'success' in result && !isSuccess;

  return (
    <div className="flex flex-col gap-8 max-w-content">
      <div>
        <h1 className="text-h1 font-display">Cross-Document Analysis</h1>
        <p className="text-body text-[rgb(var(--color-text-secondary))] mt-1">
          Select at least 2 documents to find shared concepts and themes.
        </p>
      </div>

      {/* Document selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {documents.map((doc) => {
          const isSel = selected.has(doc.doc_id);
          return (
            <button
              key={doc.doc_id}
              onClick={() => toggleDoc(doc.doc_id)}
              className={`flex items-center gap-3 px-4 py-3 rounded border transition-all text-left ${
                isSel
                  ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/5'
                  : 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-text-secondary))]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSel
                    ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]'
                    : 'border-[rgb(var(--color-border))]'
                }`}
              >
                {isSel && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-body truncate">{doc.filename}</p>
                <p className="text-caption text-[rgb(var(--color-text-secondary))]">{doc.chunk_count} chunks</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleAnalyze} isLoading={isAnalyzing} disabled={selected.size < 2}>
          Analyze {selected.size >= 2 ? `(${selected.size} documents)` : '(select 2+)'}
        </Button>
      </div>

      {/* Needs more docs guidance */}
      {isErrorState && (
        <Card padding="md">
          <p className="text-body text-[rgb(var(--color-text-secondary))]">
            {(result as CrossAnalysisError).error}
          </p>
        </Card>
      )}

      {/* Results */}
      {isSuccess && (result as CrossAnalysisSuccess).shared_concepts.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h2 font-display">Shared Concepts</h2>
            <span className="text-caption text-[rgb(var(--color-text-secondary))]">
              Found in {(result as CrossAnalysisSuccess).document_count} documents
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {(result as CrossAnalysisSuccess).shared_concepts.map((concept, i) => (
              <Card key={i} padding="md">
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-h3 font-display">{concept.concept}</h3>
                    <p className="text-body text-[rgb(var(--color-text-secondary))] mt-1">{concept.relevance}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {concept.found_in.map((docName, j) => (
                      <span
                        key={j}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                      >
                        {docName}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

