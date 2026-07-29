import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';
import { useToast } from '@/contexts/ToastContext';

const DOCUMENTS_KEY = ['documents'] as const;

export function useDocuments() {
  return useQuery({
    queryKey: DOCUMENTS_KEY,
    queryFn: () => documentsService.list(),
    select: (data) => data.documents,
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: (docId: string) => documentsService.delete(docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY });
      addToast('success', 'Document deleted successfully');
    },
    onError: () => {
      addToast('error', 'Failed to delete document');
    },
  });
}

export function useDocumentMetadata(docId: string) {
  return useQuery({
    queryKey: ['document', docId, 'metadata'],
    queryFn: () => documentsService.getMetadata(docId),
    enabled: !!docId,
  });
}