import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-2 text-caption">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && (
                <svg className="w-3.5 h-3.5 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
              {item.icon && <span className="text-[rgb(var(--color-text-secondary))]">{item.icon}</span>}
              {isLast || !item.href ? (
                <span className={isLast ? 'text-[rgb(var(--color-text))] font-medium' : 'text-[rgb(var(--color-text-secondary))]'}>
                  {item.label}
                </span>
              ) : (
                <Link to={item.href} className="text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] transition-colors">
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

