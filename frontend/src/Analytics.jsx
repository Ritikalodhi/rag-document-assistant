import { useState, useEffect } from 'react';
import { getAnalytics } from './api';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetch(); }, []);

  async function fetch() {
    setLoading(true);
    try { setData(await getAnalytics()); }
    catch { setData({ error: 'Failed to connect.' }); }
    setLoading(false);
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8">
      <div className="max-w-[800px] mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[24px] font-semibold text-on-surface">Analytics</h2>
            <p className="text-on-surface-variant text-[14px] mt-1">System stats, document index & LLM config</p>
          </div>
          <button onClick={fetch} disabled={loading}
            className="px-4 py-2 bg-surface-container-high border border-outline-variant/30 text-on-surface rounded-xl text-[12px] uppercase hover:bg-surface-variant transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">refresh</span>Refresh
          </button>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
            <div className="flex gap-2">{[0,0.2,0.4].map((d,i) => <div key={i} className="w-2 h-2 bg-primary rounded-full thinking-indicator" style={{animationDelay:`${d}s`}} />)}</div>
            <p className="text-on-surface-variant text-[14px]">Loading analytics...</p>
          </div>
        )}

        {data?.error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">{data.error}</div>}

        {data && !data.error && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Documents', value: data.total_documents ?? '—', icon: 'description' },
                { label: 'Total Chunks', value: data.total_chunks ?? '—', icon: 'grid_view' },
                { label: 'Collections', value: data.total_collections ?? '—', icon: 'folder' },
                { label: 'Model', value: data.llm_info?.model ?? '—', icon: 'smart_toy' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-[#18181B] border border-outline-variant/20 p-5 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-primary text-[22px]">{icon}</span>
                  </div>
                  <div>
                    <p className="text-[22px] font-semibold text-on-surface">{value}</p>
                    <p className="text-[12px] text-on-surface-variant uppercase tracking-wider">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {data.llm_info && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-primary tracking-wider font-semibold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">settings</span>LLM Configuration
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(data.llm_info).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between bg-surface-container p-3 rounded-xl">
                      <span className="text-[13px] text-on-surface-variant capitalize">{k.replace(/_/g,' ')}</span>
                      <span className="text-[13px] text-on-surface font-medium font-mono">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.documents?.length > 0 && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-on-surface-variant tracking-wider font-semibold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">folder</span>Documents ({data.documents.length})
                </p>
                <div className="space-y-2">
                  {data.documents.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface-container rounded-xl border border-outline-variant/10">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-[20px]">picture_as_pdf</span>
                        <div>
                          <p className="text-[14px] text-on-surface">{doc.filename || doc.name}</p>
                          {doc.chunk_count && <p className="text-[12px] text-on-surface-variant">{doc.chunk_count} chunks</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}