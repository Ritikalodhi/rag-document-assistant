import { useState, useEffect } from 'react';
import { listDocuments, getStudyNotes } from './api';

export default function StudyNotes() {
  const [docs, setDocs] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('flashcards');
  const [flipped, setFlipped] = useState({});
  const [selected, setSelected] = useState({});

  useEffect(() => {
    listDocuments().then(d => setDocs(d.documents || [])).catch(() => {});
  }, []);

  async function generate() {
    if (!selectedDoc) return alert('Select a document first');
    setLoading(true);
    setResult(null);
    try {
      const data = await getStudyNotes(selectedDoc);
      setResult(data);
    } catch {
      setResult({ error: 'Failed to connect to backend.' });
    }
    setLoading(false);
  }

  const tabs = ['flashcards', 'mcq', 'viva', 'concepts'];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-8 py-8">
      <div className="max-w-[800px] mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[24px] font-semibold text-on-surface">Study Notes</h2>
            <p className="text-on-surface-variant text-[14px] mt-1">Flashcards, MCQs, viva questions & key concepts</p>
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
          <button onClick={generate} disabled={loading || !selectedDoc}
            className="px-6 py-3 bg-primary-container text-on-primary-container font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">{loading ? 'hourglass_empty' : 'edit_note'}</span>
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>

        {!result && !loading && (
          <div className="flex flex-col items-center justify-center h-[40vh] text-center space-y-4">
            <span className="material-symbols-outlined text-[64px] text-primary/30">edit_note</span>
            <p className="text-on-surface-variant">Select a document and click Generate</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center h-[40vh] space-y-4">
            <div className="flex gap-2">
              {[0,0.2,0.4].map((d,i) => (
                <div key={i} className="w-2 h-2 bg-primary rounded-full thinking-indicator" style={{animationDelay:`${d}s`}} />
              ))}
            </div>
            <p className="text-on-surface-variant text-[14px]">Generating study materials...</p>
          </div>
        )}

        {result?.error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">{result.error}</div>
        )}

        {result && !result.error && (
          <>
            <div className="flex gap-2 border-b border-outline-variant/20 pb-1">
              {tabs.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2 rounded-t-lg text-[12px] uppercase tracking-wider font-semibold transition-all ${
                    tab === t ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'
                  }`}>
                  {t}
                </button>
              ))}
            </div>

            {/* Flashcards */}
            {tab === 'flashcards' && (
              <div className="space-y-4">
                {result.flashcards?.map((f, i) => (
                  <div key={i} onClick={() => setFlipped(p => ({...p, [i]: !p[i]}))}
                    className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl cursor-pointer hover:border-primary/30 transition-all min-h-[120px] flex flex-col justify-center">
                    <p className="text-[11px] uppercase text-primary tracking-wider mb-3">{flipped[i] ? 'Answer' : 'Question'}</p>
                    <p className="text-on-surface/90 leading-relaxed">{flipped[i] ? f.answer : f.question}</p>
                    <p className="text-[11px] text-on-surface-variant/40 mt-4">Click to {flipped[i] ? 'see question' : 'reveal answer'}</p>
                  </div>
                ))}
              </div>
            )}

            {/* MCQ */}
            {tab === 'mcq' && (
              <div className="space-y-4">
                {result.mcqs?.map((q, i) => (
                  <div key={i} className="bg-[#18181B] border border-outline-variant/20 p-6 rounded-2xl">
                    <p className="text-on-surface font-medium mb-4">{i+1}. {q.question}</p>
                    <div className="space-y-2">
                      {q.options?.map((opt, j) => {
                        const isSelected = selected[i] === j;
                        const isCorrect = j === q.correct_index;
                        const revealed = selected[i] !== undefined;
                        return (
                          <button key={j} onClick={() => setSelected(p => ({...p, [i]: j}))}
                            className={`w-full text-left px-4 py-3 rounded-xl border text-[14px] transition-all ${
                              !revealed ? 'border-outline-variant/20 hover:border-primary/30 text-on-surface/80' :
                              isCorrect ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' :
                              isSelected ? 'border-red-500/40 bg-red-500/10 text-red-400' :
                              'border-outline-variant/10 text-on-surface/40'
                            }`}>
                            <span className="font-semibold mr-2">{String.fromCharCode(65+j)}.</span>{opt}
                          </button>
                        );
                      })}
                    </div>
                    {selected[i] !== undefined && q.explanation && (
                      <p className="mt-4 text-[13px] text-on-surface-variant bg-surface-container p-3 rounded-xl">{q.explanation}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Viva */}
            {tab === 'viva' && (
              <div className="space-y-3">
                {result.viva_questions?.map((v, i) => (
                  <details key={i} className="bg-[#18181B] border border-outline-variant/20 rounded-2xl group">
                    <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none">
                      <p className="text-on-surface/90 font-medium">{i+1}. {v.question}</p>
                      <span className="material-symbols-outlined text-on-surface-variant transition-transform group-open:rotate-180">expand_more</span>
                    </summary>
                    <div className="px-6 pb-4 text-on-surface-variant text-[14px] leading-relaxed border-t border-outline-variant/10 pt-4">
                      {v.answer}
                    </div>
                  </details>
                ))}
              </div>
            )}

            {/* Concepts */}
            {tab === 'concepts' && (
              <div className="space-y-3">
                {result.key_concepts?.map((c, i) => (
                  <div key={i} className="bg-[#18181B] border border-outline-variant/20 p-5 rounded-2xl">
                    <p className="text-primary font-semibold mb-2">{c.term || c.concept}</p>
                    <p className="text-on-surface/80 text-[14px] leading-relaxed">{c.definition || c.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}