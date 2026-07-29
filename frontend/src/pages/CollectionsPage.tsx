import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollections, useCreateCollection, useRenameCollection, useDeleteCollection } from '@/features/collections/hooks/useCollections';
import { Button, Card, Input, Skeleton, EmptyState, ErrorState, Dialog } from '@/components/ui';

type ViewMode = 'grid' | 'list';

export function CollectionsPage() {
  const navigate = useNavigate();
  const { data: collections, isLoading, error, refetch } = useCollections();
  const createCollection = useCreateCollection();
  const renameCollection = useRenameCollection();
  const deleteCollection = useDeleteCollection();

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'doc_count'>('created_at');

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const [renameOpen, setRenameOpen] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!collections) return [];
    let result = [...collections];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.name.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'doc_count') return b.doc_ids.length - a.doc_ids.length;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return result;
  }, [collections, search, sortBy]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    createCollection.mutate(newName.trim(), {
      onSuccess: () => { setCreateOpen(false); setNewName(''); },
    });
  };

  const handleRename = () => {
    if (!renameOpen || !renameValue.trim()) return;
    renameCollection.mutate({ collectionId: renameOpen, name: renameValue.trim() }, {
      onSuccess: () => setRenameOpen(null),
    });
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteCollection.mutate(deleteConfirm, {
      onSuccess: () => setDeleteConfirm(null),
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" width={200} height={32} />
          <Skeleton variant="text" width={120} />
        </div>
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

  if (error) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-h1 font-display">Collections</h1>
        <Button onClick={() => { setNewName(''); setCreateOpen(true); }}>
          New collection
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 w-full sm:max-w-sm">
          <Input
            placeholder="Search collections..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 text-body bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))] rounded focus-ring"
            aria-label="Sort by"
          >
            <option value="created_at">Newest</option>
            <option value="name">Name</option>
            <option value="doc_count">Documents</option>
          </select>
          <div className="flex border border-[rgb(var(--color-border))] rounded overflow-hidden">
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

      {filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No matching collections' : 'No collections yet'}
          description={search ? `No collections matching "${search}"` : 'Create your first collection to organize your documents.'}
          primaryCta={search ? undefined : { label: 'Create collection', onClick: () => { setNewName(''); setCreateOpen(true); }}}
          tip={search ? undefined : 'Collections help you group related documents together.'}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((col) => (
            <Card
              key={col.collection_id}
              hover
              onClick={() => navigate(`/collections/${col.collection_id}`)}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-[rgb(var(--color-surface))] flex items-center justify-center">
                    <svg className="w-5 h-5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenameOpen(col.collection_id); setRenameValue(col.name); }}
                    className="p-1 rounded hover:bg-[rgb(var(--color-surface))] transition-colors"
                    aria-label={`Rename ${col.name}`}
                  >
                    <svg className="w-4 h-4 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
                <div>
                  <h3 className="font-medium text-body truncate">{col.name}</h3>
                  <p className="text-caption text-[rgb(var(--color-text-secondary))] mt-1">
                    {col.doc_ids.length} document{col.doc_ids.length !== 1 ? 's' : ''}
                    {' · '}{new Date(col.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(col.collection_id); }}
                    className="px-2 py-1 text-caption text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/collections/${col.collection_id}`); }}
                    className="px-2 py-1 text-caption text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent))]/5 rounded transition-colors"
                  >
                    Open
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="border border-[rgb(var(--color-border))] rounded overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
                <th className="text-left px-4 py-3 text-caption font-medium text-[rgb(var(--color-text-secondary))]">Name</th>
                <th className="text-left px-4 py-3 text-caption font-medium text-[rgb(var(--color-text-secondary))] hidden sm:table-cell">Documents</th>
                <th className="text-left px-4 py-3 text-caption font-medium text-[rgb(var(--color-text-secondary))] hidden md:table-cell">Created</th>
                <th className="px-4 py-3 w-32" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((col) => (
                <tr
                  key={col.collection_id}
                  className="border-b border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface))] cursor-pointer transition-colors"
                  onClick={() => navigate(`/collections/${col.collection_id}`)}
                >
                  <td className="px-4 py-3 text-body font-medium">{col.name}</td>
                  <td className="px-4 py-3 text-caption text-[rgb(var(--color-text-secondary))] hidden sm:table-cell">
                    {col.doc_ids.length}
                  </td>
                  <td className="px-4 py-3 text-caption text-[rgb(var(--color-text-secondary))] hidden md:table-cell">
                    {new Date(col.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setRenameOpen(col.collection_id); setRenameValue(col.name); }}
                        className="px-2 py-1 text-caption text-[rgb(var(--color-accent))] hover:bg-[rgb(var(--color-accent))]/5 rounded transition-colors"
                      >
                        Rename
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(col.collection_id); }}
                        className="px-2 py-1 text-caption text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Create collection">
        <div className="flex flex-col gap-4">
          <Input
            label="Collection name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Enter a name..."
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} isLoading={createCollection.isPending} disabled={!newName.trim()}>
              Create
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameOpen} onClose={() => setRenameOpen(null)} title="Rename collection">
        <div className="flex flex-col gap-4">
          <Input
            label="New name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Enter a new name..."
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRenameOpen(null)}>Cancel</Button>
            <Button onClick={handleRename} isLoading={renameCollection.isPending} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete collection">
        <p className="text-body text-[rgb(var(--color-text-secondary))] mb-6">
          Are you sure you want to delete this collection? Documents in the collection will not be deleted.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} isLoading={deleteCollection.isPending}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}

