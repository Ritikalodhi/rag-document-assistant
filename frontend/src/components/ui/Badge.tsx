import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-secondary))]',
  success: 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))]',
  warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
  error: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400',
  info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
};

export function Badge({ children, variant = 'default' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-caption font-medium
        ${variantStyles[variant]}
      `}
    >
      {children}
    </span>
  );
}