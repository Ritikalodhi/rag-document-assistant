import { Tooltip } from '@/components/ui';

interface ConfidenceBadgeProps {
  grade?: string;
  compositeScore?: number;
  grounded?: boolean;
}

export function ConfidenceBadge({ grade, compositeScore, grounded }: ConfidenceBadgeProps) {
  // Display badge if we have grade, grounded status, OR composite score
  if (!grade && grounded === undefined && compositeScore === undefined) return null;

  const normalizedGrade = grade?.toUpperCase();
  const level = (() => {
    // If we have a composite score, use it to determine level
    if (compositeScore !== undefined) {
      if (compositeScore >= 70) return 'high';
      if (compositeScore >= 50) return 'medium';
      return 'low';
    }
    // Fall back to grade-based logic
    if (normalizedGrade === 'A') return 'high';
    if (normalizedGrade === 'B' || normalizedGrade === 'C') return 'medium';
    if (normalizedGrade === 'D' || normalizedGrade === 'F') return 'low';
    const lower = grade?.toLowerCase();
    if (lower === 'high' || lower === 'medium' || lower === 'low') return lower;
    return grounded === true ? 'high' : 'low';
  })();

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
          {Math.round(compositeScore)}%
        </span>
      )}
    </span>
  );

  if (compositeScore !== undefined) {
    return (
      <Tooltip content={`${Math.round(compositeScore)}% composite score`}>
        {badge}
      </Tooltip>
    );
  }

  return badge;
}