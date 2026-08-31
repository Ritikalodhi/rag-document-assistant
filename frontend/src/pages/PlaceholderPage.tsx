interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 mb-4 rounded-[10px] bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] flex items-center justify-center">
        <svg className="w-6 h-6 text-[rgb(var(--color-text-secondary))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <h1 className="text-[20px] font-display font-semibold text-[rgb(var(--color-text))] mb-1.5">{title}</h1>
      {description && (
        <p className="text-[14px] text-[rgb(var(--color-text-secondary))] max-w-md">
          {description}
        </p>
      )}
    </div>
  );
}