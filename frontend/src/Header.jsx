import { useLocation, useNavigate } from 'react-router-dom';

const titles = {
  '/chat': 'Chat',
  '/summarize': 'Summarize',
  '/study-notes': 'Study Notes',
  '/compare': 'Compare',
  '/cross-analysis': 'Cross Analysis',
  '/analytics': 'Analytics',
  '/history': 'History',
};

export default function Header() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 right-0 h-16 w-[calc(100%-280px)] bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 flex items-center justify-between px-8 z-40">
      <span className="text-[24px] font-semibold text-on-surface">
        {titles[pathname] || 'DocMind AI'}
      </span>
      <div className="flex items-center gap-4">
        <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer p-2">notifications</span>
        <span className="material-symbols-outlined text-on-surface-variant hover:text-primary cursor-pointer p-2">settings</span>
        <button
          onClick={() => navigate('/chat')}
          className="px-4 py-2 bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-lg text-[12px] uppercase hover:bg-surface-variant transition-all"
        >
          New Session
        </button>
      </div>
    </header>
  );
}