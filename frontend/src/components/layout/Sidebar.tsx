import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface NavItemDef {
  to: string;
  label: string;
  icon: () => React.ReactNode;
  countKey?: 'documents' | 'conversations' | 'collections';
}

const navItems: NavItemDef[] = [
  {
    to: '/dashboard',
    label: 'Home',
    icon: () => (
      <svg className="w-[21px] h-[21px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    to: '/documents',
    label: 'Documents',
    icon: () => (
      <svg className="w-[21px] h-[21px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    countKey: 'documents',
  },
  {
    to: '/chat',
    label: 'Conversations',
    icon: () => (
      <svg className="w-[21px] h-[21px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    countKey: 'conversations',
  },
  {
    to: '/collections',
    label: 'Collections',
    icon: () => (
      <svg className="w-[21px] h-[21px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    countKey: 'collections',
  },
  {
    to: '/study-notes',
    label: 'Study Notes',
    icon: () => (
      <svg className="w-[21px] h-[21px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
  },
  {
    to: '/compare',
    label: 'Compare',
    icon: () => (
      <svg className="w-[21px] h-[21px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    to: '/cross-analysis',
    label: 'Cross-Document',
    icon: () => (
      <svg className="w-[21px] h-[21px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ),
  },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: () => (
      <svg className="w-[21px] h-[21px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
      </svg>
    ),
  },
];

interface SidebarProps {
  docCount?: number;
  conversationCount?: number;
  collectionCount?: number;
}

export function Sidebar({ docCount, conversationCount, collectionCount }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const counts: Record<string, number | undefined> = {
    documents: docCount,
    conversations: conversationCount,
    collections: collectionCount,
  };

  /** Exact route matching — one item active at a time */
  const isNavActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    if (path === '/documents') {
      // Only /documents and /documents/:id — NOT /study-notes or /collections
      return location.pathname === '/documents' || location.pathname.startsWith('/documents/');
    }
    if (path === '/chat') {
      return location.pathname === '/chat' || location.pathname.startsWith('/chat/');
    }
    if (path === '/collections') {
      // Only /collections and /collections/:id — NOT /study-notes
      return location.pathname === '/collections' || location.pathname.startsWith('/collections/');
    }
    if (path === '/study-notes') {
      return location.pathname === '/study-notes' || location.pathname.startsWith('/study-notes/');
    }
    if (path === '/compare') {
      return location.pathname === '/compare' || location.pathname.startsWith('/compare/');
    }
    if (path === '/cross-analysis') {
      return location.pathname === '/cross-analysis' || location.pathname.startsWith('/cross-analysis/');
    }
    if (path === '/analytics') {
      return location.pathname === '/analytics' || location.pathname.startsWith('/analytics/');
    }
    return location.pathname === path;
  };

  const sidebarWidth = collapsed ? 'w-[72px]' : 'w-[260px]';

  return (
    <aside
      className={`
        h-full z-40 flex flex-col
        bg-[rgb(var(--color-sidebar))]
        border-r border-[rgb(var(--color-border))]
        transition-all duration-250 ease-in-out
        ${sidebarWidth}
      `}
      aria-label="Main navigation"
    >
      {/* ── Logo Header ── */}
      <div
        className={`flex items-center h-[72px] px-4 flex-shrink-0 border-b border-[rgb(var(--color-border))] ${
          collapsed ? 'justify-center' : 'gap-3'
        }`}
      >
        <button
          onClick={() => navigate('/dashboard')}
          className={`flex items-center hover:opacity-100 transition-all duration-200 group ${collapsed ? '' : 'gap-3'}`}
          aria-label="Go to dashboard"
        >
          {/* Rounded-square logo icon with subtle glow */}
          <div className="w-[44px] h-[44px] rounded-[13px] bg-[rgb(var(--color-accent-muted))] border border-[rgb(var(--color-accent))]/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_0_1px_var(--glow-color)] group-hover:shadow-[0_0_16px_var(--glow-color)] transition-shadow duration-200">
            <svg
              className="w-[26px] h-[26px] text-[rgb(var(--color-accent))]" 
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="2" x2="12" y2="22" />
              <line x1="17" y1="5" x2="7" y2="19" />
              <line x1="22" y1="12" x2="2" y2="12" />
              <line x1="17" y1="19" x2="7" y2="5" />
            </svg>
          </div>
          {!collapsed && (
            <span className="text-[20px] font-bold tracking-tight text-[rgb(var(--color-text))] font-ui leading-none">
              Aperture
            </span>
          )}
        </button>
      </div>

      {/* ── Navigation List ── */}
      <nav className="flex-1 overflow-y-auto scrollbar-none py-3 px-3" role="navigation">
        {!collapsed && (
          <p className="px-2.5 mb-2 mt-1 text-[10.5px] font-bold text-[rgb(var(--color-text-secondary))] uppercase tracking-[0.15em]">
            WORKSPACE
          </p>
        )}

        <ul className="flex flex-col gap-0.5" role="list">
          {navItems.map((item) => {
            const active = isNavActive(item.to);
            const count = item.countKey ? counts[item.countKey] : undefined;

            return (
              <li key={item.to + item.label}>
                {/* Use a plain link to avoid NavLink's own isActive conflicting */}
                <a
                  href={item.to}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(item.to);
                  }}
                  className={`
                    flex items-center rounded-[12px] transition-all duration-150 cursor-pointer
                    min-h-[46px] text-[15px] font-medium leading-none select-none
                    ${collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-2.5 py-2.5'}
                    ${
                      active
                        ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06),var(--shadow-sm)] ring-1 ring-inset ring-[rgb(var(--color-accent))]/25'
                        : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))]'
                    }
                  `}
                  aria-label={item.label}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? item.label : undefined}
                  role="link"
                >
                  <span className={`flex-shrink-0 transition-colors duration-150 ${active ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-secondary))]'}`}>
                    {item.icon()}
                  </span>
                  {!collapsed && (
                    <span className="flex-1 truncate">{item.label}</span>
                  )}
                  {!collapsed && count !== undefined && count > 0 && (
                    <span
                      className={`ml-auto text-[12.5px] font-semibold tabular-nums flex-shrink-0 ${
                        active ? 'text-[rgb(var(--color-accent))]/90' : 'text-[rgb(var(--color-text-secondary))]'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Settings & Collapse ── */}
      <div className="px-3 pb-2 flex-shrink-0 flex flex-col gap-0.5 border-t border-[rgb(var(--color-border))] pt-2">
        <a
          href="/settings"
          onClick={(e) => { e.preventDefault(); navigate('/settings'); }}
          className={`
            flex items-center rounded-[11px] transition-all duration-150 cursor-pointer
            min-h-[46px] text-[15px] font-medium leading-none
            ${collapsed ? 'justify-center px-2 py-3' : 'gap-3 px-2.5 py-2.5'}
            ${
              location.pathname === '/settings'
                ? 'bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-text))] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06),var(--shadow-sm)] ring-1 ring-inset ring-[rgb(var(--color-accent))]/25'
                : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))]'
            }
          `}
          aria-label="Settings"
          aria-current={location.pathname === '/settings' ? 'page' : undefined}
          title={collapsed ? 'Settings' : undefined}
          role="link"
        >
          <span className={`flex-shrink-0 ${location.pathname === '/settings' ? 'text-[rgb(var(--color-accent))]' : 'text-[rgb(var(--color-text-secondary))]'}`}>
            <svg className="w-[21px] h-[21px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          {!collapsed && <span>Settings</span>}
        </a>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center rounded-[11px] text-[14px] font-medium text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))] hover:text-[rgb(var(--color-text))] transition-all duration-150 min-h-[42px] gap-3 ${collapsed ? 'justify-center px-2 py-2.5' : 'px-2.5 py-2.5'}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : undefined}
        >
          <svg
            className={`w-[19px] h-[19px] flex-shrink-0 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      {/* ── User Profile Card ── */}
      <div className="p-3 flex-shrink-0">
        <button
          onClick={() => navigate('/settings')}
          className={`w-full flex items-center rounded-[13px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-accent-muted))] hover:bg-[rgb(var(--color-elevated))] hover:shadow-[var(--shadow-md),0_0_16px_-8px_var(--glow-color)] transition-all duration-150 group ${
            collapsed ? 'justify-center p-2.5' : 'gap-3 p-3'
          }`}
          aria-label="Account settings"
        >
          <div className="w-[38px] h-[38px] rounded-full bg-[rgb(var(--color-accent-muted))] text-[rgb(var(--color-accent))] flex items-center justify-center font-bold text-[14px] flex-shrink-0 border border-[rgb(var(--color-accent))]/30 shadow-[0_0_0_1px_rgba(184,239,200,0.08)]">
            {(user?.username?.slice(0, 1) ?? 'R').toUpperCase()}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13.5px] font-semibold text-[rgb(var(--color-text))] truncate leading-tight">
                  {user?.username ?? 'Ritika'}
                </p>
                <p className="text-[11.5px] text-[rgb(var(--color-text-secondary))] truncate leading-tight mt-0.5">
                  Account
                </p>
              </div>
              <svg
                className="w-[15px] h-[15px] text-[rgb(var(--color-text-secondary))] group-hover:text-[rgb(var(--color-text))] flex-shrink-0 transition-colors duration-150"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}