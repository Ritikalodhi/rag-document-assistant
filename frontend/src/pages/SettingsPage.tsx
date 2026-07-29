import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import { Button, Card, Dialog } from '@/components/ui';
import { useClearConversations } from '@/features/chat/hooks/useConversations';
import { exportService } from '@/services/export.service';

export function SettingsPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { setTheme, isDark } = useTheme();
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
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-h1 font-display">Settings</h1>
        <p className="text-body text-[rgb(var(--color-text-secondary))] mt-1">
          Configure your workspace preferences.
        </p>
      </div>

      {/* Profile */}
      <section>
        <h2 className="text-h2 font-display mb-4">Profile</h2>
        <Card padding="md">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-caption font-medium text-[rgb(var(--color-text-secondary))] mb-1">Username</p>
              <p className="text-body">{user?.username ?? '—'}</p>
            </div>
            <div>
              <p className="text-caption font-medium text-[rgb(var(--color-text-secondary))] mb-1">Email</p>
              <p className="text-body">{user?.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-caption font-medium text-[rgb(var(--color-text-secondary))] mb-1">Member since</p>
              <p className="text-body">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Appearance */}
      <section>
        <h2 className="text-h2 font-display mb-4">Appearance</h2>
        <Card padding="md">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body font-medium">Theme</p>
                <p className="text-caption text-[rgb(var(--color-text-secondary))]">
                  {isDark ? 'Dark (Aperture)' : 'Light (Lumen)'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTheme('lumen')}
                  className={`px-4 py-2 rounded text-caption font-medium border transition-colors ${
                    !isDark
                      ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))]'
                      : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))]'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme('aperture')}
                  className={`px-4 py-2 rounded text-caption font-medium border transition-colors ${
                    isDark
                      ? 'border-[rgb(var(--color-accent))] bg-[rgb(var(--color-accent))]/10 text-[rgb(var(--color-accent))]'
                      : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-secondary))]'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {/* Data */}
      <section>
        <h2 className="text-h2 font-display mb-4">Data</h2>
        <Card padding="md">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-body font-medium">Export conversation history</p>
                <p className="text-caption text-[rgb(var(--color-text-secondary))]">
                  Download all your conversations as Markdown
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
            <div className="border-t border-[rgb(var(--color-border))] pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-body font-medium text-red-500">Clear all conversations</p>
                  <p className="text-caption text-[rgb(var(--color-text-secondary))]">
                    Permanently delete all conversation history
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
          </div>
        </Card>
      </section>

      {/* Sign out */}
      <section>
        <Button
          variant="secondary"
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full"
        >
          Sign out
        </Button>
      </section>

      {/* Clear all dialog */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)} title="Clear all conversations">
        <p className="text-body text-[rgb(var(--color-text-secondary))] mb-6">
          Are you sure you want to delete all conversations? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setClearDialogOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleClearAll} isLoading={clearConvs.isPending}>
            Delete all
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

