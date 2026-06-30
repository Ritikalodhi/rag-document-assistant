import { useState, useEffect } from 'react';
import { listDocuments, compareDocuments } from './api';

export default function Compare() {
  const [docs, setDocs] = useState([]);
  const [docA, setDocA] = useState('');
  const [docB, setDocB] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listDocuments().then(d => setDocs(d.documents || [])).catch(() => {});
  }, []);

  async function compare() {
    if (!docA || !docB) return alert('Select both documents');
    if (docA === docB) return alert('Select two different documents');
    setLoading(true);
    setResult(null);
    try {
      const data = await compareDocuments(docA, docB);
      setResult(data);
    } catch {
      setResult({ error: 'Failed to connect to backend.' });
    }
    setLoading(false);
  }

  const docOptions = docs.map(d => ({ value: d.doc_id || d.filename, label: d.filename || d.name }));

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8">
      <div className="max-w-[800px] mx-auto space-y-6">

        <div>
          <h2 className="text-[24px] font-semibold text-on-surface">Compare Documents</h2>
          <p className="text-on-surface-variant text-[14px] mt-1">Identify matches, gaps and differences between two documents</p>
        </div>

        {/* Doc selectors */}
        <div className="grid grid-cols-2 gap-4">
          {[['Document A', docA, setDocA], ['Document B', docB, setDocB]].map(([label, val, setter]) => (
            <div key={label} className="bg-[#18181B] border border-outline-variant/20 p-4 rounded-2xl">
              <p className="text-[11px] uppercase text-on-surface-variant tracking-wider mb-3">{label}</p>
              <select
                value={val}
                onChange={e => setter(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2 text-on-surface text-[14px] focus:outline-none focus:border-primary">
                <option value="">Select document...</option>
                {docOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <button onClick={compare} disabled={loading || !docA || !docB}
          className="w-full py-3 bg-primary-container text-on-primary-container font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined">{loading ? 'hourglass_empty' : 'compare_arrows'}</span>
          {loading ? 'Comparing...' : 'Compare Documents'}
        </button>

        {!result && !loading && (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center space-y-4">
            <span className="material-symbols-outlined text-[64px] text-primary/30">compare_arrows</span>
            <p className="text-on-surface-variant">Select two documents and click Compare</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-[40vh] space-y-4">
            <div className="flex gap-2">
              {[0,0.2,0.4].map((d,i) => (
                <div key={i} className="w-2 h-2 bg-primary rounded-full thinking-indicator" style={{animationDelay:`${d}s`}} />
              ))}
            </div>
            <p className="text-on-surface-variant text-[14px]">Comparing documents...</p>
          </div>
        )}

        {result?.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">{result.error}</div>
        )}

        {result && !result.error && (
          <div className="space-y-4">

            {result.comparison?.similarity_score !== undefined && (
              <div className="bg-[#18181B] border border-primary/20 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[12px] uppercase text-primary tracking-wider font-semibold">Similarity Score</span>
                  <span className="text-[24px] font-semibold text-primary">{result.comparison.similarity_score}%</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2">
                  <div className="bg-primary-container h-2 rounded-full transition-all duration-700"
                    style={{width:`${result.comparison.similarity_score}%`}} />
                </div>
              </div>
            )}

            {result.comparison?.common_themes?.length > 0 && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-emerald-400 tracking-wider font-semibold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  Common Themes ({result.comparison.common_themes.length})
                </p>
                <ul className="space-y-3">
                  {result.comparison.common_themes.map((m, i) => (
                    <li key={i} className="flex items-start gap-3 text-on-surface/90 text-[14px]">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full flex-shrink-0 mt-2" />{m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.comparison?.unique_to_a?.length > 0 && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-primary tracking-wider font-semibold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">looks_one</span>
                  Unique to Document A
                </p>
                <ul className="space-y-3">
                  {result.comparison.unique_to_a.map((m, i) => (
                    <li key={i} className="flex items-start gap-3 text-on-surface/90 text-[14px]">
                      <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2" />{m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.comparison?.unique_to_b?.length > 0 && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-tertiary tracking-wider font-semibold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">looks_two</span>
                  Unique to Document B
                </p>
                <ul className="space-y-3">
                  {result.comparison.unique_to_b.map((m, i) => (
                    <li key={i} className="flex items-start gap-3 text-on-surface/90 text-[14px]">
                      <span className="w-2 h-2 bg-tertiary rounded-full flex-shrink-0 mt-2" />{m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.comparison?.recommendation && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-on-surface-variant tracking-wider font-semibold mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                  Recommendation
                </p>
                <p className="text-on-surface/90 text-[14px] leading-relaxed">{result.comparison.recommendation}</p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}