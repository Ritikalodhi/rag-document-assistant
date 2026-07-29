import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDocuments, useDeleteDocument } from '@/features/documents/hooks/useDocuments';
import { Button, Badge, Input, Skeleton, ErrorState, Dialog, Highlight } from '@/components/ui';
import { getFileType } from '@/utils/fileType';
import type { Document } from '@/types';

type ViewMode = 'grid' | 'list';
type SortField = 'uploaded_at' | 'filename' | 'chunk_count';

function DocumentActions({ doc, onDelete }: { doc: Document; onDelete: (d: Document) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
        className="p-1 rounded-[4px] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
        aria-label={`Delete ${doc.filename}`}
      >
        <svg className="w-4 h-4 text-[rgb(var(--color-text-secondary))] hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const { data: documents, isLoading, error, refetch } = useDocuments();
  const deleteDoc = useDeleteDocument();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('uploaded_at');
  const [page, setPage] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<Document | null>(null);
  const perPage = 12;

  const filtered = useMemo(() => {
    if (!documents) return [];
    let result = [...documents];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.filename.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      if (sortField === 'uploaded_at') {
        return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime();
      }
      if (sortField === 'filename') {
        return a.filename.localeCompare(b.filename);
      }
      return b.chunk_count - a.chunk_count;
    });

    return result;
  }, [documents, search, sortField]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice(page * perPage, (page + 1) * perPage);

  const handleDelete = () => {
    if (deleteConfirm) {
      deleteDoc.mutate(deleteConfirm.doc_id);
      setDeleteConfirm(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="text" width={120} />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton variant="text" width={240} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-6 border border-[rgb(var(--color-border))] rounded-[10px] flex flex-col gap-4">
              <Skeleton variant="text" width="70%" />
              <Skeleton variant="text" width="40%" />
              <Skeleton variant="text" width="50%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16">
        <div className="w-12 h-12 rounded-xl bg-[rgb(var(--color-surface))] flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h2 className="text-h2 font-display font-semibold mb-2">Build your research library</h2>
        <p className="text-body text-[rgb(var(--color-text-secondary))] max-w-md mb-6">
          Upload PDFs, reports, notes, and documents to start asking questions across your sources.
        </p>
        <Button onClick={() => navigate('/upload')}>Upload document</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 font-display">Documents</h1>
          <p className="text-body text-[rgb(var(--color-text-secondary))] mt-1">Your research library</p>
        </div>
        <Button onClick={() => navigate('/upload')}>Upload document</Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex-1 w-full sm:max-w-sm">
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="px-3 py-2 text-body bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded-[8px] focus-ring text-caption"
            aria-label="Sort by"
          >
            <option value="uploaded_at">Newest first</option>
            <option value="filename">Name</option>
            <option value="chunk_count">Chunks</option>
          </select>
          <div className="flex border border-[rgb(var(--color-border))] rounded-[8px] overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-[rgb(var(--color-surface))]' : ''}`}
              aria-label="Grid view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-[rgb(var(--color-surface))]' : ''}`}
              aria-label="List view"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Count */}
      <p className="text-caption text-[rgb(var(--color-text-secondary))]">
        {filtered.length} document{filtered.length !== 1 ? 's' : ''}
        {search && ` matching "${search}"`}
      </p>

      {/* Grid view */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
          {paged.map((doc) => (
            <div
              key={doc.doc_id}
              onClick={() => navigate(`/documents/${doc.doc_id}`)}
              className="flex flex-col gap-3 p-4 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-text-secondary))] transition-all duration-150 cursor-pointer group"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/documents/${doc.doc_id}`); }}
              aria-label={`Open ${doc.filename}`}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-[8px] bg-[rgb(var(--color-surface))] flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <DocumentActions doc={doc} onDelete={setDeleteConfirm} />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-body truncate">
                  <Highlight text={doc.filename} query={search} />
                </h3>
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="default">{getFileType(doc.filename)}</Badge>
                  {doc.summary && <Badge variant="success">Summarized</Badge>}
                </div>
                <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-2">
                  {doc.chunk_count} chunks · {new Date(doc.uploaded_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List view */
        <div className="border border-[rgb(var(--color-border))] rounded-[10px] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
                <th className="text-left px-4 py-3 text-caption font-medium text-[rgb(var(--color-text-secondary))]">Document</th>
                <th className="text-left px-4 py-3 text-caption font-medium text-[rgb(var(--color-text-secondary))] hidden sm:table-cell">Type</th>
                <th className="text-left px-4 py-3 text-caption font-medium text-[rgb(var(--color-text-secondary))] hidden md:table-cell">Date</th>
                <th className="text-right px-4 py-3 text-caption font-medium text-[rgb(var(--color-text-secondary))]">Chunks</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {paged.map((doc) => (
                <tr
                  key={doc.doc_id}
                  className="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface))] cursor-pointer transition-colors group"
                  onClick={() => navigate(`/documents/${doc.doc_id}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-[6px] bg-[rgb(var(--color-surface))] flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-body font-medium">
                        <Highlight text={doc.filename} query={search} />
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge>{getFileType(doc.filename)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-caption text-[rgb(var(--color-text-secondary))] hidden md:table-cell">
                    {new Date(doc.uploaded_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-body text-right">{doc.chunk_count}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(doc); }}
                      className="p-1 rounded-[4px] hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label={`Delete ${doc.filename}`}
                    >
                      <svg className="w-4 h-4 text-[rgb(var(--color-text-secondary))] hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <Button key={i} variant={i === page ? 'primary' : 'ghost'} size="sm" onClick={() => setPage(i)}>{i + 1}</Button>
          ))}
          <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      )}

      {/* Delete dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete document">
        <p className="text-body text-[rgb(var(--color-text-secondary))] mb-6">
          Are you sure you want to delete <strong>{deleteConfirm?.filename}</strong>? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} isLoading={deleteDoc.isPending}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}