import { useState, useCallback } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

export function AppLayout() {
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleMobileDrawer = useCallback(() => {
    setMobileDrawerOpen((prev) => !prev);
  }, []);

  useKeyboardShortcuts([
    { key: 'm', ctrl: true, handler: toggleMobileDrawer },
  ]);

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed top-0 left-0 h-full z-40 w-[256px] lg:hidden transition-transform duration-250 ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar />
      </div>
      <div className="flex-1 lg:ml-[256px] flex flex-col min-w-0">
        <Topbar onMenuToggle={() => setMobileDrawerOpen(!mobileDrawerOpen)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-content w-full mx-auto">
          <Outlet />
        </main>
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-[rgb(var(--color-bg))] border-t border-[rgb(var(--color-border))] flex items-center justify-around px-2 z-20">
          <MobileNavLink href="/dashboard" label="Home" icon="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          <MobileNavLink href="/documents" label="Docs" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          <MobileNavLink href="/chat" label="Chat" icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
<MobileNavLink href="/upload" label="Upload" icon="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </nav>
        <div className="lg:hidden h-16" />
      </div>
  );
}

function MobileNavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <NavLink
      to={href}
      className={({ isActive }) =>
        `flex flex-col items-center gap-0.5 px-3 py-1 rounded transition-colors min-h-[44px] min-w-[44px] justify-center ${
          isActive
            ? 'text-[rgb(var(--color-accent))]'
            : 'text-[rgb(var(--color-text-secondary))]'
        }`
      }
      aria-label={label}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
      </svg>
      <span className="text-caption">{label}</span>
    </NavLink>
  );
}
