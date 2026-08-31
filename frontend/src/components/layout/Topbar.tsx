import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Avatar, Dropdown, Tooltip } from '@/components/ui';

interface TopbarProps {
  onMenuToggle?: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="h-[60px] border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))]/90 backdrop-blur-xl flex items-center justify-between px-5 gap-4 flex-shrink-0 z-30">
      {/* Left: Mobile Menu Toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-[9px] hover:bg-[rgb(var(--color-surface))] transition-colors text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] flex-shrink-0 active:scale-95"
        aria-label="Toggle navigation menu"
      >
        <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Center Search Input */}
      <div className="flex-1 max-w-[520px]">
        <button
          onClick={() => navigate('/chat')}
          className="w-full flex items-center gap-3 px-4 py-2 rounded-full bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[14px] text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent))]/50 hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))] transition-all duration-200 text-left shadow-[var(--shadow-sm)] group"
          aria-label="Search or ask across your documents"
        >
          <svg className="w-[15px] h-[15px] text-[rgb(var(--color-text-tertiary))] group-hover:text-[rgb(var(--color-accent))] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="flex-1 truncate text-[13.5px]">Search or ask questions across your library...</span>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-[5px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-text-tertiary))] font-code shadow-sm">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Theme Toggle */}
        <Tooltip content={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-[9px] hover:bg-[rgb(var(--color-surface))] transition-all duration-150 text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] active:scale-95"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark ? (
              <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </Tooltip>

        {/* New Chat Button */}
        <button
          onClick={() => navigate('/chat?new=1')}
          className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[9px] text-white text-[13px] font-semibold shadow-[var(--shadow-sm)] transition-all duration-150 cursor-pointer active:scale-[0.97] hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, rgb(var(--color-accent)) 0%, rgb(99,102,241) 100%)' }}
          aria-label="New chat"
        >
          <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Chat</span>
        </button>

        <div className="h-5 w-px bg-[rgb(var(--color-border))] mx-1 hidden sm:block" aria-hidden="true" />

        {/* User Menu */}
        <Dropdown
          trigger={
            <button
              className="flex items-center gap-2 p-1 pr-2 rounded-[10px] hover:bg-[rgb(var(--color-surface))] transition-colors border border-transparent hover:border-[rgb(var(--color-border))]"
              aria-label={`User menu for ${user?.username ?? 'user'}`}
            >
              <Avatar initials={(user?.username?.slice(0, 2) ?? 'U').toUpperCase()} size="sm" />
              <span className="hidden md:inline-block text-[13px] font-semibold text-[rgb(var(--color-text))]">
                {user?.username}
              </span>
            </button>
          }
          align="right"
          items={[
            {
              label: user?.username ?? 'Account',
              onClick: () => navigate('/settings'),
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              ),
            },
            {
              label: 'Settings',
              onClick: () => navigate('/settings'),
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ),
            },
            {
              label: 'Sign out',
              onClick: () => { logout(); navigate('/login'); },
              icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              ),
              danger: true,
            },
          ]}
        />
      </div>
    </header>
  );
}