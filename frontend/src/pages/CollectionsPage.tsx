import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCollections, useCreateCollection, useRenameCollection, useDeleteCollection } from '@/features/collections/hooks/useCollections';
import { Button, Input, Skeleton, EmptyState, ErrorState, Dialog } from '@/components/ui';

type ViewMode = 'grid' | 'list';

const motionProps = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
});

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
            <div key={i} className="p-5 border border-[rgb(var(--color-border))] rounded-[10px] bg-[rgb(var(--color-elevated))] flex flex-col gap-4">
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
    <div className="flex flex-col gap-7">
      {/* Header */}
      <motion.div {...motionProps(0)}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[26px] sm:text-[28px] font-display font-semibold tracking-tight text-[rgb(var(--color-text))]">Collections</h1>
            <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mt-1">Organize your document library into focused research groups.</p>
          </div>
          <Button onClick={() => { setNewName(''); setCreateOpen(true); }}>
            New collection
          </Button>
        </div>
      </motion.div>

      {/* Toolbar */}
      <motion.div {...motionProps(0.03)}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
              className="px-3 py-2 text-[13px] bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-text))] border border-[rgb(var(--color-border))] rounded-[8px] focus:outline-none focus:border-[rgb(var(--color-accent))]"
              aria-label="Sort by"
            >
              <option value="created_at">Newest</option>
              <option value="name">Name</option>
              <option value="doc_count">Documents</option>
            </select>
            <div className="flex border border-[rgb(var(--color-border))] rounded-[8px] overflow-hidden bg-[rgb(var(--color-elevated))] p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-[6px] transition-colors ${viewMode === 'grid' ? 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))]' : 'text-[rgb(var(--color-text-tertiary))]'}`}
                aria-label="Grid view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-[6px] transition-colors ${viewMode === 'list' ? 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))]' : 'text-[rgb(var(--color-text-tertiary))]'}`}
                aria-label="List view"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Content */}
      {filtered.length === 0 ? (
        <motion.div {...motionProps(0.06)}>
          <EmptyState
            title={search ? 'No matching collections' : 'No collections yet'}
            description={search ? `No collections matching "${search}"` : 'Create your first collection to organize your documents.'}
            primaryCta={search ? undefined : { label: 'Create collection', onClick: () => { setNewName(''); setCreateOpen(true); } }}
            tip={search ? undefined : 'Collections help you group related documents together.'}
          />
        </motion.div>
      ) : viewMode === 'grid' ? (
        <motion.div {...motionProps(0.06)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((col) => (
            <div
              key={col.collection_id}
              onClick={() => navigate(`/collections/${col.collection_id}`)}
              className="flex flex-col justify-between p-4.5 rounded-[10px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-text-tertiary))]/50 transition-all duration-150 cursor-pointer group"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/collections/${col.collection_id}`); }}
              aria-label={`Open ${col.name}`}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-[8px] bg-[rgb(var(--color-surface))] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4.5 h-4.5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenameOpen(col.collection_id); setRenameValue(col.name); }}
                    className="p-1.5 rounded-[6px] hover:bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-secondary))] transition-colors"
                    aria-label={`Rename ${col.name}`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
                <div>
                  <h3 className="font-semibold text-[15px] text-[rgb(var(--color-text))] truncate">{col.name}</h3>
                  <p className="text-[12px] font-code text-[rgb(var(--color-text-tertiary))] mt-1">
                    {col.doc_ids.length} document{col.doc_ids.length !== 1 ? 's' : ''}
                    {' · '}{new Date(col.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-[rgb(var(--color-border-subtle))] text-[12px]">
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteConfirm(col.collection_id); }}
                  className="font-medium text-[rgb(var(--color-danger))] hover:underline"
                >
                  Delete
                </button>
                <span className="font-medium text-[rgb(var(--color-accent))] group-hover:underline">
                  Open →
                </span>
              </div>
            </div>
          ))}
        </motion.div>
      ) : (
        <motion.div {...motionProps(0.06)}>
          <div className="border border-[rgb(var(--color-border))] rounded-[10px] bg-[rgb(var(--color-elevated))] overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]/60 text-[11px] font-semibold text-[rgb(var(--color-text-tertiary))] uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Name</th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">Documents</th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">Created</th>
                  <th className="px-4 py-3 text-right w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--color-border-subtle))] text-[14px]">
                {filtered.map((col) => (
                  <tr
                    key={col.collection_id}
                    className="hover:bg-[rgb(var(--color-surface))] cursor-pointer transition-colors"
                    onClick={() => navigate(`/collections/${col.collection_id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-[rgb(var(--color-text))]">{col.name}</td>
                    <td className="px-4 py-3 text-[13px] font-code text-[rgb(var(--color-text-secondary))] hidden sm:table-cell">
                      {col.doc_ids.length}
                    </td>
                    <td className="px-4 py-3 text-[12px] font-code text-[rgb(var(--color-text-secondary))] hidden md:table-cell">
                      {new Date(col.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setRenameOpen(col.collection_id); setRenameValue(col.name); }}
                          className="text-[12px] font-medium text-[rgb(var(--color-accent))] hover:underline"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(col.collection_id)}
                          className="text-[12px] font-medium text-[rgb(var(--color-danger))] hover:underline"
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
        </motion.div>
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
          <div className="flex justify-end gap-2.5">
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
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setRenameOpen(null)}>Cancel</Button>
            <Button onClick={handleRename} isLoading={renameCollection.isPending} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete collection">
        <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mb-6">
          Are you sure you want to delete this collection? Documents in the collection will not be deleted.
        </p>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} isLoading={deleteCollection.isPending}>Delete</Button>
        </div>
      </Dialog>
    </div>
  );
}