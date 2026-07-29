import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  status?: number;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred. Please try again.',
  onRetry,
  status,
}: ErrorStateProps) {
  const statusMessages: Record<number, string> = {
    401: 'Your session has expired. Please log in again.',
    403: 'You don\'t have permission to access this resource.',
    404: 'The requested resource could not be found.',
    500: 'The server encountered an internal error. Please try again later.',
  };

  const displayMessage = status ? statusMessages[status] ?? message : message;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center max-w-md mx-auto">
      <div className="w-16 h-16 mb-6 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h2 className="text-h2 font-display mb-3">{title}</h2>
      <p className="text-body text-[rgb(var(--color-text-secondary))] mb-8">
        {displayMessage}
      </p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}