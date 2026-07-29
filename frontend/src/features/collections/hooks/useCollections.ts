import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionsService } from '@/services/collections.service';
import { useToast } from '@/contexts/ToastContext';

const COLLECTIONS_KEY = ['collections'] as const;

export function useCollections() {
  return useQuery({
    queryKey: COLLECTIONS_KEY,
    queryFn: () => collectionsService.list(),
    select: (data) => data.collections,
  });
}

export function useCollectionDetail(collectionId: string) {
  return useQuery({
    queryKey: ['collections', collectionId],
    queryFn: () => collectionsService.get(collectionId),
    enabled: !!collectionId,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: (name: string) => collectionsService.create(name),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
      addToast('success', `Collection "${data.name}" created`);
    },
    onError: () => {
      addToast('error', 'Failed to create collection');
    },
  });
}

export function useRenameCollection() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: ({ collectionId, name }: { collectionId: string; name: string }) =>
      collectionsService.rename(collectionId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
      addToast('success', 'Collection renamed');
    },
    onError: () => {
      addToast('error', 'Failed to rename collection');
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: (collectionId: string) => collectionsService.delete(collectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COLLECTIONS_KEY });
      addToast('success', 'Collection deleted');
    },
    onError: () => {
      addToast('error', 'Failed to delete collection');
    },
  });
}

