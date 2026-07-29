import { useState, type ReactNode } from 'react';

interface Tab {
  id: string;
  label: string;
  badge?: string | number;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onChange?: (tabId: string) => void;
  children?: ReactNode;
  className?: string;
}

export function Tabs({ tabs, activeTab: controlledActive, onChange, children, className = '' }: TabsProps) {
  const [internalActive, setInternalActive] = useState(tabs[0]?.id ?? '');
  const activeTab = controlledActive ?? internalActive;

  const handleChange = (tabId: string) => {
    if (onChange) {
      onChange(tabId);
    } else {
      setInternalActive(tabId);
    }
  };

  return (
    <div className={className}>
      <div className="border-b border-[rgb(var(--color-border))]" role="tablist">
        <nav className="flex gap-6 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => handleChange(tab.id)}
              className={`px-1 py-3 text-body font-medium border-b-2 transition-colors inline-flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-[rgb(var(--color-accent))] text-[rgb(var(--color-accent))]'
                  : 'border-transparent text-[rgb(var(--color-text-secondary))] hover:text-[rgb(var(--color-text))]'
              }`}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span className="text-caption px-1.5 py-0.5 rounded-full bg-[rgb(var(--color-surface))]">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}

