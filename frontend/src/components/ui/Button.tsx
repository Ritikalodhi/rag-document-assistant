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
    'bg-[rgb(var(--color-btn-primary))] text-[rgb(var(--color-btn-primary-text))]',
    'bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0)_42%)]',
    'hover:bg-[rgb(var(--color-btn-primary-hover))]',
    'shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]',
    'hover:shadow-[0_2px_10px_rgba(0,0,0,0.28),0_0_18px_-6px_var(--glow-color),inset_0_1px_0_rgba(255,255,255,0.08)]',
    'active:scale-[0.97] active:shadow-none',
    'transition-all duration-200',
  ].join(' '),
  secondary: [
    'border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]',
    'text-[rgb(var(--color-text))]',
    'hover:bg-[rgb(var(--color-elevated))] hover:border-[rgb(var(--color-accent-muted))]',
    'shadow-[var(--shadow-sm)]',
    'hover:shadow-[var(--shadow-md)]',
    'active:scale-[0.97]',
    'transition-all duration-200',
  ].join(' '),
  ghost: [
    'bg-transparent text-[rgb(var(--color-text-secondary))]',
    'hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))]',
    'active:scale-[0.97]',
    'transition-all duration-200',
  ].join(' '),
  danger: [
    'bg-[rgb(var(--color-danger))] text-white',
    'hover:opacity-90',
    'shadow-[0_1px_3px_rgba(0,0,0,0.2)]',
    'active:scale-[0.97] active:shadow-none',
    'transition-all duration-200',
  ].join(' '),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[13px] rounded-[10px] gap-1.5 h-[32px]',
  md: 'px-4 py-2 text-[14px] rounded-[11px] gap-2 h-[40px]',
  lg: 'px-5 py-2.5 text-[15px] rounded-[12px] gap-2 h-[44px]',
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
          disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none
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