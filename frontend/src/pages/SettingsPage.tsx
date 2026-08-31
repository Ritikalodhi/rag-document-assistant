import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { Button, Dialog } from '@/components/ui';
import { useClearConversations } from '@/features/chat/hooks/useConversations';
import { exportService } from '@/services/export.service';

const motionProps = (delay = 0) => ({
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, delay, ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number] },
});

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { setTheme, theme } = useTheme();
  const { addToast } = useToast();
  const clearConvs = useClearConversations();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [exportingHistory, setExportingHistory] = useState(false);

  const handleExportHistory = async () => {
    setExportingHistory(true);
    try {
      await exportService.exportHistory('markdown');
      addToast('success', 'Conversation history exported');
    } catch {
      addToast('error', 'Failed to export history');
    } finally {
      setExportingHistory(false);
    }
  };

  const handleClearAll = () => {
    clearConvs.mutate(undefined, {
      onSuccess: () => setClearDialogOpen(false),
    });
  };

  return (
    <div className="flex flex-col gap-7 max-w-2xl">
      {/* Header */}
      <motion.div {...motionProps(0)}>
        <h1 className="text-[26px] sm:text-[28px] font-display font-semibold tracking-tight text-[rgb(var(--color-text))]">Settings</h1>
        <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mt-1">
          Manage your research workspace preferences, theme, and data.
        </p>
      </motion.div>

      {/* Account Profile */}
      <motion.section {...motionProps(0.05)} className="flex flex-col gap-3">
        <h2 className="text-[11px] font-bold text-[rgb(var(--color-text-tertiary))] uppercase tracking-[0.1em]">
          Account Profile
        </h2>
        <div className="rounded-[14px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] shadow-[var(--shadow-sm)] divide-y divide-[rgb(var(--color-border-subtle))]">
          <div className="flex justify-between items-center px-5 py-4">
            <span className="text-[14px] font-medium text-[rgb(var(--color-text-secondary))]">Username</span>
            <span className="text-[14px] font-semibold text-[rgb(var(--color-text))] font-code">{user?.username ?? '—'}</span>
          </div>
          <div className="flex justify-between items-center px-5 py-4">
            <span className="text-[14px] font-medium text-[rgb(var(--color-text-secondary))]">Email</span>
            <span className="text-[14px] font-semibold text-[rgb(var(--color-text))] font-code">{user?.email ?? '—'}</span>
          </div>
          <div className="flex justify-between items-center px-5 py-4">
            <span className="text-[14px] font-medium text-[rgb(var(--color-text-secondary))]">Member since</span>
            <span className="text-[14px] font-semibold text-[rgb(var(--color-text))] font-code">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
      </motion.section>

      {/* Appearance */}
      <motion.section {...motionProps(0.08)} className="flex flex-col gap-3">
        <h2 className="text-[11px] font-bold text-[rgb(var(--color-text-tertiary))] uppercase tracking-[0.1em]">
          Appearance
        </h2>
        <div className="p-5 rounded-[14px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] shadow-[var(--shadow-sm)] flex items-center justify-between">
          <div>
            <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">Theme Mode</p>
            <p className="text-[13px] text-[rgb(var(--color-text-secondary))] mt-0.5">
              Select your preferred visual style (Aperture Dark / Lumen Light)
            </p>
          </div>
          <div className="flex items-center gap-1.5 p-1 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-[8px]">
            <button
              onClick={() => setTheme('lumen')}
              className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors ${theme === 'lumen'
                  ? 'bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-accent))] shadow-sm'
                  : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))]'
                }`}
            >
              Lumen (Light)
            </button>
            <button
              onClick={() => setTheme('aperture')}
              className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors ${theme === 'aperture'
                  ? 'bg-[rgb(var(--color-elevated))] text-[rgb(var(--color-accent))] shadow-sm'
                  : 'text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))]'
                }`}
            >
              Aperture (Dark)
            </button>
          </div>
        </div>
      </motion.section>

      {/* Data Management */}
      <motion.section {...motionProps(0.1)} className="flex flex-col gap-3">
        <h2 className="text-[11px] font-bold text-[rgb(var(--color-text-tertiary))] uppercase tracking-[0.1em]">
          Data Management
        </h2>
        <div className="rounded-[14px] border border-[rgb(var(--color-border))] bg-[rgb(var(--color-elevated))] shadow-[var(--shadow-sm)] divide-y divide-[rgb(var(--color-border-subtle))]">
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-[15px] font-semibold text-[rgb(var(--color-text))]">Export history</p>
              <p className="text-[13px] text-[rgb(var(--color-text-secondary))] mt-0.5">
                Download your past conversation history as Markdown
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportHistory}
              isLoading={exportingHistory}
            >
              Export
            </Button>
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <div>
              <p className="text-[15px] font-semibold text-[rgb(var(--color-danger))]">Clear conversation history</p>
              <p className="text-[13px] text-[rgb(var(--color-text-secondary))] mt-0.5">
                Permanently delete all your chat conversations
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setClearDialogOpen(true)}
            >
              Clear all
            </Button>
          </div>
        </div>
      </motion.section>

      {/* Session Actions */}
      <motion.div {...motionProps(0.12)} className="pt-2">
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] border border-[rgb(var(--color-border))] text-[14px] font-medium text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-danger))] hover:border-[rgb(var(--color-danger))]/40 hover:bg-[rgb(var(--color-danger))]/5 transition-all duration-150 active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </motion.div>

      {/* Clear all dialog */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)} title="Clear all conversations">
        <p className="text-[14px] text-[rgb(var(--color-text-secondary))] mb-6">
          Are you sure you want to delete all conversations? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setClearDialogOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleClearAll} isLoading={clearConvs.isPending}>
            Delete all
          </Button>
        </div>
      </Dialog>
    </div>
  );
}