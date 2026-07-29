import { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const html = useMemo(() => renderMarkdown(content), [content]);

  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none
        prose-headings:font-display prose-h1:text-h2 prose-h2:text-h3 prose-h3:text-h3
        prose-a:text-[rgb(var(--color-accent))]
        prose-code:text-caption prose-code:bg-[rgb(var(--color-surface))] prose-code:px-1 prose-code:py-0.5 prose-code:rounded
        prose-pre:bg-[rgb(var(--color-surface))] prose-pre:border prose-pre:border-[rgb(var(--color-border))] prose-pre:relative
        prose-blockquote:border-l-[rgb(var(--color-accent))] prose-blockquote:text-[rgb(var(--color-text-secondary))]
        prose-strong:text-[rgb(var(--color-text))]
        prose-ul:list-disc prose-ol:list-decimal
        [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[rgb(var(--color-border))] [&_th]:p-2 [&_th]:bg-[rgb(var(--color-surface))]
        [&_td]:border [&_td]:border-[rgb(var(--color-border))] [&_td]:p-2
        [&_pre]:overflow-x-auto [&_pre]:scrollbar-thin
      "
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

function renderMarkdown(text: string): string {
  let html = escapeHtml(text);

  // Footnotes: [^id] and [^id]: content
  const footnotes: Record<string, string> = {};
  html = html.replace(/\[\^(\w+)\]:\s*(.+)/g, (_, id, content) => {
    footnotes[id] = content.trim();
    return '';
  });
  html = html.replace(/\[\^(\w+)\]/g, (_, id) => {
    const fnContent = footnotes[id];
    if (!fnContent) return `[^${id}]`;
    return `<sup><a href="#fn-${id}" id="fnref-${id}" class="text-[rgb(var(--color-accent))] no-underline hover:underline">[${Object.keys(footnotes).indexOf(id) + 1}]</a></sup>`;
  });

  // Code blocks (```) with copy button
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_, lang, code) => {
      const langClass = lang ? ` class="language-${lang}"` : '';
      const copyId = `copy-${Math.random().toString(36).slice(2, 8)}`;
      return `<div class="relative group"><pre><code${langClass}>${code}</code></pre><button onclick="(function(){const el=document.getElementById('${copyId}');const ta=document.createElement('textarea');ta.value=el.getAttribute('data-code');document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);el.textContent='Copied!';setTimeout(()=>el.textContent='Copy',2000);})()" id="${copyId}" data-code="${escapeHtml(code.trim())}" class="absolute top-2 right-2 px-2 py-1 text-caption rounded bg-[rgb(var(--color-border))] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-bg))]" aria-label="Copy code">Copy</button></div>`;
    },
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Task lists
  html = html.replace(
    /^- \[x\] (.+)$/gm,
    '<li class="flex items-center gap-2"><input type="checkbox" checked disabled class="accent-[rgb(var(--color-accent))]" /> <span class="line-through text-[rgb(var(--color-text-secondary))]">$1</span></li>',
  );
  html = html.replace(
    /^- \[ \] (.+)$/gm,
    '<li class="flex items-center gap-2"><input type="checkbox" disabled class="accent-[rgb(var(--color-accent))]" /> <span>$1</span></li>',
  );

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');

  // Thematic break
  html = html.replace(
    /^---$/gm,
    '<hr class="my-4 border-[rgb(var(--color-border))]" />',
  );

  // Images
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="rounded max-w-full h-auto my-4" loading="lazy" />',
  );

  // Wrap remaining text in <p> tags
  const lines = html.split('\n');
  const result: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (!inBlock) result.push('');
      continue;
    }

    if (
      trimmed.startsWith('<pre') ||
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<li') ||
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('<hr') ||
      trimmed.startsWith('<input') ||
      trimmed.startsWith('<img') ||
      trimmed.startsWith('<sup')
    ) {
      inBlock = true;
      result.push(trimmed);
      if (
        trimmed.startsWith('</') ||
        trimmed.endsWith('/>') ||
        trimmed.endsWith('</h2>') ||
        trimmed.endsWith('</h3>') ||
        trimmed.endsWith('</h4>') ||
        trimmed.endsWith('</li>') ||
        trimmed.endsWith('</blockquote>')
      ) {
        inBlock = false;
      }
      continue;
    }

    if (!inBlock && !trimmed.startsWith('<')) {
      result.push(`<p>${trimmed}</p>`);
    } else {
      result.push(trimmed);
    }
  }

  // Append footnotes section if any
  const fnKeys = Object.keys(footnotes);
  if (fnKeys.length > 0) {
    result.push(
      '<hr class="my-6 border-[rgb(var(--color-border))]" />',
      '<div class="text-caption text-[rgb(var(--color-text-secondary))]">',
      '<p class="font-medium mb-2">Footnotes</p>',
    );
    fnKeys.forEach((id, i) => {
      result.push(
        `<p id="fn-${id}" class="mb-1">${i + 1}. ${footnotes[id]} <a href="#fnref-${id}" class="text-[rgb(var(--color-accent))] no-underline hover:underline" aria-label="Back to reference">&crarr;</a></p>`,
      );
    });
    result.push('</div>');
  }

  return result.join('\n');
}
