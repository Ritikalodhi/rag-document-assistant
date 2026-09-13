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
        <div className="empty-state-icon [&_svg]:w-[30px] [&_svg]:h-[30px]">
          {illustration}
        </div>
      )}
      <h2 className="text-[21px] font-ui font-semibold tracking-[-0.01em] text-[rgb(var(--color-text))] mb-2.5">{title}</h2>
      <p className="text-[14.5px] text-[rgb(var(--color-text-secondary))] mb-8 leading-relaxed">
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
        <p className="mt-8 text-[13px] text-[rgb(var(--color-text-tertiary))]">
          💡 {tip}
        </p>
      )}
    </div>
  );
}