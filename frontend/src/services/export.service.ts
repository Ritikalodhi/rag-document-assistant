const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function downloadUrl(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Download failed with status ${res.status}`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export const exportService = {
  async exportDocumentSummary(docId: string, format: 'markdown' | 'pdf'): Promise<void> {
    const url = `${API_BASE_URL}/api/documents/${docId}/export/summary?format=${format}`;
    const ext = format === 'markdown' ? 'md' : 'pdf';
    await downloadUrl(url, `document-${docId}-summary.${ext}`);
  },

  async exportHistory(format: 'markdown' | 'pdf'): Promise<void> {
    const url = `${API_BASE_URL}/api/export/history?format=${format}`;
    const ext = format === 'markdown' ? 'md' : 'pdf';
    await downloadUrl(url, `conversation-history.${ext}`);
  },
};

