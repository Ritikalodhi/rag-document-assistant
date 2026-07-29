import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatService } from '@/services/chat.service';
import { useToast } from '@/contexts/ToastContext';

const CONVERSATIONS_KEY = ['conversations'] as const;

export function useConversations() {
  return useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: () => chatService.listConversations(100),
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: (entryId: string) => chatService.deleteConversation(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      addToast('success', 'Conversation deleted');
    },
    onError: () => {
      addToast('error', 'Failed to delete conversation');
    },
  });
}

export function useClearConversations() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  return useMutation({
    mutationFn: () => chatService.clearConversations(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
      addToast('success', 'All conversations cleared');
    },
    onError: () => {
      addToast('error', 'Failed to clear conversations');
    },
  });
}