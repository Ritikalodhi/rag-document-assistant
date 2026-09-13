import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({ children, padding = 'md', hover = false, className = '', ...props }: CardProps) {
  return (
    <div
      className={`
        rounded-[18px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]
        shadow-[var(--shadow-sm),inset_0_1px_0_rgba(255,255,255,0.04)]
        ${paddingStyles[padding]}
        ${hover ? 'transition-all duration-200 hover:border-[rgb(var(--color-accent-muted))] hover:shadow-[var(--shadow-md),0_0_20px_-8px_var(--glow-color)] hover:-translate-y-0.5 cursor-pointer' : 'transition-shadow duration-200'}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}