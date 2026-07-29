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
    <header className="h-16 border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] flex items-center justify-between px-4 sm:px-6 gap-4">
      {/* Left: mobile menu toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-[8px] hover:bg-[rgb(var(--color-surface))] transition-colors text-[rgb(var(--color-text-secondary))] flex-shrink-0"
        aria-label="Toggle navigation menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Search bar */}
      <div className="flex-1 flex justify-center lg:justify-start max-w-[520px]">
        <button
          onClick={() => navigate('/chat')}
          className="w-full flex items-center gap-2.5 px-4 py-[9px] rounded-[10px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-body text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-text-secondary))] transition-colors text-left"
          aria-label="Search or ask across your documents"
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="flex-1 truncate">Search or ask across your documents...</span>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-text-secondary))] font-code">
            ⌘K
          </kbd>
          <span className="hidden sm:inline text-caption text-[rgb(var(--color-text-secondary))] ml-1 opacity-40">·</span>
          <span className="hidden xl:inline text-caption text-[rgb(var(--color-text-secondary))] ml-1 opacity-60">Chat</span>
        </button>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme toggle */}
        <Tooltip content={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-[8px] hover:bg-[rgb(var(--color-surface))] transition-colors text-[rgb(var(--color-text-secondary))]"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark ? (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </Tooltip>

        {/* New chat */}
        <button
          onClick={() => navigate('/chat')}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-[9px] rounded-[10px] bg-[rgb(var(--color-accent))] text-white hover:bg-[rgb(var(--color-accent-hover))] transition-colors text-body font-medium"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>New chat</span>
        </button>

        {/* User menu */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-[rgb(var(--color-border))]">
          <Dropdown
            trigger={
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity" aria-label="User menu">
                <Avatar initials={user?.username?.slice(0, 2) ?? 'U'} size="sm" />
              </button>
            }
            align="right"
            items={[
              {
                label: 'Settings',
                onClick: () => navigate('/settings'),
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
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
      </div>
    </header>
  );
}