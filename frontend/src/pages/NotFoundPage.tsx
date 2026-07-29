import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <p className="text-display font-display font-semibold text-[rgb(var(--color-accent))] mb-4">404</p>
        <h1 className="text-h1 font-display mb-3">Page not found</h1>
        <p className="text-body text-[rgb(var(--color-text-secondary))] mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/dashboard">
          <Button>Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}