import { useQuery } from '@tanstack/react-query';
import { documentsService } from '@/services/documents.service';

interface FollowUpQuestionsProps {
  docId?: string;
  onSelect: (question: string) => void;
}

export function FollowUpQuestions({ docId, onSelect }: FollowUpQuestionsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['suggested-questions', docId],
    queryFn: () => documentsService.getSuggestedQuestions(docId!),
    enabled: !!docId,
    staleTime: 60_000,
  });

  if (!docId) return null;
  if (isLoading) return null;
  if (!data?.questions || data.questions.length === 0) return null;

  return (
    <div className="border-t border-[rgb(var(--color-border))] pt-5">
      <p className="text-caption font-medium text-[rgb(var(--color-text-secondary))] uppercase tracking-wider mb-3 text-[11px]">
        Suggested follow-ups
      </p>
      <div className="flex flex-col gap-2">
        {data.questions.slice(0, 3).map((question, i) => (
          <button
            key={i}
            onClick={() => onSelect(question)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-[8px] text-body text-left border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] hover:bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-text-secondary))] transition-all group"
          >
            <span className="flex-1 text-[rgb(var(--color-text-secondary))] group-hover:text-[rgb(var(--color-text))] transition-colors">
              {question}
            </span>
            <svg className="w-4 h-4 text-[rgb(var(--color-text-secondary))] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}