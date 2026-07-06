import {
  CSSProperties,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion } from 'motion/react';

type MotionCardProps = {
  children: ReactNode;
  index: number;
  className?: string;
  isVideoCard?: boolean;
};

type Point = {
  x: number;
  y: number;
};

const MAX_ROTATION = 7;
const DESKTOP_HOVER_QUERY = '(hover: hover) and (pointer: fine)';

export default function MotionCard({
  children,
  index,
  className = '',
  isVideoCard = false,
}: MotionCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [tilt, setTilt] = useState<Point>({ x: 0, y: 0 });
  const [glow, setGlow] = useState<Point>({ x: 50, y: 50 });
  const [hovered, setHovered] = useState(false);
  const [canHover, setCanHover] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DESKTOP_HOVER_QUERY);
    const updateHoverSupport = () => setCanHover(mediaQuery.matches);

    updateHoverSupport();
    mediaQuery.addEventListener('change', updateHoverSupport);

    return () => {
      mediaQuery.removeEventListener('change', updateHoverSupport);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!canHover) return;

    const { clientX, clientY } = event;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      setTilt({
        x: ((y - centerY) / centerY) * -MAX_ROTATION,
        y: ((x - centerX) / centerX) * MAX_ROTATION,
      });

      setGlow({
        x: (x / rect.width) * 100,
        y: (y / rect.height) * 100,
      });
    });
  }

  function handleMouseEnter() {
    if (canHover) {
      setHovered(true);
    }
  }

  function handleMouseLeave() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setTilt({ x: 0, y: 0 });
    setHovered(false);
  }

  const cardStyle: CSSProperties = {
    transform: canHover
      ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale(${hovered ? 1.02 : 1})`
      : undefined,
    transition: 'transform 0.2s ease-out, box-shadow 0.2s ease-out',
    boxShadow: hovered
      ? '0 10px 30px rgba(0,0,0,0.6), 0 0 48px rgba(30,58,138,0.24)'
      : '0 10px 30px rgba(0,0,0,0.6), 0 0 40px rgba(30,58,138,0.15)',
    transformStyle: 'preserve-3d',
    willChange: canHover ? 'transform' : undefined,
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut', delay: index * 0.15 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={cardStyle}
      className={`relative overflow-hidden ${className}`}
    >
      <style>
        {`
          @keyframes float {
            0% { transform: translateY(-50%) translateX(0px); }
            50% { transform: translateY(-48%) translateX(10px); }
            100% { transform: translateY(-50%) translateX(0px); }
          }

          @keyframes video-shimmer {
            0% { transform: translateX(-120%); }
            100% { transform: translateX(120%); }
          }
        `}
      </style>

      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${glow.x}% ${glow.y}%, rgba(255,255,255,0.14), transparent 42%)`,
          opacity: hovered ? 1 : 0,
        }}
      />

      <div
        className="pointer-events-none absolute right-[-18%] top-1/2 z-0 h-36 w-36 rounded-full bg-blue-900/20 blur-3xl sm:h-44 sm:w-44"
        style={{ animation: 'float 8s ease-in-out infinite' }}
      />

      {isVideoCard && (
        <>
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 bg-black/20"
            animate={{ opacity: [0.14, 0.22, 0.14] }}
            transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity }}
          />
          <motion.div
            className="pointer-events-none absolute inset-0 z-10 opacity-60"
            style={{
              background:
                'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.05), transparent 70%)',
              animation: 'video-shimmer 7s ease-in-out infinite',
            }}
          />
        </>
      )}

      <motion.div
        className="relative z-20 h-full"
        animate={isVideoCard ? { scale: [1, 1.05, 1] } : undefined}
        transition={
          isVideoCard
            ? { duration: 10, ease: 'easeInOut', repeat: Infinity }
            : undefined
        }
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
