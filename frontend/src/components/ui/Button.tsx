import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    'bg-[rgb(var(--color-accent))] text-white',
    'hover:bg-[rgb(var(--color-accent-hover))]',
    'shadow-[0_1px_3px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.08)_inset]',
    'hover:shadow-[0_2px_8px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.08)_inset]',
    'active:scale-[0.97] active:shadow-none',
  ].join(' '),
  secondary: [
    'border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]',
    'text-[rgb(var(--color-text))]',
    'hover:bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-text-tertiary))]/50',
    'shadow-[var(--shadow-sm)]',
    'active:scale-[0.97]',
  ].join(' '),
  ghost: [
    'bg-transparent text-[rgb(var(--color-text-secondary))]',
    'hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))]',
    'active:scale-[0.97]',
  ].join(' '),
  danger: [
    'bg-[rgb(var(--color-danger))] text-white',
    'hover:opacity-90',
    'shadow-[0_1px_3px_rgba(0,0,0,0.2)]',
    'active:scale-[0.97] active:shadow-none',
  ].join(' '),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[13px] rounded-[8px] gap-1.5',
  md: 'px-4 py-2 text-[14px] rounded-[10px] gap-2',
  lg: 'px-5 py-2.5 text-[15px] rounded-[11px] gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`
          inline-flex items-center justify-center font-ui font-semibold
          transition-all duration-150 select-none
          focus-ring
          disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        ) : leftIcon ? (
          <span className="flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        ) : null}
        {children}
        {!isLoading && rightIcon ? (
          <span className="flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = 'Button';