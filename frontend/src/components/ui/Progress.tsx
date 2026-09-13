interface ProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'accent' | 'success' | 'warning' | 'error';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

const colorClasses = {
  accent: 'bg-[rgb(var(--color-accent))]',
  success: 'bg-[rgb(var(--color-success))]',
  warning: 'bg-yellow-500',
  error: 'bg-[rgb(var(--color-danger))]',
};

export function Progress({ value, max = 100, size = 'md', color = 'accent', showLabel = false, className = '' }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className={`flex-1 bg-[rgb(var(--color-border))] rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClasses[color]}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
        />
      </div>
      {showLabel && (
        <span className="text-caption text-[rgb(var(--color-text-secondary))] flex-shrink-0">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

