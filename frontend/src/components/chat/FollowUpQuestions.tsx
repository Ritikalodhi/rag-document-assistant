import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
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
    <motion.div
      className="mt-2 rounded-[18px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]/60 p-3.5 sm:p-4 shadow-[var(--shadow-sm)]"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
    >
      <p className="text-caption font-semibold text-[rgb(var(--color-text-secondary))] uppercase tracking-[0.12em] mb-3 text-[11px]">
        Suggested follow-ups
      </p>
      <div className="flex flex-col gap-2">
        {data.questions.slice(0, 3).map((question, i) => (
          <motion.button
            key={i}
            onClick={() => onSelect(question)}
            className="flex items-center gap-3 px-3.5 py-3 rounded-[12px] text-body text-left border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]/55 hover:bg-[rgb(var(--color-elevated))] hover:border-[rgb(var(--color-accent))]/55 hover:shadow-[var(--shadow-sm)] transition-all group"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.22, delay: i * 0.06, ease: 'easeOut' }}
            whileHover={{ x: 3 }}
            whileTap={{ scale: 0.99 }}
          >
            <span className="flex-1 text-[rgb(var(--color-text-secondary))] group-hover:text-[rgb(var(--color-text))] transition-colors">
              {question}
            </span>
            <svg className="w-4 h-4 text-[rgb(var(--color-text-secondary))] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}