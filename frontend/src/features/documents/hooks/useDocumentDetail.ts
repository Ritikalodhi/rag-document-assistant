import { useQuery, useMutation } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';

export function useDocumentSummary(docId: string) {
  return useMutation({
    mutationFn: () => documentsService.summarize(docId),
  });
}

export function useSuggestedQuestions(docId: string) {
  return useQuery({
    queryKey: ['document', docId, 'suggested-questions'],
    queryFn: () => documentsService.getSuggestedQuestions(docId),
    enabled: !!docId,
  });
}

export function useStudyNotes(docId: string) {
  return useQuery({
    queryKey: ['document', docId, 'study-notes'],
    queryFn: () => documentsService.getStudyNotes(docId),
    enabled: !!docId,
  });
}

export function useDocumentVersions(docId: string) {
  return useQuery({
    queryKey: ['document', docId, 'versions'],
    queryFn: () => documentsService.getVersions(docId),
    enabled: !!docId,
  });
}

export function useDocumentTables(docId: string) {
  return useQuery({
    queryKey: ['document', docId, 'tables'],
    queryFn: () => documentsService.getTables(docId),
    enabled: !!docId,
  });
}
