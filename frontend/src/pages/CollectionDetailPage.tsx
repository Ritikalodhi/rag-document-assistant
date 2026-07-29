import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCollectionDetail } from '@/features/collections/hooks/useCollections';
import { Button, Card, Badge, Skeleton, ErrorState } from '@/components/ui';
import { getFileType } from '@/utils/fileType';

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
            <div key={i} className="p-6 border border-[rgb(var(--color-border))] rounded flex flex-col gap-4">
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
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb">
        <Link
          to="/collections"
          className="text-caption text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] transition-colors"
        >
          &larr; Back to Collections
        </Link>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-display">{collection.name}</h1>
          <p className="text-body text-[rgb(var(--color-text-secondary))] mt-1">
            {docs.length} document{docs.length !== 1 ? 's' : ''}
            {' · '}Created {new Date(collection.created_at).toLocaleDateString()}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate('/upload')}>
          Add documents
        </Button>
      </div>

      {docs.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-8">
            <p className="text-body text-[rgb(var(--color-text-secondary))] mb-4">
              This collection is empty. Upload documents and assign them to this collection.
            </p>
            <Button onClick={() => navigate('/upload')}>Upload a document</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc) => (
            <Card
              key={doc.doc_id}
              hover
              onClick={() => navigate(`/documents/${doc.doc_id}`)}
            >
              <div className="flex flex-col gap-3">
                <div className="w-10 h-10 rounded-lg bg-[rgb(var(--color-surface))] flex items-center justify-center">
                  <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-body truncate">{doc.filename}</h3>
                  <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-1">
                    {doc.chunk_count} chunks{' · '}{new Date(doc.uploaded_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge>{getFileType(doc.filename)}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

