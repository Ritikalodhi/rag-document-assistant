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
          p: ({ children }) => (
            <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>
          ),
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 text-h2 font-display font-semibold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-6 mb-3 text-h3 font-display font-semibold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-5 mb-2 text-h3 font-display font-semibold first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="mt-4 mb-2 font-semibold first:mt-0">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="mt-4 mb-2 font-semibold first:mt-0">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="mt-4 mb-2 font-semibold first:mt-0">{children}</h6>
          ),
          ul: ({ children }) => (
            <ul className="mb-4 list-disc space-y-4 pl-6 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-4 list-decimal space-y-4 pl-6 last:mb-0">{children}</ol>
          ),
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