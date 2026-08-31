import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

/**
 * Safe Markdown renderer using react-markdown + remark-gfm.
 * Phase 14 fix: replaces the broken custom regex renderer with a proper,
 * safe Markdown parser. No dangerouslySetInnerHTML.
 */
export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code).catch(() => { });
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none
      prose-headings:font-display prose-h1:text-h2 prose-h2:text-h3 prose-h3:text-h3
      prose-a:text-[rgb(var(--color-accent))]
      prose-code:text-caption prose-code:bg-[rgb(var(--color-surface))] prose-code:px-1 prose-code:py-0.5 prose-code:rounded
      prose-pre:bg-[rgb(var(--color-surface))] prose-pre:border prose-pre:border-[rgb(var(--color-border))] prose-pre:relative
      prose-blockquote:border-l-[rgb(var(--color-accent))] prose-blockquote:text-[rgb(var(--color-text-secondary))]
      prose-strong:text-[rgb(var(--color-text))]
      prose-ul:list-disc prose-ol:list-decimal
      [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-[rgb(var(--color-border))] [&_th]:p-2 [&_th]:bg-[rgb(var(--color-surface))]
      [&_td]:border [&_td]:border-[rgb(var(--color-border))] [&_td]:p-2
      [&_pre]:overflow-x-auto [&_pre]:scrollbar-thin"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ children }) => {
            let codeText = '';
            const child = Array.isArray(children) ? children[0] : children;
            if (child && typeof child === 'object' && 'props' in (child as object)) {
              const props = (child as { props?: { children?: ReactNode } }).props;
              if (props?.children) codeText = String(props.children);
            }
            const id = `copy-${Math.random().toString(36).slice(2, 8)}`;
            return (
              <div className="relative group">
                <pre>{children}</pre>
                {codeText && (
                  <button
                    onClick={() => handleCopy(codeText, id)}
                    className="absolute top-2 right-2 px-2 py-1 text-caption rounded bg-[rgb(var(--color-border))] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-bg))]"
                    aria-label="Copy code"
                  >
                    {copiedId === id ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
            );
          },
          code: ({ className, children }) => {
            const isBlock = className?.includes('language-');
            return isBlock ? <code className={className}>{children}</code> : <code>{children}</code>;
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4">
              <table className="w-full border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[rgb(var(--color-border))] p-2 bg-[rgb(var(--color-surface))] text-left">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border border-[rgb(var(--color-border))] p-2">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}