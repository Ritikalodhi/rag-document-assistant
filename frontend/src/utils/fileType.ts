const TYPE_MAP: Record<string, string> = { pdf: 'PDF', txt: 'TXT', docx: 'DOCX', md: 'MD' };

export function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return TYPE_MAP[ext] ?? 'UNKNOWN';
}
