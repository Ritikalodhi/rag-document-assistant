import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCollectionDetail } from '@/features/collections/hooks/useCollections';
import { Button, Badge, Skeleton, ErrorState } from '@/components/ui';
import { getFileType } from '@/utils/fileType';

const motionProps = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
});

export function CollectionDetailPage() {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();

  const { data: collection, isLoading, error, refetch } = useCollectionDetail(collectionId ?? '');

  if (!collectionId) return <ErrorState title="Missing collection ID" />;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton variant="text" width={250} height={32} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-5 border border-[rgb(var(--color-border))] rounded-[10px] bg-[rgb(var(--color-elevated))] flex flex-col gap-4">
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width="40%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) return <ErrorState onRetry={() => refetch()} />;
  if (!collection) return <ErrorState title="Collection not found" />;

  const docs = collection.documents ?? [];

  return (
    <div className="flex flex-col gap-7">
      {/* Breadcrumb */}
      <motion.nav {...motionProps(0)} aria-label="Breadcrumb">
        <Link
          to="/collections"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Collections
        </Link>
      </motion.nav>

      {/* Header */}
      <motion.div {...motionProps(0.03)}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] sm:text-[28px] font-display font-semibold tracking-tight text-[rgb(var(--color-text))]">{collection.name}</h1>
            <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mt-1 font-code">
              {docs.length} document{docs.length !== 1 ? 's' : ''}
              {' · '}Created {new Date(collection.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button variant="secondary" onClick={() => navigate('/upload')}>
            Add documents
          </Button>
        </div>
      </motion.div>

      {/* Document list / empty state */}
      {docs.length === 0 ? (
        <motion.div {...motionProps(0.06)}>
          <div className="p-10 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] text-center">
            <div className="w-11 h-11 rounded-[10px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-[14px] font-medium text-[rgb(var(--color-text))]">This collection is empty</p>
            <p className="text-[13px] text-[rgb(var(--color-text-secondary))] mt-1 max-w-sm mx-auto mb-5">
              Upload documents to add them to your research workspace.
            </p>
            <Button onClick={() => navigate('/upload')}>Upload a document</Button>
          </div>
        </motion.div>
      ) : (
        <motion.div {...motionProps(0.06)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {docs.map((doc) => (
              <div
                key={doc.doc_id}
                onClick={() => navigate(`/documents/${doc.doc_id}`)}
                className="flex flex-col justify-between p-4.5 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-text-tertiary))]/50 transition-all duration-150 cursor-pointer group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/documents/${doc.doc_id}`); }}
                aria-label={`Open ${doc.filename}`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-[8px] bg-[rgb(var(--color-surface))] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4.5 h-4.5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <Badge>{getFileType(doc.filename)}</Badge>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[15px] text-[rgb(var(--color-text))] truncate">{doc.filename}</h3>
                    <p className="text-[12px] font-code text-[rgb(var(--color-text-tertiary))] mt-1">
                      {doc.chunk_count} chunks{' · '}{new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[rgb(var(--color-border-subtle))] text-right">
                  <span className="text-[12px] font-medium text-[rgb(var(--color-accent))] group-hover:underline">
                    Open →
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}