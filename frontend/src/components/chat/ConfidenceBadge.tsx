import { Tooltip } from '@/components/ui';

interface ConfidenceBadgeProps {
  grade?: string;
  compositeScore?: number;
  grounded?: boolean;
}

export function ConfidenceBadge({ grade, compositeScore, grounded }: ConfidenceBadgeProps) {
  if (!grade && grounded === undefined) return null;

  const level = grade?.toLowerCase() ?? (grounded === true ? 'high' : 'low');

  const config = {
    high: {
      label: 'High confidence',
      icon: '✦',
      classes: 'text-emerald-600 dark:text-emerald-400',
    },
    medium: {
      label: 'Medium confidence',
      icon: '✦',
      classes: 'text-amber-600 dark:text-amber-400',
    },
    low: {
      label: 'Low confidence',
      icon: '✦',
      classes: 'text-red-600 dark:text-red-400',
    },
  };

  const { label, icon, classes } = config[level as keyof typeof config] ?? config.low;

  const badge = (
    <span className={`inline-flex items-center gap-1 text-caption font-medium ${classes}`}>
      <span>{icon}</span>
      <span>{label}</span>
      {compositeScore !== undefined && (
        <span className="opacity-60">
          {Math.round(compositeScore * 100)}%
        </span>
      )}
    </span>
  );

  if (compositeScore !== undefined) {
    return (
      <Tooltip content={`${Math.round(compositeScore * 100)}% composite score`}>
        {badge}
      </Tooltip>
    );
  }

  return badge;
}