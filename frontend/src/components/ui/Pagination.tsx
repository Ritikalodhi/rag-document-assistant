import { Button } from './Button';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ currentPage, totalPages, onPageChange, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | 'ellipsis')[] = [];
  for (let i = 0; i < totalPages; i++) {
    if (i === 0 || i === totalPages - 1 || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'ellipsis') {
      pages.push('ellipsis');
    }
  }

  return (
    <nav aria-label="Pagination" className={`flex items-center justify-center gap-2 ${className}`}>
      <Button variant="ghost" size="sm" disabled={currentPage === 0} onClick={() => onPageChange(currentPage - 1)}>
        Previous
      </Button>
      {pages.map((page, i) =>
        page === 'ellipsis' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-caption text-[rgb(var(--color-text-secondary))]">
            ...
          </span>
        ) : (
          <Button key={page} variant={page === currentPage ? 'primary' : 'ghost'} size="sm" onClick={() => onPageChange(page)}>
            {page + 1}
          </Button>
        )
      )}
      <Button variant="ghost" size="sm" disabled={currentPage >= totalPages - 1} onClick={() => onPageChange(currentPage + 1)}>
        Next
      </Button>
    </nav>
  );
}

