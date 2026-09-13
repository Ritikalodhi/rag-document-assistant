import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { Dropdown, Tooltip } from '@/components/ui';

interface TopbarProps {
  onMenuToggle?: () => void;
}

export function Topbar({ onMenuToggle }: TopbarProps) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="h-[80px] border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-bg))]/95 backdrop-blur-xl flex items-center justify-between px-8 gap-4 flex-shrink-0 z-30">
      {/* Left: Mobile Menu Toggle */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2.5 rounded-[10px] hover:bg-[rgb(var(--color-surface))] transition-colors text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] flex-shrink-0 active:scale-95"
        aria-label="Toggle navigation menu"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Center Search Input */}
      <div className="flex-1 max-w-[560px]">
        <button
          onClick={() => navigate('/chat')}
          className="w-full flex items-center gap-3.5 px-4 py-2.5 rounded-[16px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] text-[14px] text-[rgb(var(--color-text-secondary))] hover:border-[rgb(var(--color-accent-muted))] hover:text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-elevated))] focus-visible:border-[rgb(var(--color-accent-muted))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-accent))]/15 transition-all duration-200 text-left shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] group min-h-[44px]"
          aria-label="Search or ask across your documents"
        >
          <svg className="w-[17px] h-[17px] text-[rgb(var(--color-text-secondary))] group-hover:text-[rgb(var(--color-accent))] transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="flex-1 truncate text-[13.5px]">Search or ask questions across your library...</span>
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-[6px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-text-secondary))] group-hover:border-[rgb(var(--color-accent-muted))] group-hover:text-[rgb(var(--color-text))] transition-colors duration-200 font-code">
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
            className="p-2.5 rounded-[12px] border border-transparent hover:border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface))] transition-all duration-150 text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] active:scale-95"
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </Tooltip>

        {/* Notification Bell */}
        <Tooltip content="Notifications">
          <button
            className="p-2.5 rounded-[12px] border border-transparent hover:border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-surface))] transition-all duration-150 text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))] active:scale-95"
            aria-label="Notifications"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
        </Tooltip>

        {/* New Chat Button */}
        <button
          onClick={() => navigate('/chat?new=1')}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-[12px] text-[rgb(var(--color-btn-primary-text))] text-[13.5px] font-semibold bg-[rgb(var(--color-btn-primary))] bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(255,255,255,0)_42%)] hover:bg-[rgb(var(--color-btn-primary-hover))] shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.08)] hover:shadow-[var(--shadow-md),0_0_18px_-6px_var(--glow-color)] transition-all duration-200 cursor-pointer active:scale-[0.98] min-h-[40px]"
          aria-label="New chat"
        >
          <svg className="w-4 h-4 text-[rgb(var(--color-accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>New Chat</span>
        </button>

        <div className="h-6 w-px bg-[rgb(var(--color-border))] mx-1 hidden sm:block" aria-hidden="true" />

        {/* User Menu */}
        <Dropdown
          trigger={
            <button
              className="flex items-center gap-2.5 p-1.5 pr-2.5 rounded-[12px] hover:bg-[rgb(var(--color-surface))] hover:shadow-[var(--shadow-sm)] transition-all duration-150 border border-transparent hover:border-[rgb(var(--color-border))]"
              aria-label={`User menu for ${user?.username ?? 'user'}`}
            >
              <div className="w-[32px] h-[32px] rounded-full bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))] flex items-center justify-center font-semibold text-[13px] border border-[rgb(var(--color-accent))]/30">
                {(user?.username?.slice(0, 1) ?? 'R').toUpperCase()}
              </div>
              <span className="hidden md:inline-block text-[14px] font-semibold text-[rgb(var(--color-text))]">
                {user?.username ?? 'Ritika'}
              </span>
              <svg className="hidden md:block w-4 h-4 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
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