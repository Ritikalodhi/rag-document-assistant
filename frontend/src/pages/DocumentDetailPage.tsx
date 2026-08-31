import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDocumentMetadata, useDocuments, useDeleteDocument } from '@/features/documents/hooks/useDocuments';
import { setLastViewedDocId } from '@/utils/lastDocument';

import {
  useDocumentSummary,
  useSuggestedQuestions,
  useStudyNotes,
  useDocumentVersions,
  useDocumentTables,
} from '@/features/documents/hooks/useDocumentDetail';
import { Button, Badge, Skeleton, ErrorState, Dialog } from '@/components/ui';
import { getFileType } from '@/utils/fileType';

type Tab = 'summary' | 'questions' | 'study-notes' | 'tables' | 'versions';

export function DocumentDetailPage() {
  const { docId } = useParams<{ docId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('summary');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteDoc = useDeleteDocument();

  const { data: documents } = useDocuments();
  const doc = documents?.find((d) => d.doc_id === docId);
  const { data: metadata } = useDocumentMetadata(docId ?? '');

  useEffect(() => {
    if (docId) setLastViewedDocId(docId);
  }, [docId]);

  if (!docId) return <ErrorState title="Missing document ID" />;

  const filename = doc?.filename ?? metadata?.filename ?? 'Loading...';
  const fileType = getFileType(filename);

  return (
    <div className="flex flex-col gap-6 max-w-content">
      {/* Back link */}
      <nav aria-label="Breadcrumb">
        <Link
          to="/documents"
          className="inline-flex items-center gap-1.5 text-caption text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Documents
        </Link>
      </nav>

      {/* Document header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0 mt-1 shadow-sm" style={{ background: 'linear-gradient(135deg, rgb(var(--color-accent))/15 0%, rgb(99,102,241)/15 100%)', border: '1px solid rgb(var(--color-accent))/20' }}>
            <svg className="w-6 h-6 text-[rgb(var(--color-accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-h1 font-display truncate">{filename}</h1>
            {metadata && (
              <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-1">
                {fileType}
                {doc && ` · ${doc.chunk_count} chunks`}
                {metadata && ` · Uploaded ${new Date(metadata.uploaded_at).toLocaleDateString()}`}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            }
            onClick={() => navigate(`/chat?docId=${docId}`)}
          >
            Ask AI
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            }
            onClick={() => setActiveTab('summary')}
          >
            Summarize
          </Button>
          <Button
            size="sm"
            variant="danger"
            leftIcon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            }
            onClick={() => setShowDeleteDialog(true)}
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[rgb(var(--color-border))]" role="tablist">
        <nav className="flex gap-1 -mb-px overflow-x-auto scrollbar-thin">
          {([
            { id: 'summary' as Tab, label: 'Summary' },
            { id: 'questions' as Tab, label: 'Questions' },
            { id: 'study-notes' as Tab, label: 'Study Notes' },
            { id: 'tables' as Tab, label: 'Tables' },
            { id: 'versions' as Tab, label: 'Versions' },
          ]).map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-4 py-3 text-[14px] font-medium border-b-2 transition-all duration-150 whitespace-nowrap rounded-t-[6px]',
                activeTab === tab.id
                  ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-text))] bg-[rgb(var(--color-accent))]/5'
                  : 'border-transparent text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-surface))]/50',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'summary' && <SummarySection docId={docId} />}
        {activeTab === 'questions' && <QuestionsSection docId={docId} />}
        {activeTab === 'study-notes' && <StudyNotesSection docId={docId} />}
        {activeTab === 'tables' && <TablesSection docId={docId} />}
        {activeTab === 'versions' && <VersionsSection docId={docId} />}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} title="Delete document">
        <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mb-6">
          Are you sure you want to delete <strong className="text-[rgb(var(--color-text))]">{filename}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button
            variant="danger"
            onClick={() => {
              deleteDoc.mutate(docId, {
                onSuccess: () => navigate('/documents'),
              });
              setShowDeleteDialog(false);
            }}
            isLoading={deleteDoc.isPending}
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

/* ─── Summary ─── */
function SummarySection({ docId }: { docId: string }) {
  const [generated, setGenerated] = useState(false);
  const summary = useDocumentSummary(docId);

  const handleGenerate = async () => {
    setGenerated(true);
    await summary.mutateAsync();
  };

  if (!generated && !summary.data) {
    return (
      <div className="py-12 text-center">
        <div className="w-10 h-10 rounded-xl bg-[rgb(var(--color-surface))] flex items-center justify-center mx-auto mb-4">
          <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        </div>
        <h3 className="text-h3 font-display font-semibold mb-2">Generate a research summary</h3>
        <p className="text-body text-[rgb(var(--color-text-secondary))] max-w-md mx-auto mb-6">
          Create an overview of the document including key topics, takeaways, and entities.
        </p>
        <Button onClick={handleGenerate} isLoading={summary.isPending}>
          Generate summary
        </Button>
      </div>
    );
  }

  if (summary.isPending) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="90%" />
        <Skeleton variant="text" width="40%" />
      </div>
    );
  }

  if (summary.data?.success && summary.data.summary) {
    return (
      <div className="flex flex-col gap-8 py-2">
        {/* Overview */}
        <div>
          <h3 className="text-h3 font-display font-semibold mb-3">Overview</h3>
          <p className="text-body leading-relaxed text-[rgb(var(--color-text))]">
            {summary.data.summary.executive_summary}
          </p>
        </div>

        {/* Key Topics */}
        {summary.data.summary.key_topics.length > 0 && (
          <div>
            <h3 className="text-h3 font-display font-semibold mb-3">Key topics</h3>
            <div className="flex flex-wrap gap-2">
              {summary.data.summary.key_topics.map((topic, i) => (
                <span key={i} className="px-3 py-1.5 rounded-[6px] text-caption font-medium bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Key Takeaways */}
        {summary.data.summary.key_takeaways.length > 0 && (
          <div>
            <h3 className="text-h3 font-display font-semibold mb-3">Key takeaways</h3>
            <ul className="flex flex-col gap-2">
              {summary.data.summary.key_takeaways.map((takeaway, i) => (
                <li key={i} className="flex items-start gap-3 text-body">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[rgb(var(--color-accent))] flex-shrink-0" />
                  {takeaway}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Entities */}
        {summary.data.summary.important_entities.length > 0 && (
          <div>
            <h3 className="text-h3 font-display font-semibold mb-3">Entities</h3>
            <div className="flex flex-wrap gap-2">
              {summary.data.summary.important_entities.map((entity, i) => (
                <Badge key={i} variant="default">{entity}</Badge>
              ))}
            </div>
          </div>
        )}

        {summary.data.cached && (
          <p className="text-caption text-[rgb(var(--color-text-secondary))]">Cached summary</p>
        )}
      </div>
    );
  }

  return (
    <div className="py-8 text-center">
      <p className="text-body text-[rgb(var(--color-text-secondary))] mb-4">
        {summary.data?.error ?? 'Failed to generate summary.'}
      </p>
      <Button variant="secondary" onClick={handleGenerate}>
        Retry
      </Button>
    </div>
  );
}

/* ─── Questions ─── */
function QuestionsSection({ docId }: { docId: string }) {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch } = useSuggestedQuestions(docId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="75%" />
        <Skeleton variant="text" width="50%" />
        <Skeleton variant="text" width="65%" />
        <Skeleton variant="text" width="55%" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load questions"
        message={(error as Error)?.message ?? 'An unexpected error occurred.'}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data?.success || !data.questions || data.questions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-body text-[rgb(var(--color-text-secondary))]">
          No suggested questions available for this document.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <h3 className="text-h3 font-display font-semibold">Suggested questions</h3>
      <p className="text-body text-[rgb(var(--color-text-secondary))]">
        Use these questions to explore the material further.
      </p>
      <div className="flex flex-col gap-2 mt-2">
        {data.questions.map((question, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-[8px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:bg-[rgb(var(--color-surface))] transition-colors group cursor-pointer"
            onClick={() => navigate(`/chat?docId=${docId}&question=${encodeURIComponent(question)}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/chat?docId=${docId}&question=${encodeURIComponent(question)}`); }}
            aria-label={`Ask: ${question}`}
          >
            <span className="flex-shrink-0 w-6 h-6 rounded-[4px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] flex items-center justify-center text-caption font-medium text-[rgb(var(--color-text-secondary))]">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="flex-1 text-body text-[rgb(var(--color-text))]">{question}</span>
            <svg className="w-4 h-4 text-[rgb(var(--color-text-secondary))] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Study Notes ─── */
function StudyNotesSection({ docId }: { docId: string }) {
  const { data, isLoading, isError, error, refetch } = useStudyNotes(docId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <Skeleton variant="text" width="45%" />
        <Skeleton variant="rectangular" height="80px" />
        <Skeleton variant="text" width="35%" />
        <Skeleton variant="rectangular" height="60px" />
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="rectangular" height="60px" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load study notes"
        message={(error as Error)?.message ?? 'An unexpected error occurred.'}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data?.success) {
    return (
      <div className="py-8 text-center">
        <p className="text-body text-[rgb(var(--color-text-secondary))]">
          No study notes available for this document.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-2">
      {/* Summary */}
      {data.summary && (
        <div>
          <h3 className="text-h3 font-display font-semibold mb-3">Summary</h3>
          <p className="text-body leading-relaxed">{data.summary}</p>
        </div>
      )}

      {/* Key Concepts */}
      {data.key_concepts.length > 0 && (
        <div>
          <h3 className="text-h3 font-display font-semibold mb-3">Key Concepts ({data.counts.key_concepts})</h3>
          <div className="flex flex-col gap-2">
            {data.key_concepts.map((concept, i) => (
              <div key={i} className="p-4 rounded-[8px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
                <p className="text-body font-medium mb-1">{concept.concept}</p>
                <p className="text-body text-[rgb(var(--color-text-secondary))]">{concept.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flashcards */}
      {data.flashcards.length > 0 && (
        <div>
          <h3 className="text-h3 font-display font-semibold mb-3">Flashcards ({data.counts.flashcards})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.flashcards.map((card, i) => (
              <div key={i} className="p-4 rounded-[8px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
                <p className="text-body font-medium mb-1">{card.front}</p>
                <p className="text-caption text-[rgb(var(--color-text-secondary))]">{card.back}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Viva Questions */}
      {data.viva_questions.length > 0 && (
        <div>
          <h3 className="text-h3 font-display font-semibold mb-3">Viva Questions ({data.counts.viva_questions})</h3>
          <div className="flex flex-col gap-2">
            {data.viva_questions.map((vq, i) => (
              <div key={i} className="p-4 rounded-[8px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
                <p className="text-body font-medium mb-1">{vq.question}</p>
                <p className="text-body text-[rgb(var(--color-text-secondary))]">{vq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MCQs */}
      {data.mcqs.length > 0 && (
        <div>
          <h3 className="text-h3 font-display font-semibold mb-3">Multiple Choice Questions ({data.counts.mcqs})</h3>
          <div className="flex flex-col gap-3">
            {data.mcqs.map((mcq, i) => (
              <div key={i} className="p-4 rounded-[8px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]">
                <p className="text-body font-medium mb-3">
                  {i + 1}. {mcq.question}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {mcq.options.map((option, j) => (
                    <li
                      key={j}
                      className={[
                        'px-3 py-2 rounded-[6px] border text-body',
                        option === mcq.correct
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                          : 'border-[rgb(var(--color-border))]',
                      ].join(' ')}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center flex-shrink-0">
                          {option === mcq.correct && <span className="w-2 h-2 rounded-full bg-current" />}
                        </span>
                        {option}
                        {option === mcq.correct && (
                          <span className="text-caption font-medium ml-auto">Correct</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tables ─── */
function TablesSection({ docId }: { docId: string }) {
  const { data, isLoading, isError, error, refetch } = useDocumentTables(docId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 py-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="rectangular" height="120px" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    const errorMsg = (error as any)?.response?.data?.detail ?? (error as Error)?.message ?? '';
    const isNonPdf = errorMsg.toLowerCase().includes('pdf');
    if (isNonPdf) {
      return (
        <div className="py-8 text-center">
          <p className="text-body text-[rgb(var(--color-text-secondary))]">
            Table extraction is only supported for PDF documents.
          </p>
        </div>
      );
    }
    return (
      <ErrorState
        title="Failed to load tables"
        message={errorMsg || 'An unexpected error occurred.'}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data?.tables || data.tables.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-body text-[rgb(var(--color-text-secondary))]">
          No tables extracted from this document.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      <h3 className="text-h3 font-display font-semibold">Extracted Tables ({data.tables.length})</h3>
      <div className="flex flex-col gap-6">
        {data.tables.map((table, index) => (
          <div key={table.id || `table-${index}`} className="rounded-[10px] border border-[rgb(var(--color-border))] overflow-hidden">
            {table.caption && (
              <div className="px-4 pt-4 pb-2">
                <p className="text-body font-medium">{table.caption}</p>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[rgb(var(--color-surface))]">
                    {table.headers.map((header, i) => (
                      <th
                        key={i}
                        className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[rgb(var(--color-text-tertiary))] border-b border-[rgb(var(--color-border))] whitespace-nowrap"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-[rgb(var(--color-border))] last:border-b-0 hover:bg-[rgb(var(--color-surface))]/60 transition-colors"
                    >
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="px-4 py-3 text-[14px] text-[rgb(var(--color-text))]"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Versions ─── */
function VersionsSection({ docId }: { docId: string }) {
  const { data, isLoading, isError, error, refetch } = useDocumentVersions(docId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 py-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" height="60px" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Failed to load versions"
        message={(error as Error)?.message ?? 'An unexpected error occurred.'}
        onRetry={() => refetch()}
      />
    );
  }

  if (!data?.versions || data.versions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-body text-[rgb(var(--color-text-secondary))]">
          No version history available for this document.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-2">
      <h3 className="text-h3 font-display font-semibold">Version History</h3>
      <div className="flex flex-col gap-2">
        {data.versions.map((version, i) => (
          <div
            key={version.version}
            className="flex items-center justify-between p-4 rounded-[8px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]"
          >
            <div className="flex items-center gap-3">
              <Badge variant="info">v{version.version}</Badge>
              <div>
                <p className="text-body font-medium">Version {version.version}</p>
                <p className="text-caption text-[rgb(var(--color-text-secondary))]">
                  {new Date(version.uploaded_at).toLocaleString()} · {version.char_count.toLocaleString()} chars
                </p>
              </div>
            </div>
            {i === 0 && (
              <span className="text-caption font-medium text-[rgb(var(--color-accent))]">Current</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}