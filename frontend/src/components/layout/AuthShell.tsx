import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface AuthShellProps {
  children: ReactNode;
}

/**
 * Split-screen shell — premium redesign.
 * Left: Brand logo, hero text, decorative muted glow
 * Right: Elevated form card
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <motion.div
      className="auth-shell min-h-screen flex bg-[#080B0A] text-[#F2F4F3] selection:bg-[#324A3B] selection:text-[#B8EFC8] font-ui overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* ── Left marketing panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 xl:p-16 border-r border-[#25332B] relative overflow-hidden bg-[radial-gradient(circle_at_12%_10%,rgba(89,178,121,0.16),transparent_34%),linear-gradient(145deg,#0C1310,#080B0A_68%)]">
        {/* Decorative gradient orbs */}
        {/* Dot grid pattern */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
             style={{
               backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
               backgroundSize: '28px 28px',
             }} />

        {/* Brand logo & wordmark */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-[13px] flex items-center justify-center flex-shrink-0 bg-[#183324] border border-[#6ED596]/30 shadow-[0_0_24px_-8px_rgba(110,213,150,0.8)]">
            <svg
              className="w-[18px] h-[18px] text-[#B8EFC8]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>
          <span className="text-[19px] font-semibold tracking-tight text-[#F2F4F3]">
            Aperture
          </span>
        </div>

        {/* Hero marketing text */}
        <div className="flex-1 flex flex-col justify-center max-w-[460px] relative z-10">
          <h2 className="text-[34px] xl:text-[40px] font-semibold leading-[1.12] text-[#F2F4F3] tracking-[-0.025em]">
            A calm workspace for reading, questioning, and connecting ideas.
          </h2>
          <p className="mt-5 text-[15px] xl:text-[16px] leading-[1.7] text-[#8E9398]">
            Upload documents, ask questions with cited answers, and build a knowledge base that grows with your research.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-8">
            {['Semantic Search', 'AI Summaries', 'Table Extraction', 'Cross-Document Analysis'].map((feat) => (
              <span key={feat}
                    className="px-3 py-1.5 rounded-full border border-[#2C4436] bg-[#112219]/75 text-[12px] font-medium text-[#AABBB0] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                {feat}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[13px] text-[#62666A] relative z-10">
          © {new Date().getFullYear()} Aperture Research
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[radial-gradient(ellipse_at_50%_35%,rgba(54,111,75,0.16),transparent_58%),#080B0A] relative">
        {/* Subtle radial gradient behind form */}
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(50,74,59,0.12) 0%, transparent 65%)' }} />

        {/* Mobile brand header */}
        <div className="lg:hidden flex items-center gap-3 mb-10 relative z-10">
          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center bg-[#324A3B] border border-[#324A3B] shadow-md">
            <svg
              className="w-[18px] h-[18px] text-[#B8EFC8]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
            </svg>
          </div>
          <span className="text-[19px] font-semibold tracking-tight text-[#F2F4F3]">
            Aperture
          </span>
        </div>

        {/* Form container — card */}
        <motion.div
          className="w-full max-w-[420px] relative z-10"
          initial={{ opacity: 0, y: 16, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.08, ease: 'easeOut' }}
        >
          <div className="p-8 sm:p-9 rounded-[24px] border border-[#2B4435] bg-[#151D19]/80 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl">
            {children}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
