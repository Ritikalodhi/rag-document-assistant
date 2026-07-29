import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = '', id, ...props }, ref) => {
    const textareaId = id ?? `textarea-${Math.random().toString(36).slice(2, 9)}`;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-caption font-medium text-[rgb(var(--color-text-secondary))]">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`
            w-full px-3 py-2 text-body resize-y min-h-[80px]
            bg-[rgb(var(--color-bg))] border border-[rgb(var(--color-border))]
            rounded transition-colors duration-150
            placeholder:text-[rgb(var(--color-text-secondary))] placeholder:text-caption
            focus-ring
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : ''}
            ${className}
          `}
          aria-invalid={!!error}
          {...props}
        />
        {error && (
          <p className="text-caption text-red-500" role="alert">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';