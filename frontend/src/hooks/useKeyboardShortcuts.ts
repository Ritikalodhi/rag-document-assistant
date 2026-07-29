import { useEffect } from 'react';

interface Shortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  handler: () => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlOrMeta = shortcut.ctrl || shortcut.meta;
        const matchesCtrl = shortcut.ctrl && (e.ctrlKey || e.metaKey);
        const matchesMeta = shortcut.meta && e.metaKey;
        const matchesModifier = ctrlOrMeta ? (matchesCtrl || matchesMeta) : true;
        const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (matchesKey && matchesModifier) {
          if (shortcut.preventDefault !== false) {
            e.preventDefault();
            e.stopPropagation();
          }
          shortcut.handler();
          return;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}