import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  {
    section: 'WORKSPACE',
    items: [
      {
        to: '/dashboard',
        label: 'Home',
        icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      },
      {
        to: '/documents',
        label: 'Documents',
        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        countKey: 'documents' as const,
      },
      {
        to: '/chat',
        label: 'Conversations',
        icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
      },
      {
        to: '/collections',
        label: 'Collections',
        icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
      },
      {
        to: '/compare',
        label: 'Compare',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      },
      {
        to: '/cross-analysis',
        label: 'Cross-Document',
        icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
      },
      {
        to: '/analytics',
        label: 'Analytics',
        icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
      },
    ],
  },
];

interface SidebarProps {
  docCount?: number;
}

export function Sidebar({ docCount }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();

  return (
    <aside
      className={`
        h-full z-40 flex flex-col
        bg-[rgb(var(--color-sidebar))]
        border-r border-[rgb(var(--color-border))]
        transition-all duration-250 ease-in-out
        ${collapsed ? 'w-[64px]' : 'w-[256px]'}
      `}
      aria-label="Main navigation"
    >
      {/* ── Logo & Wordmark ── */}
      <div
        className={`flex items-center h-[60px] border-b border-[rgb(var(--color-border))] flex-shrink-0 ${
          collapsed ? 'px-4 justify-center' : 'px-5 gap-3'
        }`}
      >
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-3 hover:opacity-90 transition-opacity min-w-0"
          aria-label="Go to dashboard"
        >
          <div className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0 shadow-sm"
               style={{ background: 'linear-gradient(135deg, rgb(99,138,255) 0%, rgb(139,92,246) 100%)' }}>
            <svg
              className="w-[17px] h-[17px] text-white"
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
          {!collapsed && (
            <span className="text-[16px] font-display font-semibold tracking-tight text-[rgb(var(--color-text))] truncate">
              Aperture
            </span>
          )}
        </button>
      </div>

      {/* ── Navigation List ── */}
      <nav className="flex-1 overflow-y-auto scrollbar-none py-3 px-2.5" role="navigation">
        {navItems.map((section) => (
          <div key={section.section} className="mb-1">
            {!collapsed && (
              <p className="px-2.5 mb-2 mt-1 text-[10px] font-bold text-[rgb(var(--color-text-tertiary))] uppercase tracking-[0.1em]">
                {section.section}
              </p>
            )}

            <ul className="flex flex-col gap-0.5" role="list">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-2.5 py-2.5 rounded-[10px] transition-all duration-150 text-[13.5px] font-medium leading-none
                      ${collapsed ? 'justify-center' : ''}
                      ${
                        isActive
                          ? 'bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] font-semibold'
                          : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))]/70 hover:text-[rgb(var(--color-text))]'
                      }`
                    }
                    aria-label={item.label}
                    title={collapsed ? item.label : undefined}
                  >
                    {({ isActive }) => (
                      <>
                        <svg
                          className={`flex-shrink-0 transition-colors ${collapsed ? 'w-5 h-5' : 'w-[17px] h-[17px]'}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2 : 1.65} d={item.icon} />
                        </svg>
                        {!collapsed && (
                          <span className="flex-1 truncate">{item.label}</span>
                        )}
                        {!collapsed && item.countKey === 'documents' && docCount !== undefined && docCount > 0 && (
                          <span className="px-1.5 py-0.5 text-[11px] font-semibold bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] rounded-full tabular-nums">
                            {docCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Settings (bottom anchor) ── */}
      <div className="px-2.5 pb-1 flex-shrink-0">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-2.5 py-2.5 rounded-[10px] transition-all duration-150 text-[13.5px] font-medium leading-none
            ${collapsed ? 'justify-center' : ''}
            ${
              isActive
                ? 'bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))] font-semibold'
                : 'text-[rgb(var(--color-text-secondary))] hover:bg-[rgb(var(--color-surface))]/70 hover:text-[rgb(var(--color-text))]'
            }`
          }
          aria-label="Settings"
          title={collapsed ? 'Settings' : undefined}
        >
          <svg className="w-[17px] h-[17px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.65} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.65} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {!collapsed && <span>Settings</span>}
        </NavLink>
      </div>

      {/* ── Collapse Toggle ── */}
      <div className="p-2.5 border-t border-[rgb(var(--color-border))] flex-shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-[9px] text-[12px] font-medium text-[rgb(var(--color-text-tertiary))] hover:bg-[rgb(var(--color-surface))]/70 hover:text-[rgb(var(--color-text-secondary))] transition-all duration-150 ${collapsed ? 'justify-center' : ''}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : undefined}
        >
          <svg
            className={`w-[15px] h-[15px] flex-shrink-0 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.65} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}