export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function groupConversationsByDate<T extends { id: string; created_at: string }>(
  convs: T[]
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;

  for (const conv of convs) {
    const date = new Date(conv.created_at).getTime();
    let group: string;
    if (date >= today) group = 'Today';
    else if (date >= yesterday) group = 'Yesterday';
    else if (date >= weekAgo) group = 'Previous 7 Days';
    else group = 'Older';

    if (!groups[group]) groups[group] = [];
    groups[group]!.push(conv);
  }

  return groups;
}
