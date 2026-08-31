import { Link } from 'react-router-dom';
import { Button } from '@/components/ui';
import { motion } from 'framer-motion';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[rgb(var(--color-bg))] relative overflow-hidden">
      {/* Background orbs */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle, rgb(var(--color-accent)) 0%, transparent 70%)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="text-center max-w-sm relative z-10"
      >
        {/* Large 404 number */}
        <p
          className="text-[120px] font-display font-semibold leading-none mb-4 select-none"
          style={{
            background: 'linear-gradient(135deg, rgb(var(--color-accent)) 0%, rgb(139,92,246) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          404
        </p>

        <h1 className="text-[24px] font-display font-semibold text-[rgb(var(--color-text))] mb-3">
          Page not found
        </h1>
        <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mb-8 leading-relaxed">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link to="/dashboard">
          <Button size="lg">Return to Dashboard</Button>
        </Link>
      </motion.div>
    </div>
  );
}