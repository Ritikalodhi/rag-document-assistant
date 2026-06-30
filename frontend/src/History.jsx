import { useState, useEffect } from 'react';
import { getHistory, clearHistory } from './api';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getHistory();
      setHistory(data.conversations || []);
    } catch { setHistory([]); }
    setLoading(false);
  }

  async function clear() {
    if (!window.confirm('Clear all history?')) return;
    await clearHistory();
    setHistory([]);
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8">
      <div className="max-w-[800px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[24px] font-semibold text-on-surface">History</h2>
            <p className="text-on-surface-variant text-[14px] mt-1">All previous queries and responses</p>
          </div>
          <div className="flex gap-3">
            <button onClick={load} className="px-4 py-2 bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl text-[12px] uppercase hover:bg-surface-variant transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">refresh</span>Refresh
            </button>
            <button onClick={clear} className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-[12px] uppercase hover:bg-red-500/20 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">delete</span>Clear All
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
            <div className="flex gap-2">{[0,0.2,0.4].map((d,i) => <div key={i} className="w-2 h-2 bg-primary rounded-full thinking-indicator" style={{animationDelay:`${d}s`}} />)}</div>
            <p className="text-on-surface-variant text-[14px]">Loading history...</p>
          </div>
        )}

        {!loading && history.length === 0 && (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
            <span className="material-symbols-outlined text-[64px] text-primary/30">history</span>
            <p className="text-on-surface-variant">No history yet. Start chatting!</p>
          </div>
        )}

        {!loading && history.length > 0 && (
          <div className="space-y-4">
            {history.map((item, i) => (
              <div key={i} className="bg-[#18181B] border border-outline-variant/20 rounded-2xl overflow-hidden">
                <div className="flex items-start gap-3 p-5 border-b border-outline-variant/10">
                  <div className="w-7 h-7 bg-surface-container rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">person</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] uppercase text-on-surface-variant tracking-wider">Query</span>
                      {item.timestamp && <span className="text-[11px] text-on-surface-variant/50">{new Date(item.timestamp).toLocaleString()}</span>}
                    </div>
                    <p className="text-on-surface/90 text-[14px]">{item.question}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-5">
                  <div className="w-7 h-7 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[16px] text-primary" style={{fontVariationSettings:"'FILL' 1"}}>auto_awesome</span>
                  </div>
                  <div className="flex-1">
                    <span className="text-[11px] uppercase text-primary tracking-wider block mb-1">DocMind Response</span>
                    <p className="text-on-surface/80 text-[14px] leading-relaxed">{item.answer}</p>
                    {item.context?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.context.map((s, j) => (
                          <span key={j} className="flex items-center gap-1 px-2 py-1 bg-surface-container border border-outline-variant/20 rounded-lg text-[11px] text-on-surface-variant">
                            <span className="material-symbols-outlined text-[13px] text-primary">picture_as_pdf</span>
                            {s.source}{s.page && ` • p.${s.page}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}