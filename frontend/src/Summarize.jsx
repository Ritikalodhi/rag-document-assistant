import { useState, useEffect } from 'react';
import { listDocuments, summarizeDocument } from './api';

export default function Summarize() {
  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listDocuments().then(data => setDocs(data.documents || [])).catch(() => {});
  }, []);

  async function summarize() {
    if (!selectedDoc) return alert('Select a document first');
    setLoading(true);
    setResult(null);
    try {
      const data = await summarizeDocument(selectedDoc);
      setResult(data);
    } catch {
      setResult({ error: 'Failed to connect to backend.' });
    }
    setLoading(false);
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8">
      <div className="max-w-[800px] mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[24px] font-semibold text-on-surface">Document Summary</h2>
            <p className="text-on-surface-variant text-[14px] mt-1">Generate an executive summary of a document</p>
          </div>
        </div>

        {/* Doc selector */}
        <div className="flex gap-3">
          <select
            value={selectedDoc}
            onChange={e => setSelectedDoc(e.target.value)}
            className="flex-1 bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-on-surface text-[14px] focus:outline-none focus:border-primary">
            <option value="">Select a document...</option>
            {docs.map(doc => (
              <option key={doc.doc_id || doc.filename} value={doc.doc_id || doc.filename}>
                {doc.filename || doc.name}
              </option>
            ))}
          </select>
          <button onClick={summarize} disabled={loading || !selectedDoc}
            className="px-6 py-3 bg-primary-container text-on-primary-container font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">{loading ? 'hourglass_empty' : 'summarize'}</span>
            {loading ? 'Generating...' : 'Summarize'}
          </button>
        </div>

        {!result && !loading && (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center space-y-4">
            <span className="material-symbols-outlined text-[64px] text-primary/30">summarize</span>
            <p className="text-on-surface-variant">Select a document and click Summarize</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-[40vh] space-y-4">
            <div className="flex gap-2">
              {[0,0.2,0.4].map((d,i) => (
                <div key={i} className="w-2 h-2 bg-primary rounded-full thinking-indicator" style={{animationDelay:`${d}s`}} />
              ))}
            </div>
            <p className="text-on-surface-variant text-[14px]">Analyzing document...</p>
          </div>
        )}

        {result?.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">{result.error}</div>
        )}

        {result && !result.error && (
          <div className="space-y-4">

            {result.summary?.executive_summary && (
              <div className="bg-[#18181B] border border-primary/20 p-6 rounded-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary" style={{fontVariationSettings:"'FILL' 1"}}>auto_awesome</span>
                  <span className="text-[12px] uppercase text-primary tracking-wider font-semibold">Executive Summary</span>
                  {result.cached && <span className="ml-auto px-2 py-1 bg-surface-container text-on-surface-variant rounded-lg text-[10px]">Cached</span>}
                </div>
                <p className="text-on-surface/90 leading-relaxed">{result.summary.executive_summary}</p>
              </div>
            )}

            {result.summary?.key_topics?.length > 0 && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-on-surface-variant tracking-wider font-semibold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">label</span>Key Topics
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.summary.key_topics.map((t, i) => (
                    <span key={i} className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[13px]">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {result.summary?.key_takeaways?.length > 0 && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-on-surface-variant tracking-wider font-semibold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">checklist</span>Key Takeaways
                </p>
                <ul className="space-y-3">
                  {result.summary.key_takeaways.map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-on-surface/90 text-[15px]">
                      <span className="w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-primary text-[11px] font-bold">{i+1}</span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.summary?.entities?.length > 0 && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-on-surface-variant tracking-wider font-semibold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">category</span>Key Entities
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.summary.entities.map((e, i) => (
                    <span key={i} className="px-3 py-1 bg-surface-container text-on-surface-variant border border-outline-variant/30 rounded-full text-[13px]">{e}</span>
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