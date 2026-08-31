import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/contexts/ToastContext';

const iconMap = {
  success: (
    <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
      <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    </div>
  ),
  error: (
    <div className="w-7 h-7 rounded-full bg-red-500/15 flex items-center justify-center flex-shrink-0">
      <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </div>
  ),
  warning: (
    <div className="w-7 h-7 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
      <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v3.75m9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    </div>
  ),
  info: (
    <div className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
      <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  ),
};

const toastVariants = {
  initial: { opacity: 0, y: 16, scale: 0.94 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] } },
  exit: { opacity: 0, y: -8, scale: 0.96, transition: { duration: 0.18 } },
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2.5 max-w-[340px]">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            variants={toastVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            layout
            className="flex items-start gap-3 p-3.5 pr-3 rounded-[12px] border shadow-[var(--shadow-md)] bg-[rgb(var(--color-elevated))] border-[rgb(var(--color-border))] backdrop-blur-sm"
            role="alert"
          >
            {iconMap[toast.type]}
            <p className="flex-1 text-[14px] font-medium text-[rgb(var(--color-text))] leading-snug pt-0.5">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-1 rounded-[6px] hover:bg-[rgb(var(--color-surface))] transition-colors text-[rgb(var(--color-text-tertiary))] hover:text-[rgb(var(--color-text-secondary))]"
              aria-label="Dismiss notification"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}