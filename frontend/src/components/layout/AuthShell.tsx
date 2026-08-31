import type { ReactNode } from 'react';

interface AuthShellProps {
  children: ReactNode;
}

/**
 * Split-screen shell — premium redesign.
 * Left: Brand logo, hero text, decorative gradient orbs
 * Right: Glassmorphic form card
 */
export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="min-h-screen flex bg-[#06070e] text-white selection:bg-[rgb(99,138,255)]/40 selection:text-white font-ui overflow-hidden">
      {/* ── Left marketing panel (desktop only) ── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 xl:p-16 border-r border-white/[0.06] relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.12] pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgb(99,138,255) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-5%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-[0.08] pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgb(139,92,246) 0%, transparent 70%)' }} />
        <div className="absolute top-[40%] left-[60%] w-[200px] h-[200px] rounded-full opacity-[0.06] pointer-events-none"
             style={{ background: 'radial-gradient(circle, rgb(99,238,255) 0%, transparent 70%)' }} />

        {/* Dot grid pattern */}
        <div className="absolute inset-0 opacity-[0.025] pointer-events-none"
             style={{
               backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
               backgroundSize: '28px 28px',
             }} />

        {/* Brand logo & wordmark */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0 shadow-lg"
               style={{ background: 'linear-gradient(135deg, rgb(99,138,255) 0%, rgb(139,92,246) 100%)' }}>
            <svg
              className="w-[18px] h-[18px] text-white"
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
          <span className="text-[19px] font-display font-semibold tracking-tight text-white">
            Aperture
          </span>
        </div>

        {/* Hero marketing text */}
        <div className="flex-1 flex flex-col justify-center max-w-[460px] relative z-10">
          <h2 className="font-display text-[36px] xl:text-[42px] font-semibold leading-[1.18] text-white tracking-[-0.025em]">
            A calm workspace for reading, questioning, and connecting ideas.
          </h2>
          <p className="mt-5 text-[15px] xl:text-[16px] leading-[1.7] text-white/50">
            Upload documents, ask questions with cited answers, and build a knowledge base that grows with your research.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 mt-8">
            {['Semantic Search', 'AI Summaries', 'Table Extraction', 'Cross-Document Analysis'].map((feat) => (
              <span key={feat}
                    className="px-3 py-1 rounded-full border border-white/[0.1] bg-white/[0.04] text-[12px] font-medium text-white/60">
                {feat}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[13px] text-white/30 relative z-10">
          © {new Date().getFullYear()} Aperture Research
        </p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#06070e] relative">
        {/* Subtle radial gradient behind form */}
        <div className="absolute inset-0 pointer-events-none"
             style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(99,138,255,0.04) 0%, transparent 65%)' }} />

        {/* Mobile brand header */}
        <div className="lg:hidden flex items-center gap-3 mb-10 relative z-10">
          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center shadow-lg"
               style={{ background: 'linear-gradient(135deg, rgb(99,138,255) 0%, rgb(139,92,246) 100%)' }}>
            <svg
              className="w-[18px] h-[18px] text-white"
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
          <span className="text-[19px] font-display font-semibold tracking-tight text-white">
            Aperture
          </span>
        </div>

        {/* Form container — glassmorphic card */}
        <div className="w-full max-w-[400px] relative z-10">
          <div className="p-8 rounded-[20px] border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm shadow-[0_8px_48px_rgba(0,0,0,0.4)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
