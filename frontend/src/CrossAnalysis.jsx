import { useState, useEffect } from 'react';
import { listDocuments, crossAnalysis } from './api';

export default function CrossAnalysis() {
  const [docs, setDocs] = useState([]);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    listDocuments().then(d => setDocs(d.documents || [])).catch(() => {});
  }, []);

  function toggleDoc(id) {
    setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  async function analyze() {
    setLoading(true); setResult(null);
    try {
      const data = await crossAnalysis(selected.length ? selected : null);
      setResult(data);
    } catch { setResult({ error: 'Failed to connect.' }); }
    setLoading(false);
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8">
      <div className="max-w-[800px] mx-auto space-y-6">
        <div>
          <h2 className="text-[24px] font-semibold text-on-surface">Cross Analysis</h2>
          <p className="text-on-surface-variant text-[14px] mt-1">Shared concepts across multiple documents</p>
        </div>

        {docs.length > 0 && (
          <div className="bg-[#18181B] border border-outline-variant/20 p-4 rounded-2xl">
            <p className="text-[11px] uppercase text-on-surface-variant tracking-wider mb-3">Select Documents (leave all unchecked to analyze all)</p>
            <div className="flex flex-wrap gap-2">
              {docs.map(doc => {
                const id = doc.doc_id || doc.filename;
                const isSelected = selected.includes(id);
                return (
                  <button key={id} onClick={() => toggleDoc(id)}
                    className={`px-3 py-1 rounded-full text-[13px] border transition-all ${isSelected ? 'bg-primary/20 text-primary border-primary/40' : 'bg-surface-container text-on-surface-variant border-outline-variant/30'}`}>
                    {doc.filename || doc.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <button onClick={analyze} disabled={loading}
          className="w-full py-3 bg-primary-container text-on-primary-container font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined">{loading ? 'hourglass_empty' : 'analytics'}</span>
          {loading ? 'Analyzing...' : 'Run Analysis'}
        </button>

        {loading && (
          <div className="flex flex-col items-center justify-center h-[40vh] space-y-4">
            <div className="flex gap-2">{[0,0.2,0.4].map((d,i) => <div key={i} className="w-2 h-2 bg-primary rounded-full thinking-indicator" style={{animationDelay:`${d}s`}} />)}</div>
            <p className="text-on-surface-variant text-[14px]">Analyzing documents...</p>
          </div>
        )}

        {result?.error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">{result.error}</div>}

        {result && !result.error && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Documents', value: result.document_count ?? docs.length, icon: 'description' },
                { label: 'Shared Concepts', value: result.shared_concepts?.length || 0, icon: 'hub' },
                { label: 'Themes', value: result.common_themes?.length || 0, icon: 'category' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-[#18181B] border border-outline-variant/20 p-4 rounded-2xl text-center">
                  <span className="material-symbols-outlined text-primary text-[28px]">{icon}</span>
                  <p className="text-[28px] font-semibold text-on-surface mt-1">{value}</p>
                  <p className="text-[12px] text-on-surface-variant uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>

            {result.shared_concepts?.length > 0 && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-primary tracking-wider font-semibold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]">hub</span>Shared Concepts
                </p>
                <div className="space-y-2">
                  {result.shared_concepts.map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-surface-container rounded-xl">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 bg-primary rounded-full" />
                        <span className="text-on-surface/90 text-[14px]">{c.concept || c}</span>
                      </div>
                      {c.frequency && <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[11px] font-bold">{c.frequency} docs</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.common_themes?.length > 0 && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-on-surface-variant tracking-wider font-semibold mb-4">Common Themes</p>
                <div className="flex flex-wrap gap-2">
                  {result.common_themes.map((t, i) => (
                    <span key={i} className="px-3 py-1 bg-surface-container text-on-surface-variant border border-outline-variant/30 rounded-full text-[13px]">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {result.insights?.length > 0 && (
              <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                <p className="text-[12px] uppercase text-on-surface-variant tracking-wider font-semibold mb-4">Key Insights</p>
                <ul className="space-y-3">
                  {result.insights.map((ins, i) => (
                    <li key={i} className="flex items-start gap-3 text-on-surface/90 text-[14px]">
                      <span className="w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-primary text-[11px] font-bold">{i+1}</span>{ins}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// import { useState } from 'react';

// export default function CrossAnalysis() {
//   const [result, setResult] = useState(null);
//   const [loading, setLoading] = useState(false);

//   async function analyze() {
//     setLoading(true);
//     try {
//       const res = await fetch('http://127.0.0.1:8000/cross-analysis', { method: 'POST' });
//       const data = await res.json();
//       setResult(data);
//     } catch {
//       setResult({ error: 'Failed to connect to backend.' });
//     }
//     setLoading(false);
//   }

//   return (
//     <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8">
//       <div className="max-w-[800px] mx-auto space-y-6">

//         <div className="flex items-center justify-between">
//           <div>
//             <h2 className="text-[24px] font-semibold text-on-surface">Cross Analysis</h2>
//             <p className="text-on-surface-variant text-[14px] mt-1">Shared concepts and themes across all uploaded documents</p>
//           </div>
//           <button onClick={analyze} disabled={loading}
//             className="px-6 py-3 bg-primary-container text-on-primary-container font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
//             <span className="material-symbols-outlined text-[20px]">{loading ? 'hourglass_empty' : 'analytics'}</span>
//             {loading ? 'Analyzing...' : 'Run Analysis'}
//           </button>
//         </div>

//         {!result && !loading && (
//           <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
//             <span className="material-symbols-outlined text-[64px] text-primary/30">analytics</span>
//             <p className="text-on-surface-variant">Click "Run Analysis" to find shared concepts</p>
//           </div>
//         )}

//         {loading && (
//           <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
//             <div className="flex gap-2">
//               {[0,0.2,0.4].map((d,i) => (
//                 <div key={i} className="w-2 h-2 bg-primary rounded-full thinking-indicator" style={{animationDelay:`${d}s`}} />
//               ))}
//             </div>
//             <p className="text-on-surface-variant text-[14px]">Analyzing across all documents...</p>
//           </div>
//         )}

//         {result?.error && (
//           <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">{result.error}</div>
//         )}

//         {result && !result.error && (
//           <div className="space-y-4">

//             {/* Summary bar */}
//             {result.document_count !== undefined && (
//               <div className="grid grid-cols-3 gap-4">
//                 {[
//                   { label: 'Documents', value: result.document_count, icon: 'description' },
//                   { label: 'Shared Concepts', value: result.concepts?.length || 0, icon: 'hub' },
//                   { label: 'Themes', value: result.themes?.length || 0, icon: 'category' },
//                 ].map(({ label, value, icon }) => (
//                   <div key={label} className="bg-[#18181B] border border-outline-variant/20 p-4 rounded-2xl text-center">
//                     <span className="material-symbols-outlined text-primary text-[28px]">{icon}</span>
//                     <p className="text-[28px] font-semibold text-on-surface mt-1">{value}</p>
//                     <p className="text-[12px] text-on-surface-variant uppercase tracking-wider">{label}</p>
//                   </div>
//                 ))}
//               </div>
//             )}

//             {/* Shared Concepts */}
//             {result.concepts?.length > 0 && (
//               <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
//                 <p className="text-[12px] uppercase text-primary tracking-wider font-semibold mb-4 flex items-center gap-2">
//                   <span className="material-symbols-outlined text-[18px]">hub</span>
//                   Shared Concepts
//                 </p>
//                 <div className="space-y-3">
//                   {result.concepts.map((c, i) => (
//                     <div key={i} className="flex items-center justify-between p-3 bg-surface-container rounded-xl border border-outline-variant/10">
//                       <div className="flex items-center gap-3">
//                         <span className="w-2 h-2 bg-primary rounded-full" />
//                         <span className="text-on-surface/90 text-[14px]">{c.concept || c}</span>
//                       </div>
//                       {c.doc_count && (
//                         <span className="px-2 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[11px] font-bold">
//                           {c.doc_count} docs
//                         </span>
//                       )}
//                     </div>
//                   ))}
//                 </div>
//               </div>
//             )}

//             {/* Themes */}
//             {result.themes?.length > 0 && (
//               <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
//                 <p className="text-[12px] uppercase text-on-surface-variant tracking-wider font-semibold mb-4 flex items-center gap-2">
//                   <span className="material-symbols-outlined text-[18px]">category</span>
//                   Common Themes
//                 </p>
//                 <div className="flex flex-wrap gap-2">
//                   {result.themes.map((t, i) => (
//                     <span key={i} className="px-3 py-1 bg-surface-container text-on-surface-variant border border-outline-variant/30 rounded-full text-[13px]">{t}</span>
//                   ))}
//                 </div>
//               </div>
//             )}

//             {/* Insights */}
//             {result.insights?.length > 0 && (
//               <div className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
//                 <p className="text-[12px] uppercase text-on-surface-variant tracking-wider font-semibold mb-4 flex items-center gap-2">
//                   <span className="material-symbols-outlined text-[18px]">lightbulb</span>
//                   Key Insights
//                 </p>
//                 <ul className="space-y-3">
//                   {result.insights.map((ins, i) => (
//                     <li key={i} className="flex items-start gap-3 text-on-surface/90 text-[14px]">
//                       <span className="w-5 h-5 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-primary text-[11px] font-bold">{i+1}</span>
//                       {ins}
//                     </li>
//                   ))}
//                 </ul>
//               </div>
//             )}

//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
