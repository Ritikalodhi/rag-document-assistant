import type { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  illustration?: ReactNode;
  title: string;
  description: string;
  primaryCta?: {
    label: string;
    onClick: () => void;
  };
  secondaryCta?: {
    label: string;
    onClick: () => void;
  };
  tip?: string;
}

export function EmptyState({ illustration, title, description, primaryCta, secondaryCta, tip }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center max-w-md mx-auto">
      {illustration && (
        <div className="mb-8 text-[rgb(var(--color-text-secondary))]">
          {illustration}
        </div>
      )}
      <h2 className="text-h2 font-display mb-3">{title}</h2>
      <p className="text-body text-[rgb(var(--color-text-secondary))] mb-8">
        {description}
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        {primaryCta && (
          <Button onClick={primaryCta.onClick}>{primaryCta.label}</Button>
        )}
        {secondaryCta && (
          <Button variant="secondary" onClick={secondaryCta.onClick}>
            {secondaryCta.label}
          </Button>
        )}
      </div>
      {tip && (
        <p className="mt-8 text-caption text-[rgb(var(--color-text-secondary))]">
          💡 {tip}
        </p>
      )}
    </div>
  );
}